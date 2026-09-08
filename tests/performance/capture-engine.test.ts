/*! Copyright (c) 2026 Ethan Joffe */
import {describe,it,expect} from 'vitest';
import {PerformanceEngine} from '../../src/performance/engine';
import type {Input,Settings} from '../../src/performance/model';

function rig(settings:Partial<Settings>={}){
  const engine=new PerformanceEngine(48000,{chord:[0],mode:Array.from({length:12},(_,i)=>i),...settings});
  let cursor=0;
  return {engine,at(sample:number,input:Input){engine.enqueue(input,sample);},until(end:number){const frames=engine.advance(cursor,end);cursor=end;return frames;},input(input:Input){engine.enqueue(input,cursor);const frames=engine.advance(cursor,cursor+1);cursor++;return frames;}};
}
const start:Input={type:'captureStart',kind:'chord'};
const select=(pitch:number):Input=>({type:'captureSelect',pitch});
const pitches=(r:ReturnType<typeof rig>)=>r.engine.snapshot.sounding.map(n=>n.pitch).sort((a,b)=>a-b);

describe('capture in the performance engine',()=>{
  it('starts empty above a continuing performance and captures raw pitches without changing its settings',()=>{
    const r=rig({chord:[0,4,7],mode:[0,4,7],setsRoot:true,mouseSolo:false,playChords:false});
    r.input({type:'pointer',pitch:60,down:true});const settings=r.engine.snapshot.settings;
    expect(r.input(start).flatMap(f=>f.actions)).toEqual([]);
    expect(r.engine.snapshot.capture).toMatchObject({reference:null,selected:[],audition:[]});
    r.input(select(61));
    expect(r.engine.snapshot.capture?.selected).toEqual([61]);
    expect(pitches(r)).toEqual([60,61,64,67]);
    expect(r.engine.snapshot.settings).toEqual(settings);
    r.input({type:'captureCancel'});expect(pitches(r)).toEqual([60,64,67]);
    expect(r.engine.snapshot.settings).toEqual(settings);
  });
  it('retains exact MIDI selections on key-up and toggles them on the next note-on',()=>{
    const r=rig({mode:[0],chord:[0,7],playChords:false,setsRoot:true,midiChannel:3});r.input(start);
    const on:Input={type:'midiOn',id:'61',pitch:61,velocity:77};
    r.input(on);r.input({type:'midiOff',id:'61'});
    expect(r.engine.snapshot.capture?.selected).toEqual([61]);
    expect(r.engine.snapshot.capture?.audition).toEqual([{pitch:61,channel:3,velocity:77}]);
    expect(r.engine.snapshot.settings.root).toBe(0);
    r.input(on);expect(pitches(r)).toEqual([]);
    expect(r.engine.snapshot.capture?.reference).toBe(61);
  });
  it('keeps a removed reference through an empty draft and chord/mode switches',()=>{
    const r=rig();r.input(start);r.input(select(60));r.input(select(60));r.input(select(64));r.input(select(76));
    r.input({type:'captureStart',kind:'mode'});
    expect(r.engine.snapshot.capture).toMatchObject({kind:'mode',reference:60,selected:[64,76]});
    r.input(start);expect(r.engine.snapshot.capture).toMatchObject({kind:'chord',reference:60,selected:[64,76]});
  });
  it('keeps all 128 pitches auditioning by default even when Hold Number is two',()=>{
    const r=rig({holdNumber:2,captureHoldNumber:2});r.input(start);
    for(let pitch=0;pitch<128;pitch++)r.input(select(pitch));
    expect(r.engine.snapshot.settings.captureLimit).toBe(false);
    expect(r.engine.snapshot.capture?.selected).toHaveLength(128);
    expect(pitches(r)).toHaveLength(128);
  });
  it('limits only audition ownership, without removing selections or prior performance notes',()=>{
    const r=rig({holdNumber:2,captureHoldNumber:2});r.input({type:'pointer',pitch:64,down:true});r.input({type:'control',control:'drone',active:true});r.input({type:'release'});
    r.input(start);for(const p of [64,67,71,72])r.input(select(p));
    const frames=r.input({type:'settings',settings:{captureLimit:true}});
    expect(frames.flatMap(f=>f.actions).map(a=>[a.type,a.pitch])).toEqual([['off',67]]);
    expect(r.engine.snapshot.capture?.selected).toEqual([64,67,71,72]);
    expect(r.engine.snapshot.capture?.audition.map(n=>n.pitch)).toEqual([71,72]);
    expect(pitches(r)).toEqual([64,71,72]);
    r.input(select(72));expect(r.engine.snapshot.capture?.audition.map(n=>n.pitch)).toEqual([71]);
    r.input({type:'settings',settings:{captureLimit:false}});expect(pitches(r)).toEqual([64,71]);
    r.input(select(67));r.input(select(67));expect(pitches(r)).toEqual([64,67,71]);
  });
  for(const control of ['sustain','drone'] as const)it(`reattacks a shared ${control} pitch and retains its old owner on capture exit`,()=>{
    const r=rig();r.input({type:'pointer',pitch:60,down:true});r.input({type:'control',control,active:true});r.input({type:'release'});r.input(start);
    const actions=r.input(select(60)).flatMap(f=>f.actions).map(a=>[a.type,a.pitch]);
    expect(actions).toEqual([['off',60],['on',60]]);
    r.input(select(67));const exit=r.input({type:'captureFinish'}).flatMap(f=>f.actions).map(a=>[a.type,a.pitch]);
    expect(exit).toEqual([['off',67]]);expect(pitches(r)).toEqual([60]);
    expect(r.engine.snapshot.capture?.phase).toBe('naming');
    r.input({type:'captureCancel'});expect(pitches(r)).toEqual([60]);
    r.input({type:'control',control,active:false});expect(pitches(r)).toEqual([]);
  });
  it('keeps capture sound alive when its overlapping prior MIDI owner releases',()=>{
    const r=rig();r.input({type:'midiOn',id:'60',pitch:60,velocity:96});r.input(start);r.input(select(60));
    expect(r.input({type:'midiOff',id:'60'}).flatMap(f=>f.actions)).toEqual([]);expect(pitches(r)).toEqual([60]);
    expect(r.input({type:'captureCancel'}).flatMap(f=>f.actions).map(a=>[a.type,a.pitch])).toEqual([['off',60]]);
  });
  it('commits raw selections and kind switches on the next tick, but ends audition immediately',()=>{
    const r=rig({metronome:true,tempo:120});r.at(10,start);r.until(11);
    r.at(100,select(61));r.at(200,{type:'captureStart',kind:'mode'});r.until(24000);
    expect(r.engine.snapshot.capture?.selected).toEqual([]);expect(pitches(r)).toEqual([]);
    const tick=r.until(24001);expect(tick.flatMap(f=>f.actions).map(a=>[a.sample,a.type,a.pitch])).toEqual([[24000,'on',61]]);
    expect(r.engine.snapshot.capture?.kind).toBe('mode');
    const exit=r.input({type:'captureFinish'});expect(exit.flatMap(f=>f.actions).map(a=>[a.sample,a.type,a.pitch])).toEqual([[24001,'off',61]]);
    expect(r.engine.snapshot.capture).toMatchObject({phase:'naming',selected:[61]});
  });
  it('resumes draft audition when editing and ignores MIDI while naming',()=>{
    const r=rig();r.input(start);r.input(select(60));r.input(select(72));r.input({type:'captureFinish'});
    r.input({type:'midiOn',id:'65',pitch:65,velocity:96});expect(pitches(r)).toEqual([]);
    r.input({type:'captureEdit'});expect(pitches(r)).toEqual([60,72]);
    expect(r.engine.snapshot.capture?.selected).toEqual([60,72]);
  });
  it('finishes empty without a naming phase and starts the next draft with a new reference',()=>{
    const r=rig();r.input(start);r.input(select(60));r.input(select(60));r.input({type:'captureFinish'});
    expect(r.engine.snapshot.capture).toBeNull();r.input(start);r.input(select(64));expect(r.engine.snapshot.capture?.reference).toBe(64);
  });
  for(const type of ['panic','document'] as const)it(`${type} immediately clears both owners even between ticks`,()=>{
    const r=rig({metronome:true});r.at(1,{type:'pointer',pitch:60,down:true});r.until(12001);r.input(start);r.input(select(61));r.until(24001);
    const frames=r.input(type==='document'?{type,settings:{}}:{type});
    expect(frames.flatMap(f=>f.actions).map(a=>a.pitch).sort()).toEqual([60,61]);
    expect(pitches(r)).toEqual([]);expect(r.engine.snapshot.capture).toBeNull();
  });
});

it('reopens a saved pattern with a fixed unselected reference and releases its audition on cancel',()=>{
 const e=new PerformanceEngine(48000,{metronome:false});e.enqueue({type:'captureStart',kind:'chord',seed:{reference:60,pitches:[55,67]}},0);e.advance(0,1);expect(e.snapshot.capture?.reference).toBe(60);expect(e.snapshot.capture?.selected).toEqual([55,67]);expect(e.snapshot.sounding.map(n=>n.pitch)).toEqual([55,67]);e.enqueue({type:'captureCancel'},1);const actions=e.advance(1,2).flatMap(f=>f.actions);expect(actions.map(a=>[a.type,a.pitch])).toEqual([['off',55],['off',67]]);
});
