import {expect,it} from 'vitest';
import {AudioActivity} from '../../src/audio/activity';
it('distinguishes a stopped device clock from a stopped processor',()=>{
  const a=new AudioActivity();a.reset(100,0);
  a.received(2000);
  expect(a.check(2000,0,'running')).toBeNull();
  expect(a.check(2700,0,'running')).toBe('Audio clock stopped');
  a.reset(3000,2);
  expect(a.check(5600,4.6,'running')).toBe('Audio processor stopped responding');
});
it('accepts continuing processing and resets the grace period after resume',()=>{
  const a=new AudioActivity();a.reset(0,0);
  for(let t=1000;t<=20000;t+=1000){a.received(t);expect(a.check(t,t/1000,'running')).toBeNull();}
  expect(a.check(40000,20,'suspended')).toBeNull();
  a.reset(40000,20);
  expect(a.check(41000,21,'running')).toBeNull();
});
