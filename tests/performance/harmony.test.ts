/*! Copyright (c) 2026 Ethan Joffe */
import {describe, expect, it} from 'vitest';
import {chordAt, gridPitch} from '../../src/performance/harmony';
const major=[0,2,4,5,7,9,11];
describe('literal musical witnesses',()=>{
  it('preserves the complete generic chord while filtering its minor third',()=>{
    expect(chordAt(60,[0,3,4,7],0,major)).toEqual({played:[60,64,67],filtered:[63]});
  });
  it('filters the fifth on B instead of correcting it into a diatonic chord',()=>{
    expect(chordAt(71,[0,3,4,7],0,major)).toEqual({played:[71,74],filtered:[75,78]});
  });
  it('keeps lead pitch separate from scale root and handles negative offsets',()=>{
    expect(chordAt(64,[-4,0,3,7],2,major)).toEqual({played:[64,67,71],filtered:[60]});
  });
  it('does not generate invalid MIDI pitches or duplicate voices',()=>{
    expect(chordAt(126,[-127,0,0,1,4],0,[0,1,2,3,4,5,6,7,8,9,10,11])).toEqual({played:[126,127],filtered:[]});
  });
  it('maps both axes independently and repeats exact pitches',()=>{
    expect(gridPitch(0,0,48,4,3)).toBe(48);
    expect(gridPitch(3,0,48,4,3)).toBe(60);
    expect(gridPitch(0,4,48,4,3)).toBe(60);
    expect(gridPitch(6,0,48,2,1)).toBe(60);
    expect(gridPitch(30,0,48,4,3)).toBeNull();
  });
});
