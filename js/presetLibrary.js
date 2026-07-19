// Preset pattern/patch library (demos) — original patterns written in the
// style of classic genres (not transcriptions of copyrighted songs). Each
// entry is { name, create() } where create() returns a fresh pattern (new id,
// deep-copied steps) plus, for the 303, a knob `patch` so loading a preset
// dials in the SOUND as well as the notes.

const N = { A1: 33, AS1: 34, B1: 35, C2: 36, CS2: 37, D2: 38, DS2: 39, E2: 40, F2: 41, G2: 43, A2: 45, C3: 48, E3: 52, E1: 28, F1: 29, G1: 31, A0: 21, D1: 26 };
function line(tuples) {
  return tuples.map(([n, g, a, s]) => ({ n, g, a: a || 0, s: s || 0 }));
}
const _ = [N.A1, 0, 0, 0]; // rest

// 303 presets: a matched knob patch + a 16-step acid line.
const PATCHES_303 = [
  {
    name: 'Chicago Acid',
    patch: { waveform: 'saw', tuning: 0, cutoff: 1100, resonance: 0.78, envMod: 0.72, decay: 420, accent: 0.85, volume: 0.85 },
    steps: line([
      [N.A1, 1, 1, 0], [N.A1, 1, 0, 1], [N.A2, 1, 0, 0], _,
      [N.A1, 1, 1, 0], [N.C2, 1, 0, 1], [N.A1, 1, 0, 0], [N.E2, 1, 0, 0],
      [N.A1, 1, 1, 0], [N.A1, 1, 0, 1], [N.A2, 1, 0, 0], [N.G2, 1, 0, 0],
      [N.A1, 1, 1, 0], [N.C2, 1, 0, 1], [N.E2, 1, 0, 0], [N.A1, 1, 0, 0],
    ]),
  },
  {
    name: 'Deep Sub',
    patch: { waveform: 'square', tuning: -12, cutoff: 260, resonance: 0.35, envMod: 0.3, decay: 900, accent: 0.45, volume: 0.9 },
    steps: line([
      [N.E1, 1, 1, 0], _, [N.E1, 1, 0, 1], _,
      [N.E1, 1, 0, 0], _, [N.G1, 1, 1, 0], _,
      [N.E1, 1, 1, 0], _, [N.E1, 1, 0, 1], [N.A1, 1, 0, 0],
      [N.E1, 1, 0, 0], _, [N.C2, 1, 1, 0], _,
    ]),
  },
  {
    name: 'Screamer',
    patch: { waveform: 'saw', tuning: 0, cutoff: 1600, resonance: 0.92, envMod: 0.88, decay: 280, accent: 0.95, volume: 0.8 },
    steps: line([
      [N.A1, 1, 1, 1], [N.A2, 1, 1, 0], [N.A1, 1, 0, 1], [N.C3, 1, 1, 0],
      [N.A1, 1, 0, 1], [N.E3, 1, 1, 0], [N.A2, 1, 0, 1], [N.A1, 1, 1, 0],
      [N.A1, 1, 1, 1], [N.A2, 1, 1, 0], [N.C2, 1, 0, 1], [N.E2, 1, 1, 0],
      [N.A2, 1, 0, 1], [N.A1, 1, 1, 0], [N.G2, 1, 0, 1], [N.A1, 1, 1, 0],
    ]),
  },
  {
    name: 'Liquid Slide',
    patch: { waveform: 'saw', tuning: 0, cutoff: 820, resonance: 0.62, envMod: 0.55, decay: 620, accent: 0.6, volume: 0.85 },
    steps: line([
      [N.A1, 1, 1, 1], [N.C2, 1, 0, 0], [N.D2, 1, 0, 1], [N.E2, 1, 0, 0],
      [N.A1, 1, 1, 1], [N.G1, 1, 0, 0], [N.A1, 1, 0, 1], [N.C2, 1, 0, 0],
      [N.E2, 1, 1, 1], [N.G2, 1, 0, 0], [N.A2, 1, 0, 1], [N.G2, 1, 0, 0],
      [N.E2, 1, 1, 1], [N.C2, 1, 0, 0], [N.A1, 1, 0, 1], [N.A1, 1, 0, 0],
    ]),
  },
  {
    name: 'Rubber Bass',
    patch: { waveform: 'square', tuning: 0, cutoff: 520, resonance: 0.5, envMod: 0.42, decay: 340, accent: 0.65, volume: 0.88 },
    steps: line([
      [N.A1, 1, 1, 0], [N.A1, 1, 0, 0], [N.A1, 1, 0, 1], [N.A1, 1, 0, 0],
      [N.A1, 1, 1, 0], [N.A1, 1, 0, 0], [N.C2, 1, 0, 1], [N.C2, 1, 0, 0],
      [N.A1, 1, 1, 0], [N.A1, 1, 0, 0], [N.A1, 1, 0, 1], [N.A1, 1, 0, 0],
      [N.G1, 1, 1, 0], [N.A1, 1, 0, 0], [N.C2, 1, 0, 1], [N.D2, 1, 0, 0],
    ]),
  },
  {
    name: 'Detroit Stab',
    patch: { waveform: 'square', tuning: 0, cutoff: 700, resonance: 0.55, envMod: 0.5, decay: 300, accent: 0.7, volume: 0.85 },
    steps: line([
      [N.A1, 1, 1, 0], _, _, [N.A1, 1, 0, 0],
      _, [N.C2, 1, 1, 0], _, _,
      [N.A1, 1, 1, 0], _, [N.E2, 1, 0, 0], _,
      [N.D2, 1, 1, 0], _, [N.C2, 1, 0, 0], _,
    ]),
  },
  {
    name: 'Rave Stab',
    patch: { waveform: 'saw', tuning: 12, cutoff: 1300, resonance: 0.72, envMod: 0.6, decay: 220, accent: 0.92, volume: 0.8 },
    steps: line([
      [N.A2, 1, 1, 0], [N.A2, 1, 1, 0], _, [N.A2, 1, 1, 0],
      _, [N.C3, 1, 1, 0], _, [N.A2, 1, 1, 0],
      [N.G2, 1, 1, 0], [N.G2, 1, 1, 0], _, [N.E2, 1, 1, 0],
      _, [N.A2, 1, 1, 0], [N.C3, 1, 1, 0], _,
    ]),
  },
  {
    name: 'Minimal',
    patch: { waveform: 'saw', tuning: 0, cutoff: 640, resonance: 0.58, envMod: 0.5, decay: 500, accent: 0.7, volume: 0.85 },
    steps: line([
      [N.A1, 1, 1, 0], _, _, _,
      [N.A1, 1, 0, 0], _, [N.C2, 1, 0, 0], _,
      [N.A1, 1, 1, 0], _, _, [N.E2, 1, 0, 0],
      _, [N.A1, 1, 0, 0], _, _,
    ]),
  },
];

