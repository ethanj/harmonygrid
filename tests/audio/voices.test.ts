import {expect,it} from 'vitest';
import {Voices} from '../../src/audio/voices';
const energy=(v:Voices,count:number)=>{let sum=0;for(let i=0;i<count;i++)sum+=v.sample()**2;return sum/count;};
it('starts silent, produces a sustained tone, and releases to silence',()=>{
  const v=new Voices(48000);expect(energy(v,1000)).toBe(0);
  v.on(69,100);expect(energy(v,4800)).toBeGreaterThan(.001);
  expect(energy(v,48000)).toBeGreaterThan(.001);
  v.off(69);energy(v,12000);expect(energy(v,1000)).toBe(0);
});
it('preserves a held pitch when another pitch releases',()=>{
  const v=new Voices(48000);v.on(60,100);v.on(64,100);v.off(60);
  energy(v,12000);expect(energy(v,1000)).toBeGreaterThan(.001);
  v.silence();expect(energy(v,1000)).toBe(0);
});
it('keeps the same pitch on another output channel sounding',()=>{
  const v=new Voices(48000);v.on(60,100,0);v.on(60,100,1);v.off(60,0);
  energy(v,12000);expect(energy(v,1000)).toBeGreaterThan(.001);
  v.off(60,1);energy(v,12000);expect(energy(v,1000)).toBe(0);
});
it('bounds synthesis under retrigger pressure and reports voice stealing',()=>{
  const v=new Voices(48000,8);
  for(let i=0;i<500;i++) {v.on(60+i%12,127);const s=v.sample();expect(Number.isFinite(s)&&Math.abs(s)<=1).toBe(true);}
  expect(v.steals).toBeGreaterThan(0);v.off(60);v.silence();expect(energy(v,100)).toBe(0);
});
it('keeps naturally decaying sound distinct from sustained sound',()=>{
  const v=new Voices(48000);v.sound='pluck';v.on(69,100);
  const early=energy(v,4800);energy(v,144000);expect(energy(v,4800)).toBeLessThan(early/100);
});
