// Pure helpers for the 303 piano-roll: map an absolute MIDI note to a
// (pitch-class row, octave offset) relative to a base, and back. The note
// stays absolute in the data model (n) — this is only for display/editing.
export function pitchClassOf(n, base) {
  return (((n - base) % 12) + 12) % 12; // 0..11, always positive
}
export function octaveOffsetOf(n, base) {
  return Math.floor((n - base) / 12); // ...,-1,0,+1,... relative to base octave
}
export function noteFrom(pitchClass, octave, base) {
  return base + octave * 12 + pitchClass;
}
export function clampNote(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
