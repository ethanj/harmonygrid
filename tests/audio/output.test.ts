import {expect,it} from 'vitest';
import {OutputLevel} from '../../src/audio/output';
it('preserves quiet stereo waveforms with exactly one block of delay',()=>{
 const level=new OutputLevel(48000);
 const l=Float32Array.from({length:128},(_,i)=>.6*Math.sin(i*.1)),r=Float32Array.from(l,x=>x*.5);
 const expected=l.slice(),expectedR=r.slice();level.process(l,r);
 expect(l.every(x=>x===0)).toBe(true);expect(r.every(x=>x===0)).toBe(true);
 level.process(l,r);expect(l).toEqual(expected);expect(r).toEqual(expectedR);
});
it('ramps down before an abrupt overload without flattening its leading edge',()=>{
 const level=new OutputLevel(48000),l=new Float32Array(128).fill(.2),r=new Float32Array(128).fill(.1);
 level.process(l,r);l.fill(4);r.fill(2);level.process(l,r);
 for(let i=1;i<128;i++)expect(Math.abs(l[i]-l[i-1])).toBeLessThan(.002);
 expect(l[127]).toBeCloseTo(.2*.85/4);
 l.fill(4);r.fill(2);level.process(l,r);
 for(let i=0;i<128;i++){expect(l[i]).toBeCloseTo(.85);expect(r[i]).toBeCloseTo(.425);}
});
it('bounds changing dense stereo mixtures and recovers gradually',()=>{
 const level=new OutputLevel(48000),l=new Float32Array(128),r=new Float32Array(128);
 for(let block=0;block<500;block++){
  for(let i=0;i<128;i++){const t=block*128+i;l[i]=(block%7)*Math.sin(t*.1);r[i]=(block%11)*Math.cos(t*.03);}
  level.process(l,r);
  for(let i=0;i<128;i++)expect(Math.max(Math.abs(l[i]),Math.abs(r[i]))).toBeLessThanOrEqual(.850001);
 }
 for(let block=0;block<400;block++){l.fill(.4);r.fill(.2);level.process(l,r);}
 expect(l[127]).toBeGreaterThan(.399);expect(r[127]).toBeGreaterThan(.199);
});
