// 808 lane metadata: which lanes exist, their kid-readable names, and which
// knobs each lane exposes. (The seed 808 pattern now comes from the demo
// library; the old PRESET_808 snippet was removed with the demo-seed switch.)

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
