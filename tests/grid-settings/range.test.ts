/*! Copyright (c) 2026 Ethan Joffe */
import {expect,it} from 'vitest';
import {defaultGridOptions,validateGridOptions} from '../../src/grid-settings/model';
import {freshDocument,parseDocument,serializeDocument,changes} from '../../src/document/model';
import {PerformanceEngine} from '../../src/performance/engine';
import {hitGrid,hitPiano,hitSmooth} from '../../src/render/geometry';
import type {Input} from '../../src/performance/model';
it('round-trips all 144 axis combinations and matches grid hit pitches',()=>{
  for(let h=1;h<=12;h++)for(let v=1;v<=12;v++){
    const doc=freshDocument();doc.surface.axes=[h,v];doc.surface.gridLow=0;doc.surface.clavierLow=0;
    expect(parseDocument(serializeDocument(doc)).surface.axes).toEqual([h,v]);
    const g={width:240,height:180,columns:4,rows:3,base:0,horizontal:h,vertical:v,maximum:127};
    for(let row=0;row<3;row++)for(let col=0;col<4;col++)expect(hitGrid(col*60+30,row*60+30,g)).toBe(col*h+(2-row)*v);
  }
});
it('migrates old files to the prior ceiling and registers without artificial dirty changes',()=>{
  const old:any=freshDocument();delete old.settings.maxPitch;
  const loaded=parseDocument(JSON.stringify(old));expect(loaded.settings.maxPitch).toBe(127);
  const explicit=structuredClone(loaded);explicit.surface.gridLow=24;explicit.surface.clavierLow=48;
  expect(changes(loaded,explicit)).toEqual([]);
});
it('saves registers and maximum pitch and reports their changes',()=>{
  const old=freshDocument(),doc=structuredClone(old);doc.surface.gridLow=48;doc.surface.clavierLow=60;doc.settings.maxPitch=84;
  expect(parseDocument(serializeDocument(doc))).toEqual(doc);
  expect(changes(old,doc)).toEqual(['Highest playable pitch changed','Grid register changed','Clavier register changed']);
});
it.each([{horizontal:13},{vertical:0},{gridLow:25},{clavierLow:84},{maximum:128},{maximum:47}])('rejects invalid settings %j',patch=>{
  expect(()=>validateGridOptions({...defaultGridOptions(),...patch})).toThrow();
});
it('rejects invalid ranges from files as well as from the editor',()=>{
  const doc=freshDocument();doc.surface.gridLow=25;expect(()=>serializeDocument(doc)).toThrow();
  doc.surface.gridLow=108;doc.settings.maxPitch=100;expect(()=>serializeDocument(doc)).toThrow();
});
it('rejects unavailable grid cells and keeps clavier register mapping exact',()=>{
  const g={width:240,height:180,columns:4,rows:3,base:96,horizontal:12,vertical:12,maximum:108};
  expect(hitGrid(30,150,g)).toBe(96);expect(hitGrid(90,150,g)).toBe(108);expect(hitGrid(150,150,g)).toBeNull();expect(hitGrid(210,30,g)).toBeNull();
  expect(hitPiano(1,80,960,96,60,96)).toBe(60);expect(hitPiano(959,80,960,96,60,96)).toBe(96);
  expect(hitSmooth(0,700,72,108,0,[0,2,4,5,7,9,11])).toBe(72);
});
function rig(extra={}){
  const engine=new PerformanceEngine(48000,{chord:[0,4,7,12],mode:Array.from({length:12},(_,i)=>i),...extra});let time=0;
  const send=(input:Input)=>{engine.enqueue(input,time);return engine.advance(time,time+=1).flatMap(f=>f.actions);};
  return {engine,send,pitches:()=>engine.snapshot.sounding.map(n=>n.pitch).sort((a,b)=>a-b)};
}
it('clips new mouse chord members while generated MIDI and capture MIDI ignore the ceiling',()=>{
  const {engine,send,pitches}=rig({maxPitch:64});send({type:'pointer',pitch:60,down:true});expect(pitches()).toEqual([60,64]);
  send({type:'release'});send({type:'midiOn',id:'m',pitch:72,velocity:99});expect(pitches()).toEqual([72,76,79,84]);
  send({type:'captureStart',kind:'chord'});send({type:'captureSelect',pitch:80});expect(engine.snapshot.capture!.selected).toEqual([]);
  send({type:'midiOn',id:'capture',pitch:80,velocity:99});expect(engine.snapshot.capture!.selected).toEqual([80]);
  send({type:'captureSelect',pitch:80});expect(engine.snapshot.capture!.selected).toEqual([]); // The selection list can remove MIDI pitches above the pointer ceiling.
});
it.each(['sustain','drone','hold'] as const)('preserves %s-retained notes when lowering the ceiling',control=>{
  const {send,pitches}=rig();send({type:'pointer',pitch:60,down:true});send({type:'control',control,active:true});send({type:'release'});
  const actions=send({type:'settings',settings:{maxPitch:60}});expect(pitches()).toEqual([60,64,67,72]);expect(actions).toEqual([]);
  send({type:'control',control,active:false});expect(pitches()).toEqual([]);
});
it('raising the ceiling does not create notes at a stationary pointer until its next gesture',()=>{
  const {send,pitches}=rig({maxPitch:60});send({type:'pointer',pitch:60,down:true});expect(pitches()).toEqual([60]);
  expect(send({type:'settings',settings:{maxPitch:84}})).toEqual([]);expect(pitches()).toEqual([60]);
  send({type:'pointer',pitch:60,down:true,strike:true});expect(pitches()).toEqual([60,64,67,72]);
});
it('ceiling updates keep mouse musical changes at ticks and preserve retained owners',()=>{
  const e=new PerformanceEngine(48000,{metronome:true,tempo:120,chord:[0,12]});
  e.enqueue({type:'pointer',pitch:60,down:true},1);e.advance(0,24001);
  e.enqueue({type:'settings',settings:{maxPitch:60}},25000);e.advance(24001,48000);expect(e.snapshot.played).toEqual([60,72]);
  const actions=e.advance(48000,48001).flatMap(f=>f.actions);expect(actions.map(a=>[a.type,a.pitch])).toEqual([['off',72]]);expect(e.snapshot.played).toEqual([60]);
});
