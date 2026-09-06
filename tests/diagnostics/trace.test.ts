import {expect,it} from 'vitest';
import {Trace} from '../../src/diagnostics/trace';
it('exports the newest events chronologically after repeated wraps',()=>{const t=new Trace(3);for(let i=0;i<8;i++)t.record(i);expect(JSON.parse(t.export({}))).toMatchObject({events:[5,6,7],dropped:5,capacity:3});t.record(8);expect(JSON.parse(t.export({})).events).toEqual([6,7,8]);});
