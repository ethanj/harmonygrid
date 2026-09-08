import {afterEach,expect,it,vi} from 'vitest';
import type {Input} from '../../src/performance/model';

interface Processor {
  port:{onmessage:(event:{data:{input?:Input;checkpoint?:number}})=>void};
  process(inputs:Float32Array[][],outputs:Float32Array[][]):boolean;
}
async function processor(rate:number){
  vi.resetModules();
  const messages:Record<string,unknown>[]=[];
  let Constructor:new()=>Processor;
  vi.stubGlobal('sampleRate',rate);vi.stubGlobal('currentFrame',0);
  vi.stubGlobal('AudioWorkletProcessor',class {port={postMessage:(message:Record<string,unknown>)=>messages.push(message)};});
  vi.stubGlobal('registerProcessor',(_name:string,c:new()=>Processor)=>{Constructor=c;});
  await import('../../src/audio/instrument.worklet');
  return {instance:new Constructor!(),messages};
}
afterEach(()=>vi.unstubAllGlobals());

it('auditions the full MIDI range above a second-channel performance without stealing held voices',async()=>{
  const {instance,messages}=await processor(48000);
  const send=(input:Input)=>instance.port.onmessage({data:{input}});
  const pitches=Array.from({length:128},(_,i)=>i);
  send({type:'settings',settings:{chord:pitches,mode:pitches.slice(0,12),mouseChannel:1}});
  send({type:'pointer',pitch:0,down:true});
  send({type:'captureStart',kind:'chord'});
  for(const pitch of pitches)send({type:'captureSelect',pitch,channel:0});
  const output=[[new Float32Array(128),new Float32Array(128)]];
  expect(instance.process([],output)).toBe(true);
  const health=messages.find(m=>m.kind==='health');
  expect(health).toMatchObject({voiceSteals:0,nonFiniteSamples:0});
  const committed=messages.find(m=>m.kind==='frames') as {frames:{snapshot:{sounding:unknown[]}}[]};
  expect(committed.frames.at(-1)?.snapshot.sounding).toHaveLength(256);
  vi.stubGlobal('currentFrame',128);send({type:'captureFinish'});
  expect(instance.process([],output)).toBe(true);
  const next=messages.at(-1) as {frames:{actions:{type:string;channel:number}[];snapshot:{sounding:unknown[]}}[]};
  expect(next.frames.at(-1)?.snapshot.sounding).toHaveLength(128);
  expect(next.frames.flatMap(f=>f.actions).every(a=>a.type==='off'&&a.channel===0)).toBe(true);
  expect(output[0][0].some(sample=>sample!==0)).toBe(true);
});

it.each([8000,48000])('reports ongoing audio health at %i Hz',async rate=>{
  const {instance,messages}=await processor(rate);
  instance.port.onmessage({data:{input:{type:'pointer',pitch:60,down:true}}});
  const output=[[new Float32Array(128),new Float32Array(128)]];
  let energy=0;
  for(let frame=0;frame<rate;frame+=128){
    vi.stubGlobal('currentFrame',frame);
    expect(instance.process([],output)).toBe(true);
    energy+=output[0][0].reduce((sum,sample)=>sum+sample*sample,0);
  }
  const health=messages.filter(message=>message.kind==='health');
  expect(health).toHaveLength(2);
  expect(Number(health[1].sample)/rate).toBeGreaterThanOrEqual(.5);
  expect(Number(health[1].sample)/rate).toBeLessThan(.52);
  expect(energy).toBeGreaterThan(0);
});

it('reports the original exception and clock position and silences a failed block',async()=>{
  const {instance,messages}=await processor(48000);
  const output=[[new Float32Array(128).fill(.5),new Float32Array(128).fill(.5)]];
  expect(instance.process([],output)).toBe(true);
  vi.stubGlobal('currentFrame',128);
  expect(instance.process([],output)).toBe(true);
  // A true backward jump is a fault; a duplicate of the last block is handled below.
  vi.stubGlobal('currentFrame',0);
  expect(instance.process([],output)).toBe(false);
  expect(messages.at(-1)).toMatchObject({kind:'processor-fault',message:'Non-monotonic audio interval',sample:0,lastBlock:128});
  expect(output.flatMap(channels=>channels.flatMap(channel=>[...channel])).every(sample=>sample===0)).toBe(true);
});

