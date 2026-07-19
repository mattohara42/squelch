// Preset 909 pattern per the locked data model (SPEC.md): four-on-the-floor
// kick + open-hat offbeat, per M4's accept criteria.
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

function lane(hits, accents = []) {
  const steps = Array.from({ length: 16 }, () => ({ h: 0, a: 0 }));
  for (const i of hits) steps[i].h = 1;
  for (const i of accents) steps[i].a = 1;
  return steps;
}

export const PRESET_909 = {
  id: 'preset-909',
  name: 'Four to the Floor',
  machine: '909',
  lanes: {
    bd: lane([0, 4, 8, 12], [0, 8]),
    sd: lane([]),
    lt: lane([]),
    mt: lane([]),
    ht: lane([]),
    rs: lane([]),
    cp: lane([4, 12]),
    ch: lane([]),
    oh: lane([2, 6, 10, 14]),
    cc: lane([]),
    rc: lane([]),
  },
};
