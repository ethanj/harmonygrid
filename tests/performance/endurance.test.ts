/*! Copyright (c) 2026 Ethan Joffe */
import {writeFileSync,mkdirSync} from 'node:fs';
import {expect,it} from 'vitest';
import {PerformanceEngine} from '../../src/performance/engine';
import {defaultVariations} from '../../src/performance-settings/model';
it('runs three twenty-minute simulated timelines without lost ownership or queue growth',()=>{
 const report=[];
 for(const scene of ['free','quantized','multi-retained']){
  const e=new PerformanceEngine(48000,{metronome:scene!=='free',tempo:480,chord:[0,4,7,10,14],mode:[0,1,2,3,4,5,6,7,8,9,10,11],variations:{...defaultVariations(),multiMidi:scene==='multi-retained'}});
  let frames=0,actions=0,maximumNotes=0;const end=48000*60*20;
  for(let sample=0;sample<end;sample+=480){
   const step=sample/480;e.enqueue({type:'pointer',pitch:36+step%48,down:true},sample);
   if(step%25===0)e.enqueue({type:'midiOn',id:String(step%4),pitch:48+step%24,velocity:80},sample);
   if(step%25===24)e.enqueue({type:'midiOff',id:String((step-24)%4)},sample);
   if(step%1000===0){e.enqueue({type:'control',control:'sustain',active:scene==='multi-retained'},sample);e.enqueue({type:'control',control:'repeat',active:step%2000===0},sample);}
   const batch=e.advance(sample,sample+480);frames+=batch.length;actions+=batch.reduce((n,f)=>n+f.actions.length,0);maximumNotes=Math.max(maximumNotes,e.snapshot.sounding.length);
  }
  e.enqueue({type:'panic'},end);e.advance(end,end+1);expect(e.snapshot.sounding).toEqual([]);expect(e.queue).toEqual([]);expect(e.queueOverflows).toBe(0);expect(e.lateInputs).toBe(0);
  report.push({scene,simulatedSeconds:1200,frames,actions,maximumNotes,queueOverflows:e.queueOverflows,lateInputs:e.lateInputs});
 }
 mkdirSync('docs-internal/completion-runs',{recursive:true});writeFileSync('docs-internal/completion-runs/simulated-endurance.json',JSON.stringify({evidence:'Accelerated logical engine simulation; not wall-clock audio or physical performance acceptance',runs:report},null,2)+'\n');
},30000);
