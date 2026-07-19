// Preset 808 pattern per the locked data model (SPEC.md): a classic
// four-on-the-floor-leaning acid groove exercising BD/SD/CH/OH/CP.

// Knob map locked in M3 (see js/config.js CFG.DRUM808 comment): which knobs
// each lane exposes, beyond the level every lane has.
export const LANE_KNOBS_808 = {
  bd: ['tone', 'decay'],
  sd: ['tone', 'snappy'],
  oh: ['decay'],
  cy: ['decay'],
};
// Full names so kids aren't stuck decoding two-letter codes.
export const LANE_LABELS_808 = {
  bd: 'Kick', sd: 'Snare', lt: 'Low Tom', mt: 'Mid Tom', ht: 'Hi Tom', rs: 'Rimshot',
  cp: 'Clap', cb: 'Cowbell', ch: 'Closed Hat', oh: 'Open Hat', cy: 'Cymbal', ma: 'Maraca',
};
export const LANE_ORDER_808 = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'cb', 'ch', 'oh', 'cy', 'ma'];

function lane(hits, accents = []) {
  const steps = Array.from({ length: 16 }, () => ({ h: 0, a: 0 }));
  for (const i of hits) steps[i].h = 1;
  for (const i of accents) steps[i].a = 1;
  return steps;
}

export const PRESET_808 = {
  id: 'preset-808',
  name: 'Acid Groove',
  machine: '808',
  lanes: {
    bd: lane([0, 4, 8, 10, 12], [0, 8]),
    sd: lane([4, 12], [4, 12]),
    lt: lane([]),
    mt: lane([]),
    ht: lane([]),
    rs: lane([]),
    cp: lane([4, 12]),
    cb: lane([]),
    ch: lane([0, 2, 4, 6, 8, 10, 12], [2, 6, 10]),
    oh: lane([14]),
    cy: lane([]),
    ma: lane([]),
  },
};
