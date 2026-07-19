// Pitch <-> row/octave round-trip and edge cases for the 303 piano-roll.
'use strict';
const assert = require('assert');

(async () => {
  const { pitchClassOf, octaveOffsetOf, noteFrom, clampNote } = await import('../js/pitch.js');
  const BASE = 24; // C1

  // Round-trip: every note reconstructs from its pitch class + octave offset.
  for (let n = 0; n <= 96; n++) {
    const pc = pitchClassOf(n, BASE);
    const oct = octaveOffsetOf(n, BASE);
    assert.ok(pc >= 0 && pc < 12, `pitch class in range for ${n} (got ${pc})`);
    assert.strictEqual(noteFrom(pc, oct, BASE), n, `round-trips note ${n}`);
  }
  console.log('PASS round-trip: pitchClass + octave rebuild the note for 0..96');

  // Known values against base C1 (24): A1=33, C2=36, E3=52.
  assert.strictEqual(pitchClassOf(33, BASE), 9, 'A1 pitch class = 9 (A)');
  assert.strictEqual(octaveOffsetOf(33, BASE), 0, 'A1 sits in the base octave');
  assert.strictEqual(octaveOffsetOf(36, BASE), 1, 'C2 is one octave up from C1');
  assert.strictEqual(octaveOffsetOf(52, BASE), 2, 'E3 is two octaves up');
  assert.strictEqual(pitchClassOf(52, BASE), 4, 'E3 pitch class = 4 (E)');
  console.log('PASS known values: A1/C2/E3 map to expected row+octave');

  // Octave bump preserves pitch class, shifts by 12.
  const bumped = clampNote(33 + 12, 20, 72);
  assert.strictEqual(pitchClassOf(bumped, BASE), pitchClassOf(33, BASE), 'octave bump keeps pitch class');
  assert.strictEqual(bumped, 45, 'A1 + one octave = A2');

  // Clamp holds the range.
  assert.strictEqual(clampNote(10, 20, 72), 20, 'clamps below min');
  assert.strictEqual(clampNote(90, 20, 72), 72, 'clamps above max');
  console.log('PASS octave bump keeps pitch class; clamp holds [20,72]');

  console.log('\nAll pitch tests passed.');
})();
