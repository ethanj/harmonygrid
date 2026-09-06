import {describe,expect,it} from 'vitest';
import {PerformanceEngine} from '../../src/performance/engine';
import type {Frame,Input,Settings} from '../../src/performance/model';
const setup=(settings:Partial<Settings>={})=>new PerformanceEngine(48000,{metronome:true,tempo:120,...settings});
const pitches=(e:PerformanceEngine)=>e.snapshot.sounding.map(n=>n.pitch).sort((a,b)=>a-b);
const events=(frames:Frame[])=>frames.flatMap(f=>f.actions.map(a=>[a.sample,a.type,a.pitch]));
const send=(e:PerformanceEngine,sample:number,input:Input)=>e.enqueue(input,sample);
describe('tick sampling',()=>{
 it('discards intermediate positions and keeps both sound and full shape at the boundary',()=>{
  const e=setup();send(e,1000,{type:'pointer',pitch:60,down:true});send(e,2000,{type:'pointer',pitch:62});send(e,3000,{type:'pointer',pitch:71});
  expect(events(e.advance(0,24000))).toEqual([]);expect(e.snapshot.played).toEqual([]);
  expect(events(e.advance(24000,24001))).toEqual([[24000,'on',71],[24000,'on',74]]);
  expect(e.snapshot.filtered).toEqual([75,78]);
  expect(events(e.advance(24001,48001))).toEqual([]);
 });
 it('retains a short mouse click for exactly one full tick',()=>{
  const e=setup();send(e,1000,{type:'pointer',pitch:60,down:true});send(e,2000,{type:'release'});
  expect(events(e.advance(0,48001))).toEqual([[24000,'on',60],[24000,'on',64],[24000,'on',67],[48000,'off',60],[48000,'off',64],[48000,'off',67]]);
 });
 it('uses the latest position after several short clicks under the experiment policy',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'pointer',pitch:60,down:true});send(e,2,{type:'release'});send(e,3,{type:'pointer',pitch:62,down:true});send(e,4,{type:'release'});send(e,5,{type:'pointer',pitch:64});
  expect(events(e.advance(0,48001))).toEqual([[24000,'on',64],[48000,'off',64]]);
 });
 it('applies chord/root/mode before deriving a stationary chord at the tick',()=>{
  const e=setup();send(e,1,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{chord:[0,4,7,11],mode:[0,2,3,5,7,8,10]}});
  e.advance(24001,48000);expect(e.snapshot.played).toEqual([60,64,67]);
  e.advance(48000,48001);expect(pitches(e)).toEqual([60,67]);expect(e.snapshot.filtered).toEqual([64,71]);
 });
 it('releases on the next tick and plays immediately without quantization',()=>{
  const e=setup({metronome:false,chord:[0]});send(e,42,{type:'pointer',pitch:60,down:true});send(e,142,{type:'release'});
  expect(events(e.advance(0,200))).toEqual([[42,'on',60],[142,'off',60]]);
 });
 it('commits tempo changes on the original pulse and continues with the new interval',()=>{
  const e=setup();send(e,1000,{type:'settings',settings:{tempo:240}});
  expect(e.advance(0,48001).map(f=>f.sample)).toEqual([24000,36000,48000]);
 });
});
describe('individual note ownership',()=>{
 it('updates a Hold-retained chord on selection change after the mouse is released',()=>{
  const e=setup();send(e,1,{type:'control',control:'hold',active:true});send(e,2,{type:'pointer',pitch:60,down:true});send(e,3,{type:'release'});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{chord:[0,4,7,11]}});e.advance(24001,48001);expect(pitches(e)).toEqual([60,64,67,71]);
 });
 it('restrikes shared pitches on an ordinary chord replacement',()=>{
  const e=setup();send(e,1,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{chord:[0,4,7,11]}});
  expect(events(e.advance(24001,48001))).toEqual([[48000,'off',60],[48000,'off',64],[48000,'off',67],[48000,'on',60],[48000,'on',64],[48000,'on',67],[48000,'on',71]]);
 });
 it('accumulates under Sustain without reattack and preserves the active chord on release',()=>{
  const e=setup();send(e,1,{type:'control',control:'sustain',active:true});send(e,2,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{chord:[0,4,7,11]}});
  expect(events(e.advance(24001,48001))).toEqual([[48000,'on',71]]);
  send(e,50000,{type:'pointer',pitch:62});e.advance(48001,72001);expect(pitches(e)).toEqual([60,62,64,67,69,71]);
  send(e,73000,{type:'control',control:'sustain',active:false});e.advance(72001,96001);expect(pitches(e)).toEqual([62,69]);
 });
 it('evicts individual oldest retained notes, preserving current live obligations',()=>{
  const e=setup({chord:[0],holdNumber:2});send(e,1,{type:'control',control:'sustain',active:true});send(e,2,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'pointer',pitch:62});e.advance(24001,48001);send(e,50000,{type:'pointer',pitch:64});e.advance(48001,72001);
  expect(pitches(e)).toEqual([62,64]);send(e,73000,{type:'release'});e.advance(72001,96001);expect(pitches(e)).toEqual([62,64]);
 });
 it('does not refresh Sustain age when reusing a retained pitch',()=>{
  const e=setup({chord:[0],holdNumber:2});send(e,1,{type:'control',control:'sustain',active:true});send(e,2,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'pointer',pitch:62});e.advance(24001,48001);send(e,50000,{type:'pointer',pitch:60});e.advance(48001,72001);send(e,74000,{type:'pointer',pitch:64});e.advance(72001,96001);
  expect(pitches(e)).toEqual([62,64]);
 });
 it('holds across release and restrikes a replacement, then releases when Hold ends',()=>{
  const e=setup();send(e,1,{type:'control',control:'hold',active:true});send(e,2,{type:'pointer',pitch:60,down:true});send(e,3,{type:'release'});e.advance(0,48001);expect(pitches(e)).toEqual([60,64,67]);
  send(e,50000,{type:'pointer',pitch:60,down:true,strike:true});send(e,51000,{type:'release'});expect(events(e.advance(48001,72001)).filter(x=>x[1]==='on')).toHaveLength(3);
  send(e,74000,{type:'control',control:'hold',active:false});e.advance(72001,96001);expect(pitches(e)).toEqual([]);
 });
 it('Repeat reattacks Sustain notes but never Drone-owned pitches',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'control',control:'drone',active:true});send(e,25001,{type:'control',control:'sustain',active:true});send(e,26000,{type:'pointer',pitch:64});e.advance(24001,48001);
  send(e,50000,{type:'control',control:'repeat',active:true});expect(events(e.advance(48001,72001))).toEqual([[72000,'off',64],[72000,'on',64]]);
  send(e,73000,{type:'pointer',pitch:60});expect(events(e.advance(72001,96001))).toEqual([]);
 });
 it('retained notes survive a changed scale even when filtered from the current chord',()=>{
  const e=setup();send(e,1,{type:'control',control:'sustain',active:true});send(e,2,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{mode:[0,2,3,5,7,8,10]}});e.advance(24001,48001);
  expect(pitches(e)).toEqual([60,63,64,67]);expect(e.snapshot.filtered).toEqual([64]);
 });
 it('turning Drone off preserves another source owner of its pitch',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'pointer',pitch:60,down:true});e.advance(0,24001);send(e,25000,{type:'control',control:'drone',active:true});e.advance(24001,48001);
  send(e,50000,{type:'control',control:'drone',active:false});expect(events(e.advance(48001,72001))).toEqual([]);expect(pitches(e)).toEqual([60]);
 });
});
describe('MIDI priority and cross-source lifetimes',()=>{
 it('does not restrike MIDI accompaniment when only Mouse Solo changes',()=>{
  const e=setup();send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{mouseSolo:true}});expect(events(e.advance(24001,48001))).toEqual([]);
 });
 it('shows MIDI without generating sound when Play Chords is off',()=>{
  const e=setup({playChords:false});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});
  expect(events(e.advance(0,24001))).toEqual([]);expect(e.snapshot.midi).toEqual([60]);
 });
 it('does not repeatedly overwrite a manual root change from an unchanged held MIDI trigger',()=>{
  const e=setup({setsRoot:true});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'settings',settings:{root:2}});e.advance(24001,48001);expect(e.snapshot.settings.root).toBe(2);
 });
 it('does not retrigger the active chord when an older held MIDI key is released',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});send(e,2,{type:'midiOn',id:'e',pitch:64,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'midiOff',id:'c'});expect(events(e.advance(24001,48001))).toEqual([]);
 });
 it('recognizes a repeated short press of the same previously played MIDI key',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'midiOff',id:'c'});send(e,26000,{type:'midiOn',id:'c',pitch:60,velocity:80});send(e,27000,{type:'midiOff',id:'c'});
  expect(events(e.advance(24001,48001))).toEqual([[48000,'off',60],[48000,'on',60]]);
 });
 it('resumes an older held trigger and its Sets Root value',()=>{
  const e=setup({setsRoot:true});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:70});e.advance(0,24001);
  send(e,25000,{type:'midiOn',id:'e',pitch:64,velocity:90});e.advance(24001,48001);expect(e.snapshot.settings.root).toBe(4);
  send(e,50000,{type:'midiOff',id:'e'});e.advance(48001,72001);expect(pitches(e)).toEqual([60,64,67]);expect(e.snapshot.settings.root).toBe(0);expect(e.snapshot.sounding.every(n=>n.velocity===70)).toBe(true);
  send(e,73000,{type:'midiOff',id:'c'});e.advance(72001,96001);expect(pitches(e)).toEqual([]);expect(e.snapshot.settings.root).toBe(0);
 });
 it('keeps incoming visualization at ticks and turns a short MIDI tap into a full tick',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,1000);expect(e.snapshot.midi).toEqual([]);
  send(e,2000,{type:'midiOff',id:'c'});expect(events(e.advance(1000,48001))).toEqual([[24000,'on',60],[48000,'off',60]]);
 });
 it('prefers a held note over a short tap within the same interval',()=>{
  const e=setup({chord:[0]});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});send(e,2,{type:'midiOn',id:'e',pitch:64,velocity:100});send(e,3,{type:'midiOff',id:'e'});e.advance(0,24001);expect(pitches(e)).toEqual([60]);
 });
 it('restrikes mouse melody over MIDI without releasing the other owner',()=>{
  const e=setup({mouseSolo:true});send(e,1,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'pointer',pitch:64,down:true});expect(events(e.advance(24001,48001))).toEqual([[48000,'off',64],[48000,'on',64]]);
  send(e,50000,{type:'release'});expect(events(e.advance(48001,72001))).toEqual([]);expect(pitches(e)).toEqual([60,64,67]);
 });
 it('keeps output channels independent',()=>{
  const e=setup({chord:[0],mouseChannel:1,midiChannel:2});send(e,1,{type:'pointer',pitch:60,down:true});send(e,2,{type:'midiOn',id:'c',pitch:60,velocity:80});e.advance(0,24001);
  send(e,25000,{type:'release'});const actions=e.advance(24001,48001).flatMap(f=>f.actions);expect(actions.map(a=>[a.type,a.pitch,a.channel])).toEqual([['off',60,1]]);expect(e.snapshot.sounding[0].channel).toBe(2);
 });
});
it('switches documents immediately and clears live latches and old sound',()=>{
 const e=setup();send(e,1,{type:'control',control:'sustain',active:true});send(e,2,{type:'pointer',pitch:60,down:true});e.advance(0,24001);
 send(e,25000,{type:'document',settings:{chord:[0]}});const f=e.advance(24001,26000);expect(events(f).every(a=>a[0]===25000&&a[1]==='off')).toBe(true);expect(pitches(e)).toEqual([]);expect(e.snapshot.controls).toEqual({sustain:false,hold:false,drone:false,repeat:false});
});
it('processes a tick inside a render block at its exact sample',()=>{
 const e=setup();send(e,1,{type:'pointer',pitch:60,down:true});const result:Frame[]=[];
 for(let start=0;start<24100;start+=128)result.push(...e.advance(start,start+128));
 expect(events(result).map(a=>a[0])).toEqual([24000,24000,24000]);
});
