// Demo library tests: every full-rig demo (and the blank rig) must build a
// state the store accepts, with a song arrangement that only references
// patterns that exist. No DOM/audio — pure data, runs in Node.
'use strict';
const assert = require('assert');

function fakeStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

(async () => {
  const { DEMO_LIBRARY, buildDemoState, buildBlankState } = await import('../js/demoLibrary.js');
  const { createStore, MACHINE_KEYS } = await import('../js/store.js');
  const { CFG } = await import('../js/config.js');

  const checkState = (state, label) => {
    // Structure the store's validate() requires.
    assert.strictEqual(state.version, 1, `${label}: version 1`);
    assert.ok(state.tempo >= CFG.TEMPO_MIN_BPM && state.tempo <= CFG.TEMPO_MAX_BPM, `${label}: tempo in range (${state.tempo})`);
    for (const k of MACHINE_KEYS) {
      assert.strictEqual(state.patterns[k].length, 1, `${label}: ${k} has one pattern`);
      assert.ok(state.patterns[k].some((p) => p.id === state.active[k]), `${label}: ${k} active id resolves`);
    }
    // Song rows may only reference an existing pattern id (or null) per machine.
    assert.ok(Array.isArray(state.song.rows) && state.song.rows.length > 0, `${label}: song has rows`);
    for (const [ri, row] of state.song.rows.entries()) {
      for (const k of MACHINE_KEYS) {
        const ref = row.pats[k];
        if (ref !== null) {
          assert.ok(state.patterns[k].some((p) => p.id === ref), `${label}: row ${ri} ${k} ref exists`);
        }
        assert.ok(k in row.pats, `${label}: row ${ri} names ${k}`);
      }
      assert.ok(row.repeat >= 1, `${label}: row ${ri} repeat >= 1`);
    }
    // The store accepts it via loadRig (exercises validate()).
    const store = createStore(fakeStorage());
    assert.doesNotThrow(() => store.loadRig(state), `${label}: store.loadRig accepts it`);
  };

  for (const demo of DEMO_LIBRARY) {
    const state = buildDemoState(demo);
    checkState(state, demo.name);
    // Every demo populates a distinct 303 sound (patch) on both synths.
    assert.ok(state.patches['303a'] && state.patches['303a'].waveform, `${demo.name}: 303a patch present`);
    assert.ok(state.patches['303b'] && state.patches['303b'].waveform, `${demo.name}: 303b patch present`);
  }
  console.log(`PASS ${DEMO_LIBRARY.length} demos build valid, loadable rig states`);

  // Blank rig: valid, empty, default tempo.
  const blank = buildBlankState();
  checkState(blank, 'blank');
  assert.strictEqual(blank.tempo, CFG.TEMPO_DEFAULT_BPM, 'blank uses default tempo');
  for (const k of ['303a', '303b']) {
    assert.ok(blank.patterns[k][0].steps.every((s) => s.g === 0), `blank ${k} has no gated steps`);
  }
  for (const k of ['808', '909']) {
    for (const lane of Object.values(blank.patterns[k][0].lanes)) {
      assert.ok(lane.every((s) => s.h === 0), `blank ${k} has no hits`);
    }
  }
  console.log('PASS blank rig is valid and empty');

  // Ids must be unique within a demo (song refs would be ambiguous otherwise).
  for (const demo of DEMO_LIBRARY) {
    const state = buildDemoState(demo);
    const ids = MACHINE_KEYS.map((k) => state.patterns[k][0].id);
    assert.strictEqual(new Set(ids).size, ids.length, `${demo.name}: pattern ids unique`);
  }
  console.log('PASS demo pattern ids are unique');

  // Fresh profile now seeds from the first demo (not a blank rig).
  const seeded = createStore(fakeStorage()).getState();
  assert.strictEqual(seeded.tempo, DEMO_LIBRARY[0].tempo, 'fresh profile seeds the starter demo tempo');

  console.log('\nAll demoLibrary tests passed.');
})();
