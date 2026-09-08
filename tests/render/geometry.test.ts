/*! Copyright (c) 2026 Ethan Joffe */
import {expect,it} from 'vitest';
import {hitGrid,hitPiano,hitSmooth} from '../../src/render/geometry';
it('targets square cells with centered letterboxing and rejects the margins',()=>{
  const g={width:1000,height:600,columns:10,rows:5,base:48,horizontal:4,vertical:3};
  expect(hitGrid(1,51,g)).toBe(60);expect(hitGrid(301,451,g)).toBe(60);
  expect(hitGrid(1,1,g)).toBeNull();expect(hitGrid(1000,200,g)).toBeNull();
});
it('gives black keys hit priority only above their visible lower edge',()=>{
  expect(hitPiano(42,10,960,96)).toBe(49);
  expect(hitPiano(42,90,960,96)).toBe(48);
  expect(hitPiano(959,90,960,96)).toBe(84);
});
it('spaces unequal scale intervals equally during smooth playing',()=>{
  const major=[0,2,4,5,7,9,11];
  expect([0,100,200,300,400,500,600].map(x=>hitSmooth(x,700,60,71,0,major))).toEqual([60,62,64,65,67,69,71]);
  expect(hitSmooth(100,700,60,71,0,[])).toBeNull();
});
