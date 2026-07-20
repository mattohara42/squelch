// Full-rig demos: one click loads a whole track — tempo + a pattern for every
// machine + matched 303 patches + a song arrangement. Original patterns written
// in the STYLE of classic genres (not transcriptions of copyrighted songs), per
// the no-copying rule in CLAUDE.md. Pure data + builders (no DOM, no audio) so
// it's unit-testable in Node (test/demoLibrary.test.js).
//
// A demo's build() makes one named pattern per machine (fresh ids); rows() wires
// a song arrangement that references those ids, using null to DROP a machine for
// a section (intro = drums only, break = 303s only, etc.). In Pattern view all
// four active patterns play at once (the full groove); Song view plays the
// arrangement. Ear-test on the Mac mini is the final gate for the sound.
import { CFG } from './config.js';
import { LANE_ORDER_808 } from './presetsDrum.js';
import { LANE_ORDER_909 } from './presetsDrum909.js';

// Local copy of the machine keys to avoid a circular import with store.js
// (store.js imports this module for its seed).
const MACHINE_KEYS = ['303a', '303b', '808', '909'];
const LANES = { '808': LANE_ORDER_808, '909': LANE_ORDER_909 };

// MIDI-ish note map, consistent with presetLibrary.js (PIANO_BASE_MIDI = 24/C1).
const N = {
  D1: 26, E1: 28, F1: 29, G1: 31, GS1: 32, A1: 33, AS1: 34, B1: 35,
  C2: 36, CS2: 37, D2: 38, DS2: 39, E2: 40, F2: 41, FS2: 42, G2: 43, GS2: 44, A2: 45,
  C3: 48, D3: 50, E3: 52,
};
const _ = [N.A1, 0, 0, 0]; // rest (gate off)

function line303(machineKey, name, tuples) {
  return {
    id: crypto.randomUUID(), name, machine: machineKey,
    steps: tuples.map(([n, g, a, s]) => ({ n, g, a: a || 0, s: s || 0 })),
  };
}

function beat(machineKey, name, spec) {
  const lanes = {};
  for (const lane of LANES[machineKey]) {
    const steps = Array.from({ length: CFG.STEPS_PER_PATTERN }, () => ({ h: 0, a: 0 }));
    const s = spec[lane];
    if (s) {
      for (const i of s.h || []) steps[i].h = 1;
      for (const i of s.a || []) steps[i].a = 1;
    }
    lanes[lane] = steps;
  }
  return { id: crypto.randomUUID(), name, machine: machineKey, lanes };
}

// Standard four-section arrangement built from the single pattern per machine:
// intro (drums), bass in, full, break (303s only). `lead`/`other` are the two
// drum keys — lead carries the groove, other is a lighter layer.
function arrangement(p, lead, other) {
  const a = p['303a'].id, b = p['303b'].id;
  const L = p[lead].id, O = p[other].id;
  const row = (pats, repeat) => ({
    pats: Object.fromEntries(MACHINE_KEYS.map((k) => [k, k in pats ? pats[k] : null])),
    repeat,
  });
  return [
    row({ [lead]: L, [other]: O }, 2),                       // intro: drums only
    row({ '303a': a, [lead]: L, [other]: O }, 2),            // bass drops in
    row({ '303a': a, '303b': b, [lead]: L, [other]: O }, 4), // full groove
    row({ '303a': a, '303b': b }, 2),                        // break: 303s only
  ];
}

