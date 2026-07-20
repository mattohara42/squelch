// 909 lane metadata: lanes, kid-readable names, and per-lane knobs. (The seed
// 909 pattern now comes from the demo library; the old PRESET_909 snippet was
// removed with the demo-seed switch.)
export const LANE_KNOBS_909 = {
  bd: ['tune', 'attack', 'decay'],
  sd: ['tune', 'tone', 'snappy'],
  lt: ['tune', 'decay'],
  mt: ['tune', 'decay'],
  ht: ['tune', 'decay'],
  oh: ['decay'],
};
export const LANE_LABELS_909 = {
  bd: 'Kick', sd: 'Snare', lt: 'Low Tom', mt: 'Mid Tom', ht: 'Hi Tom', rs: 'Rimshot',
  cp: 'Clap', ch: 'Closed Hat', oh: 'Open Hat', cc: 'Crash', rc: 'Ride',
};
export const LANE_ORDER_909 = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'ch', 'oh', 'cc', 'rc'];
