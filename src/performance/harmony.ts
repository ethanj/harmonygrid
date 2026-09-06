export const pitchClass = (pitch: number): number => ((pitch % 12) + 12) % 12;
export const validPitch = (pitch: number): boolean => Number.isInteger(pitch) && pitch >= 0 && pitch <= 127;

export function chordAt(lead: number, offsets: readonly number[], root: number, mode: readonly number[]): {played: number[]; filtered: number[]} {
  const played: number[] = [], filtered: number[] = [];
  const pitches = [...new Set(offsets.map(offset => lead + offset))].filter(validPitch).sort((a,b)=>a-b);
  for (const pitch of pitches) (mode.includes(pitchClass(pitch-root)) ? played : filtered).push(pitch);
  return {played, filtered};
}
export function gridPitch(column: number, rowFromBottom: number, base: number, horizontal: number, vertical: number): number | null {
  const pitch = base + column * horizontal + rowFromBottom * vertical;
  return validPitch(pitch) ? pitch : null;
}
