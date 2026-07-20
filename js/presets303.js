// 303 note-name helper for the piano-roll gutter/labels. (Seed patterns now
// come from the demo library; the old PRESET_303A/B snippets were removed when
// a fresh profile started seeding from a full demo.)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(midi) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
