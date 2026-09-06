import {expect,it} from 'vitest';
import {PitchCapture} from '../../src/performance/capture';
it('collects exact pitches and folds octaves only when constructing a mode',()=>{
  const c=new PitchCapture();c.select(60);c.select(72);c.select(64);
  expect(c.pitches).toEqual([60,64,72]);
  expect(c.chord()).toEqual([0,4,12]);
  expect(c.mode()).toEqual([0,4]);
});
it('retains the first reference when it is toggled away',()=>{
  const c=new PitchCapture();c.select(60);c.select(64);c.select(60);
  expect(c.reference).toBe(60);expect(c.chord()).toEqual([4]);
  c.select(55);
  expect(c.reference).toBe(60);expect(c.chord()).toEqual([-5,4]);expect(c.mode()).toEqual([4,7]);
});