export const DEMO_LIBRARY = [
  {
    name: 'Detroit House',
    tempo: 124, shuffle: 0, lead: '909', other: '808',
    build: () => ({
      patterns: {
        '303a': line303('303a', 'Deep Bass', [
          [N.A1, 1, 1, 0], _, _, [N.A1, 1, 0, 0],
          _, [N.C2, 1, 1, 0], _, _,
          [N.A1, 1, 1, 0], _, [N.E2, 1, 0, 0], _,
          [N.D2, 1, 1, 0], _, [N.C2, 1, 0, 0], _,
        ]),
        '303b': line303('303b', 'Chord Stab', [
          _, _, [N.A2, 1, 1, 0], _,
          _, _, [N.C3, 1, 1, 0], _,
          _, _, [N.E2, 1, 1, 0], _,
          _, _, [N.A2, 1, 0, 0], _,
        ]),
        '909': beat('909', 'House Kit', {
          bd: { h: [0, 4, 8, 12], a: [0, 8] }, cp: { h: [4, 12] },
          oh: { h: [2, 6, 10, 14] }, ch: { h: [0, 4, 8, 12] },
        }),
        '808': beat('808', 'Rim Ticks', { rs: { h: [3, 7, 11, 15] } }),
      },
      patches: {
        '303a': { waveform: 'square', tuning: 0, cutoff: 520, resonance: 0.5, envMod: 0.45, decay: 320, accent: 0.7, volume: 0.88 },
        '303b': { waveform: 'saw', tuning: 0, cutoff: 1100, resonance: 0.6, envMod: 0.5, decay: 260, accent: 0.75, volume: 0.8 },
      },
    }),
  },
  {
    name: 'Classic Hip Hop',
    tempo: 90, shuffle: 0.18, lead: '808', other: '909',
    build: () => ({
      patterns: {
        '303a': line303('303a', 'Sub Bass', [
          [N.E1, 1, 1, 0], _, _, _,
          [N.E1, 1, 0, 0], _, [N.G1, 1, 0, 0], _,
          [N.A1, 1, 1, 0], _, _, [N.E1, 1, 0, 0],
          _, [N.D1, 1, 0, 0], _, _,
        ]),
        '303b': line303('303b', 'Muted Lick', [
          _, _, _, _,
          _, _, [N.E2, 1, 1, 0], _,
          _, _, _, _,
          _, _, [N.C2, 1, 0, 1], _,
        ]),
        '808': beat('808', 'Boom Bap', {
          bd: { h: [0, 10], a: [0] }, sd: { h: [4, 12], a: [4, 12] },
          ch: { h: [0, 2, 4, 6, 8, 10, 12, 14], a: [0, 8] }, oh: { h: [7] },
        }),
        '909': beat('909', 'Ghost Hats', { ch: { h: [3, 11] } }),
      },
      patches: {
        '303a': { waveform: 'square', tuning: -12, cutoff: 260, resonance: 0.35, envMod: 0.3, decay: 900, accent: 0.5, volume: 0.9 },
        '303b': { waveform: 'saw', tuning: 0, cutoff: 900, resonance: 0.55, envMod: 0.5, decay: 300, accent: 0.7, volume: 0.75 },
      },
    }),
  },
  {
    name: 'Acid Techno',
    tempo: 135, shuffle: 0, lead: '909', other: '808',
    build: () => ({
      patterns: {
        '303a': line303('303a', 'Screamer', [
          [N.A1, 1, 1, 1], [N.A2, 1, 1, 0], [N.A1, 1, 0, 1], [N.C3, 1, 1, 0],
          [N.A1, 1, 0, 1], [N.E3, 1, 1, 0], [N.A2, 1, 0, 1], [N.A1, 1, 1, 0],
          [N.A1, 1, 1, 1], [N.A2, 1, 1, 0], [N.C2, 1, 0, 1], [N.E2, 1, 1, 0],
          [N.A2, 1, 0, 1], [N.A1, 1, 1, 0], [N.G2, 1, 0, 1], [N.A1, 1, 1, 0],
        ]),
        '303b': line303('303b', 'Rolling Sub', [
          [N.A1, 1, 1, 0], [N.A1, 1, 0, 1], [N.A1, 1, 0, 0], [N.A1, 1, 0, 0],
          [N.A1, 1, 1, 0], [N.A1, 1, 0, 1], [N.A1, 1, 0, 0], [N.A1, 1, 0, 0],
          [N.G1, 1, 1, 0], [N.G1, 1, 0, 1], [N.G1, 1, 0, 0], [N.G1, 1, 0, 0],
          [N.A1, 1, 1, 0], [N.A1, 1, 0, 1], [N.C2, 1, 0, 0], [N.C2, 1, 0, 0],
        ]),
        '909': beat('909', 'Driving', {
          bd: { h: [0, 4, 8, 12], a: [0, 4, 8, 12] }, cp: { h: [4, 12] },
          oh: { h: [2, 6, 10, 14] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14] }, cc: { h: [0] },
        }),
        '808': beat('808', 'Rim Layer', { rs: { h: [2, 6, 10, 14] } }),
      },
      patches: {
        '303a': { waveform: 'saw', tuning: 0, cutoff: 1600, resonance: 0.92, envMod: 0.88, decay: 280, accent: 0.95, volume: 0.8 },
        '303b': { waveform: 'square', tuning: 0, cutoff: 400, resonance: 0.4, envMod: 0.35, decay: 200, accent: 0.6, volume: 0.85 },
      },
    }),
  },
  {
    name: 'Electro / Miami Bass',
    tempo: 110, shuffle: 0, lead: '808', other: '909',
    build: () => ({
      patterns: {
        '303a': line303('303a', 'Funk Bass', [
          [N.A1, 1, 1, 0], _, [N.A1, 1, 0, 0], [N.A1, 1, 0, 1],
          _, [N.C2, 1, 1, 0], _, [N.A1, 1, 0, 0],
          [N.A1, 1, 1, 0], _, [N.E2, 1, 0, 0], _,
          [N.D2, 1, 0, 1], [N.C2, 1, 0, 0], _, [N.A1, 1, 0, 0],
        ]),
        '303b': line303('303b', 'Zap', [
          _, _, _, [N.A2, 1, 1, 0],
          _, _, _, _,
          [N.C3, 1, 1, 1], _, _, _,
          _, [N.E2, 1, 0, 0], _, _,
        ]),
        '808': beat('808', 'Electro', {
          bd: { h: [0, 3, 6, 8, 11, 14], a: [0, 8] }, cp: { h: [4, 12] },
          cb: { h: [2, 10] }, oh: { h: [7] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14] },
        }),
        '909': beat('909', 'Rim Layer', { rs: { h: [7, 15] } }),
      },
      patches: {
        '303a': { waveform: 'square', tuning: 0, cutoff: 560, resonance: 0.55, envMod: 0.5, decay: 300, accent: 0.7, volume: 0.88 },
        '303b': { waveform: 'saw', tuning: 12, cutoff: 1300, resonance: 0.7, envMod: 0.55, decay: 220, accent: 0.9, volume: 0.75 },
      },
    }),
  },
];

