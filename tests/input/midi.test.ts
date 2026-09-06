import {expect,it} from 'vitest';
import {MidiRouter} from '../../src/input/midi';
import {PerformanceEngine} from '../../src/performance/engine';
it('preserves internal processing and deliberate panic when an external MIDI device fails',()=>{
 const inputs:unknown[]=[],records:unknown[]=[];const router=new MidiRouter(input=>inputs.push(input),row=>records.push(row));
 router.output={send:()=>{throw Error('disconnected');}} as unknown as MIDIOutput;router.thru=true;
 router.receive(new Uint8Array([0x90,60,80]),1);
 expect(inputs).toHaveLength(1);expect(router.output).toBeNull();expect(router.lastError).toBe('disconnected');
 expect(()=>router.silenceOutput()).not.toThrow();
});
it('forwards raw Thru immediately while generated notes and incoming visualization wait for the tick',()=>{
 const e=new PerformanceEngine(48000,{metronome:true,tempo:120});
 const wire:number[][]=[];const router=new MidiRouter(input=>e.enqueue(input,1000),()=>{});
 router.output={send:(bytes:number[])=>wire.push(Array.from(bytes))} as unknown as MIDIOutput;
 router.thru=true;router.receive(new Uint8Array([0x92,60,80]),10);
 expect(wire).toEqual([[0x92,60,80]]);expect(e.snapshot.midi).toEqual([]);
 expect(e.advance(0,24000).flatMap(f=>f.actions)).toEqual([]);
 const frame=e.advance(24000,24001)[0];expect(frame.snapshot.midi).toEqual([60]);
 expect(frame.actions.map(a=>[a.type,a.pitch,a.velocity])).toEqual([['on',60,80],['on',64,80],['on',67,80]]);
});
it('normalizes velocity-zero note-ons as releases while preserving their raw Thru bytes',()=>{
 const inputs:unknown[]=[],wire:number[][]=[];const router=new MidiRouter(input=>inputs.push(input),()=>{});
 router.output={send:(bytes:number[])=>wire.push(Array.from(bytes))} as unknown as MIDIOutput;router.thru=true;
 router.receive(new Uint8Array([0x90,60,80]),1);router.receive(new Uint8Array([0x90,60,0]),2);
 expect(inputs).toEqual([{type:'midiOn',id:'synthetic:0:60',pitch:60,velocity:80},{type:'midiOff',id:'synthetic:0:60'}]);
 expect(wire[1]).toEqual([0x90,60,0]);
});
it('keeps incoming port/channel/pitch identity distinct',()=>{
 const inputs:unknown[]=[];const router=new MidiRouter(input=>inputs.push(input),()=>{});
 router.receive(new Uint8Array([0x90,60,80]),1);router.receive(new Uint8Array([0x91,60,80]),2);router.receive(new Uint8Array([0x80,60,0]),3);
 expect(inputs).toEqual([{type:'midiOn',id:'synthetic:0:60',pitch:60,velocity:80},{type:'midiOn',id:'synthetic:1:60',pitch:60,velocity:80},{type:'midiOff',id:'synthetic:0:60'}]);
});
function routed(){const wire:number[][]=[];let clears=0;const r=new MidiRouter(()=>{},()=>{});r.output={send:(b:number[])=>wire.push(Array.from(b)),clear:()=>clears++} as unknown as MIDIOutput;return{r,wire,clears:()=>clears};}
it('releases on the original Thru channel after changing routing',()=>{const {r,wire}=routed();r.configure(true,true,false,4);r.receive(new Uint8Array([0x92,60,80]),0);r.configure(true,true,false,6);r.receive(new Uint8Array([0x82,60,0]),1);expect(wire).toEqual([[0x94,60,80],[0x84,60,0]]);});
it('repeated Thru note-ons have a single release obligation',()=>{const {r,wire}=routed();r.configure(true,true,false,4);r.receive(new Uint8Array([0x92,60,80]),0);r.receive(new Uint8Array([0x92,60,90]),1);r.receive(new Uint8Array([0x82,60,0]),2);r.configure(false,true,false,4);expect(wire).toEqual([[0x94,60,80],[0x84,60,0],[0x94,60,90],[0x84,60,0]]);});
it('Thru release and channel reset preserve a generated owner',()=>{const {r,wire}=routed();r.configure(true,true,false,0);r.schedule([{type:'on',pitch:60,channel:0,velocity:80,sample:0,eventId:1}],0);r.receive(new Uint8Array([0x91,60,90]),0);r.receive(new Uint8Array([0xb1,123,0]),1);expect(wire).toHaveLength(2);r.schedule([{type:'off',pitch:60,channel:0,velocity:80,sample:1,eventId:2}],0);expect(wire.at(-1)).toEqual([0x80,60,0]);});
it('disabling generated output cancels queued events and releases touched notes',()=>{const {r,wire,clears}=routed();r.schedule([{type:'on',pitch:60,channel:0,velocity:80,sample:0,eventId:1},{type:'off',pitch:60,channel:0,velocity:80,sample:1,eventId:2}],performance.now()+1000);r.configure(false,false,true,0);expect(clears()).toBe(1);expect(wire.at(-1)).toEqual([0x80,60,0]);const n=wire.length;r.schedule([{type:'on',pitch:64,channel:0,velocity:80,sample:0,eventId:1}],0);expect(wire).toHaveLength(n);});
it('system messages retain their bytes when remapping channel voice messages',()=>{const {r,wire}=routed();r.configure(true,true,false,4);r.receive(new Uint8Array([0xf8]),0);expect(wire).toEqual([[0xf8]]);});
it('rebuilds queued generated releases when an immediate Thru owner arrives',()=>{
 const wire:{bytes:number[];time?:number}[]=[];let clears=0;const r=new MidiRouter(()=>{},()=>{});r.output={send:(b:number[],time?:number)=>wire.push({bytes:Array.from(b),time}),clear:()=>{clears++;for(let i=wire.length-1;i>=0;i--)if((wire[i].time??0)>performance.now())wire.splice(i,1);}} as unknown as MIDIOutput;r.configure(true,true,false,0);
 const when=performance.now()+1000;r.schedule([{type:'off',pitch:60,channel:0,velocity:80,sample:0,eventId:1}],when);r.receive(new Uint8Array([0x91,60,90]),0);expect(clears).toBe(1);expect(wire).toEqual([{bytes:[0x90,60,90],time:undefined}]);r.receive(new Uint8Array([0x81,60,0]),1);expect(wire.at(-1)).toEqual({bytes:[0x80,60,0],time:when});
});
it('stopped sound suppresses incoming processing and all MIDI output until re-enabled',()=>{
 const inputs:unknown[]=[],wire:number[][]=[];const r=new MidiRouter(i=>inputs.push(i),()=>{});r.output={send:(b:number[])=>wire.push(Array.from(b))} as unknown as MIDIOutput;r.thru=true;r.enabled=false;
 r.receive(new Uint8Array([0x90,60,80]),0);r.schedule([{type:'on',pitch:64,channel:0,velocity:80,sample:0,eventId:1}],0);expect(inputs).toEqual([]);expect(wire).toEqual([]);
 r.enabled=true;r.receive(new Uint8Array([0x90,60,80]),0);expect(inputs).toHaveLength(1);expect(wire).toEqual([[0x90,60,80]]);
});
