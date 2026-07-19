// Preset patterns per the locked data model (SPEC.md). Two contrasting
// riffs so 303-A and 303-B are audibly distinct machines, not just two
// copies of the same pattern.
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function steps(list) {
  return list.map(([n, g, a, s]) => ({ n, g, a, s }));
}

export const PRESET_303A = {
  id: 'preset-303a',
  name: 'Acid A',
  machine: '303a',
  steps: steps([
    [33, 1, 0, 0], [33, 1, 0, 1],
    [45, 1, 1, 0], [33, 0, 0, 0],
    [33, 1, 0, 0], [36, 1, 0, 1],
    [33, 1, 1, 0], [33, 0, 0, 0],
    [33, 1, 0, 0], [33, 1, 0, 0],
    [45, 1, 0, 1], [45, 1, 1, 0],
    [33, 1, 0, 0], [40, 1, 0, 0],
    [36, 1, 1, 1], [33, 1, 0, 0],
  ]),
};

export const PRESET_303B = {
  id: 'preset-303b',
  name: 'Sub B',
  machine: '303b',
  steps: steps([
    [28, 1, 1, 0], [28, 0, 0, 0],
    [28, 1, 0, 1], [28, 1, 0, 0],
    [31, 1, 0, 0], [28, 0, 0, 0],
    [28, 1, 1, 0], [26, 1, 0, 0],
    [28, 1, 1, 0], [28, 0, 0, 0],
    [28, 1, 0, 1], [28, 1, 0, 0],
    [33, 1, 0, 0], [31, 1, 0, 0],
    [28, 1, 1, 1], [28, 1, 0, 0],
  ]),
};
