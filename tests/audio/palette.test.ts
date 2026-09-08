/*! Copyright (c) 2026 Ethan Joffe */
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {Palette} from '../../src/audio/palette';
import type {Sound} from '../../src/audio/sounds';
it('renders all sampled sounds, including melodic MIDI channel ten, within requested sample spans',async()=>{
 const p=new Palette(),b=readFileSync('assets/soundfonts/harmony-palette.sf2');await p.load(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),48000);
 const energies:number[]=[];
 for(const sound of ['piano','electric','vibes','tonewheel'] as Sound[]){
  expect(p.on(sound,60,100,9)).toBe(true);let energy=0;
  for(let i=0;i<100;i++){const l=new Float32Array(128),r=new Float32Array(128);p.render(l,r,32,64);expect([...l.slice(0,32),...l.slice(96)]).toEqual(new Array(64).fill(0));for(const n of l){expect(Number.isFinite(n)).toBe(true);energy+=n*n;}}
  expect(energy).toBeGreaterThan(.01);energies.push(energy);p.off(60,9);for(let i=0;i<500;i++)p.render(new Float32Array(128),new Float32Array(128),0,128);
 }
 expect(new Set(energies.map(e=>e.toFixed(4))).size).toBe(4);
});
