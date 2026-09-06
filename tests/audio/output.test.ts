import {expect,it} from 'vitest';
import {OutputLevel} from '../../src/audio/output';
it('leaves ordinary waveforms unchanged rather than saturating every sample',()=>{
 const level=new OutputLevel(48000);
 for(let i=0;i<48000;i++)expect(level.scale(.6*Math.sin(i*.1),.4*Math.sin(i*.15))).toBe(1);
});
it('bounds overloads with linked stereo gain and releases gradually',()=>{
 const level=new OutputLevel(48000);
 expect(level.scale(4,2)).toBeCloseTo(.225);
 const next=level.scale(.4,.2);expect(next).toBeGreaterThan(.225);expect(next).toBeLessThan(.226);
 for(let i=0;i<48000;i++)level.scale(0,0);
 expect(level.scale(.4,.2)).toBeGreaterThan(.999);
 for(let i=0;i<48000;i++){
  const left=10*Math.sin(i*.1),right=4*Math.cos(i*.03),gain=level.scale(left,right);
  expect(Math.max(Math.abs(left*gain),Math.abs(right*gain))).toBeLessThanOrEqual(.9000001);
 }
});
