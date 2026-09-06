import {expect,it} from 'vitest';
import {captureSeed} from '../../src/performance/capture';
it('preserves intervals and an omitted reference when reopening pitches',()=>{const s=captureSeed([-70,5]);expect(s.reference).toBe(70);expect(s.pitches).toEqual([0,75]);});
it('supports boundary-spanning patterns but rejects unrepresentable reference spans',()=>{expect(captureSeed([0,127])).toEqual({reference:0,pitches:[0,127]});expect(()=>captureSeed([-127,127])).toThrow('MIDI range');});
