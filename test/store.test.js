// Store tests: persistence, undo depth, export/import (M6 accept criteria).
'use strict';
const assert = require('assert');

function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

(async () => {
  const { createStore, MACHINE_KEYS } = await import('../js/store.js');
  const { CFG } = await import('../js/config.js');

  // --- fresh profile seeds from presets and persists immediately ---
  {
    const storage = fakeStorage();
    const store = createStore(storage);
    const s = store.getState();
    for (const k of MACHINE_KEYS) {
      assert.strictEqual(s.patterns[k].length, 1, `${k} seeds with one preset pattern`);
      assert.strictEqual(store.activePattern(k).id, s.active[k], `${k} active id resolves`);
    }
    assert.ok(storage.data[CFG.STORAGE_KEY], 'seed state persisted to storage');
    console.log('PASS fresh profile seeds presets and persists');
  }

  // --- edits persist across a "refresh" (new store over same storage) ---
  {
    const storage = fakeStorage();
    const store1 = createStore(storage);
    store1.edit((s) => { store1.activePattern('303a').steps[0].g = 0; });
    store1.setNoUndo((s) => { s.tempo = 155; s.patches['303a'] = { cutoff: 1234 }; });

    const store2 = createStore(storage); // simulated refresh
    assert.strictEqual(store2.activePattern('303a').steps[0].g, 0, 'pattern edit survived refresh');
    assert.strictEqual(store2.getState().tempo, 155, 'tempo survived refresh');
    assert.strictEqual(store2.getState().patches['303a'].cutoff, 1234, 'patch survived refresh');
    console.log('PASS refresh restores patterns, tempo, and patches');
  }

  // --- undo reverses the last 20+ edits; patches/tempo are NOT undone ---
  {
    const storage = fakeStorage();
    const store = createStore(storage);
    const pat = () => store.activePattern('303a');
    const originalNote = pat().steps[0].n;

    for (let i = 0; i < 25; i++) {
      store.edit(() => { pat().steps[0].n = 40 + i; });
    }
    store.setNoUndo((s) => { s.tempo = 180; });

    let undos = 0;
    while (store.canUndo()) { store.undo(); undos++; }
    assert.ok(undos >= 20, `undo depth covers the accept criterion (got ${undos})`);
    assert.strictEqual(undos, CFG.UNDO_DEPTH >= 25 ? 25 : CFG.UNDO_DEPTH, 'stack capped at UNDO_DEPTH');
    // 25 edits, all undone (depth 50) -> back to the original note.
    assert.strictEqual(pat().steps[0].n, originalNote, 'undo walked back to the original');
    assert.strictEqual(store.getState().tempo, 180, 'tempo untouched by undo');
    console.log(`PASS undo: ${undos} sequential undos, transport untouched`);
  }

  // --- export re-imports on a clean profile ---
  {
    const storageA = fakeStorage();
    const storeA = createStore(storageA);
    storeA.edit((s) => {
      const dup = structuredClone(storeA.activePattern('808'));
      dup.id = 'dup-1';
      dup.name = 'Groove copy';
      s.patterns['808'].push(dup);
      s.active['808'] = 'dup-1';
    });
    const exported = storeA.exportJSON();

    const storageB = fakeStorage(); // clean profile
    const storeB = createStore(storageB);
    storeB.importJSON(exported);
    assert.strictEqual(storeB.getState().patterns['808'].length, 2, 'imported both 808 patterns');
    assert.strictEqual(storeB.activePattern('808').name, 'Groove copy', 'imported active selection');
    console.log('PASS export/import roundtrip on a clean profile');
  }

  // --- loadRig is a full-rig undo: tempo, patches, mixer AND patterns come back ---
  {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.setNoUndo((s) => { s.tempo = 100; s.patches['303a'] = { cutoff: 777 }; s.mixer.channels['303a'].delay = true; });
    const before = { tempo: store.getState().tempo, cutoff: store.getState().patches['303a'].cutoff, delay: store.getState().mixer.channels['303a'].delay };

    store.loadRig({
      version: 1, tempo: 150, shuffle: 0, patches: { '303a': { cutoff: 111 } },
      mixer: undefined, // normalized to defaults (dist/delay off)
      patterns: store.getState().patterns, active: store.getState().active, song: store.getState().song,
    });
    assert.strictEqual(store.getState().tempo, 150, 'loadRig applied new tempo');
    assert.strictEqual(store.getState().mixer.channels['303a'].delay, false, 'loadRig reset mixer to defaults');

    assert.ok(store.undo(), 'loadRig is undoable');
    assert.strictEqual(store.getState().tempo, before.tempo, 'undo restored tempo');
    assert.strictEqual(store.getState().patches['303a'].cutoff, before.cutoff, 'undo restored patches');
    assert.strictEqual(store.getState().mixer.channels['303a'].delay, before.delay, 'undo restored mixer send');
    console.log('PASS loadRig undo restores the whole prior rig');
  }

  // --- incremental edit undo still leaves tempo/patches/mixer untouched ---
  {
    const storage = fakeStorage();
    const store = createStore(storage);
    store.setNoUndo((s) => { s.tempo = 123; s.mixer.channels['808'].mute = true; });
    store.edit((s) => { store.activePattern('303a').steps[0].n = 60; });
    store.undo();
    assert.strictEqual(store.getState().tempo, 123, 'edit-undo leaves tempo alone');
    assert.strictEqual(store.getState().mixer.channels['808'].mute, true, 'edit-undo leaves mixer alone');
    console.log('PASS incremental edit undo does not touch transport/mixer');
  }

  // --- bad imports throw and leave state intact; corrupt storage falls back to seed ---
  {
    const storage = fakeStorage();
    const store = createStore(storage);
    const before = JSON.stringify(store.getState());
    assert.throws(() => store.importJSON('{"nope": true}'), /not a SQUELCH pattern file/);
    assert.throws(() => store.importJSON('garbage{{{'));
    assert.strictEqual(JSON.stringify(store.getState()), before, 'state untouched after failed imports');

    const corrupt = fakeStorage();
    corrupt.setItem((await import('../js/config.js')).CFG.STORAGE_KEY, '{{{corrupt');
    const recovered = createStore(corrupt);
    assert.strictEqual(recovered.getState().patterns['303a'].length, 1, 'corrupt storage falls back to seed');
    console.log('PASS bad imports rejected, corrupt storage recovers to seed');
  }

  console.log('\nAll store tests passed.');
})();