function patches303(machineKey) {
  return PATCHES_303.map(({ name, patch, steps }) => ({
    name,
    create: () => ({
      pattern: { id: crypto.randomUUID(), name, machine: machineKey, steps: structuredClone(steps) },
      patch: { ...patch },
    }),
  }));
}

// Drum beats: hits[] and accents[] step indices per lane. Lanes not present on
// a machine (e.g. cowbell on the 909) are simply ignored.
function drumPattern(laneOrder, spec) {
  const lanes = {};
  for (const lane of laneOrder) {
    const steps = Array.from({ length: 16 }, () => ({ h: 0, a: 0 }));
    const s = spec[lane];
    if (s) {
      for (const i of s.h || []) steps[i].h = 1;
      for (const i of s.a || []) steps[i].a = 1;
    }
    lanes[lane] = steps;
  }
  return lanes;
}

const LANES_808 = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'cb', 'ch', 'oh', 'cy', 'ma'];
const LANES_909 = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'ch', 'oh', 'cc', 'rc'];

const BEATS = [
  ['Four to the Floor', { bd: { h: [0, 4, 8, 12], a: [0, 8] }, cp: { h: [4, 12] }, ch: { h: [2, 6, 10, 14] } }],
  ['Boom Bap', { bd: { h: [0, 10], a: [0] }, sd: { h: [4, 12], a: [4, 12] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14], a: [0, 8] } }],
  ['Breakbeat', { bd: { h: [0, 6, 10], a: [0] }, sd: { h: [4, 12], a: [4] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14] }, oh: { h: [7, 15] } }],
  ['Half Time', { bd: { h: [0, 9], a: [0] }, sd: { h: [8], a: [8] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14] }, oh: { h: [14] } }],
  ['Electro Funk', { bd: { h: [0, 4, 6, 8, 12, 14], a: [0, 8] }, cp: { h: [4, 12] }, cb: { h: [2, 10] }, ch: { h: [2, 6, 10, 14] }, oh: { h: [7] } }],
  ['Miami Bass', { bd: { h: [0, 3, 6, 8, 11, 14], a: [0, 8] }, sd: { h: [4, 12], a: [4, 12] }, ch: { h: [0, 2, 4, 6, 8, 10, 12, 14] } }],
  ['Trap', { bd: { h: [0, 7, 10], a: [0] }, sd: { h: [8], a: [8] }, ch: { h: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14, 15], a: [0] } }],
  ['Warehouse', { bd: { h: [0, 4, 8, 12], a: [0, 8] }, cp: { h: [4, 12] }, oh: { h: [2, 6, 10, 14] }, ch: { h: [0, 4, 8, 12] } }],
  ['Rave', { bd: { h: [0, 4, 8, 12], a: [0, 4, 8, 12] }, cp: { h: [4, 12] }, oh: { h: [2, 6, 10, 14] }, cc: { h: [0] }, cy: { h: [0] } }],
  ['Skippy Garage', { bd: { h: [0, 10], a: [0] }, sd: { h: [4, 12] }, oh: { h: [2, 6, 14] }, ch: { h: [3, 7, 11, 15] } }],
  ['Tom Roll', { bd: { h: [0, 8], a: [0] }, sd: { h: [4, 12] }, lt: { h: [13] }, mt: { h: [14] }, ht: { h: [15] }, ch: { h: [0, 2, 4, 6, 8, 10] } }],
];

function beats(machineKey, laneOrder) {
  return BEATS.map(([name, spec]) => ({
    name,
    create: () => ({
      pattern: { id: crypto.randomUUID(), name, machine: machineKey, lanes: drumPattern(laneOrder, spec) },
      patch: null,
    }),
  }));
}

export const PRESET_LIBRARY = {
  '303a': patches303('303a'),
  '303b': patches303('303b'),
  '808': beats('808', LANES_808),
  '909': beats('909', LANES_909),
};
