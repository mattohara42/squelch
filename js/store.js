// M6 state store: named pattern lists per machine, active selection, machine
// patches (knob state), transport settings. Persists to injected storage
// (localStorage in the browser) on every change; global undo stack over
// pattern edits. Pure data — no DOM, no audio — so it's unit-testable in
// Node (test/store.test.js).
//
// Undo covers patterns + active selection only. Knob moves (patches) and
// tempo/shuffle go through setNoUndo: they're performance gestures, not
// edits, and undoing a step toggle shouldn't yank the filter knob back.
import { CFG } from './config.js';
import { DEMO_LIBRARY, buildDemoState } from './demoLibrary.js';
import { defaultMixerState } from './mixerState.js';

export const MACHINE_KEYS = ['303a', '303b', '808', '909'];

// Incremental edits snapshot only pattern data (undoing a step toggle must not
// yank a filter sweep or tempo back — M6). A whole-rig swap (load demo, blank,
// import) snapshots everything, so undo restores the entire prior rig.
const EDIT_KEYS = ['patterns', 'active', 'song'];
const RIG_KEYS = ['patterns', 'active', 'song', 'tempo', 'shuffle', 'patches', 'mixer'];

// A brand-new profile opens on a full starter demo (immediate music), rather
// than a blank rig — the "New Rig" button is the one-click path to blank.
function seedState() {
  return buildDemoState(DEMO_LIBRARY[0]);
}

function validate(s) {
  if (!s || s.version !== 1 || !s.patterns || !s.active) return false;
  return MACHINE_KEYS.every((k) =>
    Array.isArray(s.patterns[k]) && s.patterns[k].length > 0 &&
    s.patterns[k].some((p) => p.id === s.active[k]));
}

function normalize(s) {
  if (s.patches == null) s.patches = {};
  if (s.tempo == null) s.tempo = CFG.TEMPO_DEFAULT_BPM;
  if (s.shuffle == null) s.shuffle = 0;
  // Song backfill (M7): older saves/exports predate song mode. Seed one row
  // referencing each machine's active pattern. Locked data model per SPEC.md:
  // { rows: [{ pats: { '303a': id|null, ... }, repeat: n }], loop }.
  if (s.song == null || !Array.isArray(s.song.rows)) {
    s.song = {
      rows: [{ pats: Object.fromEntries(MACHINE_KEYS.map((k) => [k, s.active[k]])), repeat: 1 }],
      loop: true,
    };
  }
  if (s.song.loop == null) s.song.loop = true;
  // Mixer backfill: older saves/exports predate persisted mixer state.
  if (s.mixer == null) s.mixer = defaultMixerState();
  return s;
}

export function createStore(storage) {
  let state;
  try {
    const parsed = JSON.parse(storage.getItem(CFG.STORAGE_KEY));
    state = normalize(validate(parsed) ? parsed : seedState());
  } catch {
    state = normalize(seedState());
  }

  const undoStack = [];
  const save = () => storage.setItem(CFG.STORAGE_KEY, JSON.stringify(state));
  const pushUndo = (keys = EDIT_KEYS) => {
    const snap = {};
    for (const k of keys) snap[k] = structuredClone(state[k]);
    undoStack.push(snap);
    if (undoStack.length > CFG.UNDO_DEPTH) undoStack.shift();
  };
  save(); // ensure freshly-seeded state is persisted immediately

  return {
    getState: () => state,
    activePattern(machineKey) {
      return state.patterns[machineKey].find((p) => p.id === state.active[machineKey]);
    },
    // Pattern edit: snapshot for undo, mutate, persist.
    edit(mutate) {
      pushUndo();
      mutate(state);
      save();
    },
    // Non-undoable change (patches, tempo/shuffle): mutate + persist only.
    setNoUndo(mutate) {
      mutate(state);
      save();
    },
    canUndo: () => undoStack.length > 0,
    undo() {
      if (!undoStack.length) return false;
      Object.assign(state, undoStack.pop()); // restores exactly the keys snapshotted for this entry
      save();
      return true;
    },
    exportJSON: () => JSON.stringify(state, null, 2),
    importJSON(text) {
      const parsed = JSON.parse(text); // throws on malformed JSON
      if (!validate(parsed)) throw new Error('not a SQUELCH pattern file');
      pushUndo(RIG_KEYS); // whole-rig swap -> full-rig undo
      state = normalize(parsed);
      save();
    },
    // Replace the whole rig (load a full demo, or the blank slate). Fully
    // undoable: the RIG_KEYS snapshot restores patterns, tempo, patches, and
    // mixer together, so one Undo puts the previous rig back exactly.
    loadRig(newState) {
      const norm = normalize(structuredClone(newState));
      if (!validate(norm)) throw new Error('invalid rig state');
      pushUndo(RIG_KEYS);
      state = norm;
      save();
    },
  };
}
