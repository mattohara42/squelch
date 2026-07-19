// Song conductor tests: row advancement on bar boundaries, repeats, loop,
// end-of-song stop, reset on transport stop (M7).
'use strict';
const assert = require('assert');

(async () => {
  const { createSongConductor } = await import('../js/songConductor.js');

  function harness(song, { songMode = true } = {}) {
    const events = [];
    let stopRequested = false;
    const c = createSongConductor({
      getSong: () => song,
      isSongMode: () => songMode,
      onRowChange: (row, time) => events.push({ row, time }),
      requestStop: () => { stopRequested = true; },
    });
    // Simulate N bars: step 0 fires once per bar (other steps are irrelevant).
    const playBars = (n, t0 = 0) => {
      for (let bar = 0; bar < n; bar++) {
        c.onStep(0, t0 + bar);
        for (const s of [4, 8, 12]) c.onStep(s, t0 + bar + s / 16); // non-boundary steps: no-ops
      }
    };
    return { c, events, playBars, wasStopRequested: () => stopRequested };
  }

  const row = (id, repeat) => ({ pats: { '303a': id, '303b': null, '808': `${id}-dr`, '909': null }, repeat });

  // --- repeats and row order ---
  {
    const song = { rows: [row('A', 2), row('B', 1), row('C', 3)], loop: false };
    const { c, events, playBars } = harness(song);
    playBars(6); // A A B C C C
    assert.deepStrictEqual(events.map((e) => e.row), [0, 1, 2], 'row changes fire once per row, honoring repeats');
    assert.strictEqual(c.currentPatternId('303a'), 'C', 'row 2 pattern id');
    assert.strictEqual(c.currentPatternId('303b'), null, 'null pattern ref reads as silent');
    assert.strictEqual(c.currentPatternId('808'), 'C-dr', 'per-machine refs are independent');
    console.log('PASS repeats: A A B C C C row sequence');
  }

  // --- loop off: stop requested after the last bar, not before ---
  {
    const song = { rows: [row('A', 1), row('B', 1)], loop: false };
    const { events, playBars, wasStopRequested } = harness(song);
    playBars(2);
    assert.strictEqual(wasStopRequested(), false, 'no stop while rows remain');
    playBars(1, 100); // the bar after B's last: end of song
    assert.strictEqual(wasStopRequested(), true, 'stop requested after the final row completes');
    assert.deepStrictEqual(events.map((e) => e.row), [0, 1], 'no extra row change at the end');
    console.log('PASS loop off: stops exactly after the last row');
  }

  // --- loop on: wraps back to row 0 ---
  {
    const song = { rows: [row('A', 1), row('B', 1)], loop: true };
    const { events, playBars, wasStopRequested } = harness(song);
    playBars(5); // A B A B A
    assert.deepStrictEqual(events.map((e) => e.row), [0, 1, 0, 1, 0], 'loops seamlessly');
    assert.strictEqual(wasStopRequested(), false, 'never stops while looping');
    console.log('PASS loop on: A B A B A wraparound');
  }

  // --- transport stop resets; next play starts at row 0 ---
  {
    const song = { rows: [row('A', 1), row('B', 1)], loop: true };
    const { c, events, playBars } = harness(song);
    playBars(2); // now on row B
    c.onStop();
    assert.strictEqual(events[events.length - 1].row, -1, 'stop clears the playing-row indicator');
    playBars(1, 50);
    assert.strictEqual(events[events.length - 1].row, 0, 'restart begins at row 0');
    console.log('PASS stop resets to row 0');
  }

  // --- pattern mode: conductor is inert ---
  {
    const song = { rows: [row('A', 1)], loop: true };
    const { events, playBars } = harness(song, { songMode: false });
    playBars(4);
    assert.strictEqual(events.length, 0, 'no row changes in pattern mode');
    console.log('PASS pattern mode: conductor inert');
  }

  console.log('\nAll song conductor tests passed.');
})();