it('replays duplicate browser quanta without killing audio, repeating attacks, or losing the next input',async()=>{
  const {instance,messages}=await processor(48000);
  instance.port.onmessage({data:{input:{type:'pointer',pitch:60,down:true}}});
  const output=[[new Float32Array(128),new Float32Array(128)]];
  expect(instance.process([],output)).toBe(true);
  const first=[...output[0][0]],count=messages.length;
  instance.port.onmessage({data:{input:{type:'pointer',pitch:62,down:true}}});
  const afterInput=messages.length;
  expect(afterInput).toBe(count+1); // Input receipt only.
  for(let repeat=0;repeat<3;repeat++){
    output[0][0].fill(0);output[0][1].fill(0);
    expect(instance.process([],output)).toBe(true);
    expect([...output[0][0]]).toEqual(first);expect([...output[0][1]]).toEqual(first);
    expect(messages).toHaveLength(afterInput);
  }
  vi.stubGlobal('currentFrame',128);
  expect(instance.process([],output)).toBe(true);
  const next=messages.at(-1) as {kind:string;frames:{sample:number;snapshot:{lead:number};actions:{type:string}[]}[]};
  expect(next.kind).toBe('frames');expect(next.frames[0].sample).toBe(128);
  expect(next.frames[0].snapshot.lead).toBe(62);
  expect(next.frames[0].actions.some(action=>action.type==='on')).toBe(true);
  expect(messages.some(message=>message.kind==='processor-fault')).toBe(false);
});

it('checkpoints include queued settings between ticks without releasing notes or advancing the pulse',async()=>{
  const {instance,messages}=await processor(48000);
  instance.port.onmessage({data:{input:{type:'settings',settings:{metronome:true,root:2,chord:[0,7]}}}});
  instance.port.onmessage({data:{checkpoint:17}});
  const output=[[new Float32Array(128),new Float32Array(128)]];
  expect(instance.process([],output)).toBe(true);
  expect(messages.find(m=>m.kind==='checkpoint')).toMatchObject({id:17,settings:{root:2,chord:[0,7],metronome:true}});
  expect(messages.some(m=>m.kind==='frames')).toBe(false);
  instance.port.onmessage({data:{checkpoint:18}});
  expect(instance.process([],output)).toBe(true); // Duplicate block must defer, not lose, this checkpoint.
  expect(messages.filter(m=>m.kind==='checkpoint')).toHaveLength(1);
  vi.stubGlobal('currentFrame',128);expect(instance.process([],output)).toBe(true);
  expect(messages.filter(m=>m.kind==='checkpoint')).toHaveLength(2);
});


it.each([24,64,128])('keeps a solo note audible and %i simultaneous notes bounded through repeated attacks',async noteCount=>{
  const {instance}=await processor(48000);
  instance.port.onmessage({data:{input:{type:'settings',settings:{chord:[0]}}}});
  instance.port.onmessage({data:{input:{type:'pointer',pitch:60,down:true}}});
  const output=[[new Float32Array(128),new Float32Array(128)]];
  let energy=0,count=0;
  for(let frame=0;frame<48000;frame+=128){
    vi.stubGlobal('currentFrame',frame);expect(instance.process([],output)).toBe(true);
    for(const sample of output[0][0]){energy+=sample*sample;count++;}
  }
  const rms=Math.sqrt(energy/count);
  // The output boost is 3x: 2.5 dB below the previous 4x mix.
  expect(rms).toBeGreaterThan(.135);expect(rms).toBeLessThan(.173);
  instance.port.onmessage({data:{input:{type:'settings',settings:{chord:Array.from({length:noteCount},(_,i)=>i),mode:Array.from({length:12},(_,i)=>i)}}}});
  instance.port.onmessage({data:{input:{type:'pointer',pitch:60,down:true}}});
  instance.port.onmessage({data:{input:{type:'pointer',pitch:0,down:true}}});
  for(let frame=48128;frame<96000;frame+=128){
    if((frame-48128)%4096===0)instance.port.onmessage({data:{input:{type:'pointer',pitch:0,down:true,strike:true}}});
    vi.stubGlobal('currentFrame',frame);expect(instance.process([],output)).toBe(true);
    for(const channel of output[0])for(const sample of channel){expect(Number.isFinite(sample)).toBe(true);expect(Math.abs(sample)).toBeLessThanOrEqual(.850001);}
  }
});

it('centers an asymmetric sampled signal without doubling its level',async()=>{
 const {instance}=await processor(48000);
 const {Palette}=await import('../../src/audio/palette');
 const render=vi.spyOn(Palette.prototype,'render').mockImplementation((left,right,start,count)=>{
  left.fill(.6,start,start+count);right.fill(-.2,start,start+count);
 });
 try {
  const output=[[new Float32Array(128),new Float32Array(128)]];
  instance.process([],output);vi.stubGlobal('currentFrame',128);instance.process([],output);
  expect(output[0][0]).toEqual(output[0][1]);
  for(const sample of output[0][0])expect(sample).toBeCloseTo(.6);
 }finally{render.mockRestore();}
});
