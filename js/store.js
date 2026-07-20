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

export const MACHINE_KEYS = ['303a', '303b', '808', '909'];

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
  const pushUndo = () => {
    undoStack.push(structuredClone({ patterns: state.patterns, active: state.active, song: state.song }));
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
      Object.assign(state, undoStack.pop()); // patterns+active only; patches/transport stay current
      save();
      return true;
    },
    exportJSON: () => JSON.stringify(state, null, 2),
    importJSON(text) {
      const parsed = JSON.parse(text); // throws on malformed JSON
      if (!validate(parsed)) throw new Error('not a SQUELCH pattern file');
      pushUndo();
      state = normalize(parsed);
      save();
    },
    // Replace the whole rig (load a full demo, or the blank slate). Undoable
    // like import — undo restores the previous patterns/active/song (tempo and
    // patches follow import's semantics: they stay at the loaded values).
    loadRig(newState) {
      const norm = normalize(structuredClone(newState));
      if (!validate(norm)) throw new Error('invalid rig state');
      pushUndo();
      state = norm;
      save();
    },
  };
}