// Turn a demo into a full, valid store state (version 1). One pattern per
// machine, active = that pattern, patches applied, tempo/shuffle set, and the
// song arrangement wired to the freshly-built pattern ids.
export function buildDemoState(demo) {
  const built = demo.build();
  const patterns = {}, active = {}, patches = {};
  for (const k of MACHINE_KEYS) {
    patterns[k] = [built.patterns[k]];
    active[k] = built.patterns[k].id;
    if (built.patches && built.patches[k]) patches[k] = { ...built.patches[k] };
  }
  return {
    version: 1,
    tempo: demo.tempo,
    shuffle: demo.shuffle || 0,
    patterns, active, patches,
    song: { rows: arrangement(built.patterns, demo.lead, demo.other), loop: true },
  };
}

// A completely blank rig: one empty pattern per machine, default patches
// (empty -> panels use their defaults), default tempo, one song row.
export function buildBlankState() {
  const patterns = {}, active = {};
  for (const k of MACHINE_KEYS) {
    let p;
    if (k === '303a' || k === '303b') {
      p = {
        id: crypto.randomUUID(), name: 'Pattern 1', machine: k,
        steps: Array.from({ length: CFG.STEPS_PER_PATTERN }, () => ({ n: N.A1, g: 0, a: 0, s: 0 })),
      };
    } else {
      const lanes = {};
      for (const lane of LANES[k]) lanes[lane] = Array.from({ length: CFG.STEPS_PER_PATTERN }, () => ({ h: 0, a: 0 }));
      p = { id: crypto.randomUUID(), name: 'Pattern 1', machine: k, lanes };
    }
    patterns[k] = [p];
    active[k] = p.id;
  }
  return {
    version: 1,
    tempo: CFG.TEMPO_DEFAULT_BPM,
    shuffle: 0,
    patterns, active, patches: {},
    song: { rows: [{ pats: Object.fromEntries(MACHINE_KEYS.map((k) => [k, active[k]])), repeat: 1 }], loop: true },
  };
}
