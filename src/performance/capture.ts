/*! Copyright (c) 2026 Ethan Joffe */
import {pitchClass, validPitch} from './harmony';

export class PitchCapture {
  reference: number | null = null;
  pitches: number[] = [];
  select(pitch: number): void {
    if (!validPitch(pitch)) return;
    this.reference ??= pitch;
    this.pitches = this.pitches.includes(pitch)
      ? this.pitches.filter(p => p !== pitch)
      : [...this.pitches, pitch].sort((a,b)=>a-b);
  }
  chord(): number[] { return this.pitches.map(pitch => pitch - (this.reference ?? 0)); }
  mode(): number[] { return [...new Set(this.chord().map(pitchClass))].sort((a,b)=>a-b); }
}

/** Place a saved relative pattern inside MIDI without changing its fixed reference. */
export function captureSeed(notes:number[]):{reference:number;pitches:number[]}{
  const min=Math.min(0,...notes),max=Math.max(0,...notes);
  if(max-min>127)throw Error('This pattern spans more than the MIDI range. Edit its intervals directly.');
  const reference=Math.max(-min,Math.min(60,127-max));
  return {reference,pitches:notes.map(n=>n+reference)};
}
