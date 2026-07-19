import { CFG } from './config.js';
import { noteName } from './presets303.js';
import { eventsForStep } from './seq303.js';
import { createKnob } from './knob.js';
import { pitchClassOf, octaveOffsetOf, noteFrom, clampNote } from './pitch.js';
import { rovingGrid } from './a11yGrid.js';

const NOTE_LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const IS_NATURAL = [true, false, true, false, true, true, false, true, false, true, false, true];

const D = CFG.VOICE303.KNOB_DEFAULTS;
const int = (v) => String(Math.round(v));
const two = (v) => v.toFixed(2);
const KNOBS = [
  { id: 'tuning', label: 'Tuning', min: -24, max: 24, default: D.tuning, fmt: (v) => (v > 0 ? '+' : '') + Math.round(v) },
  { id: 'cutoff', label: 'Cutoff', min: CFG.VOICE303.CUTOFF_MIN_HZ, max: CFG.VOICE303.CUTOFF_MAX_HZ, default: D.cutoff, fmt: int },
  { id: 'resonance', label: 'Reso', min: 0, max: 1, default: D.resonance, fmt: two },
  { id: 'envMod', label: 'Env Mod', min: 0, max: 1, default: D.envMod, fmt: two },
  { id: 'decay', label: 'Decay', min: CFG.VOICE303.DECAY_MIN_MS, max: CFG.VOICE303.DECAY_MAX_MS, default: D.decay, fmt: int },
  { id: 'accent', label: 'Accent', min: 0, max: 1, default: D.accent, fmt: two },
  { id: 'volume', label: 'Volume', min: 0, max: 1, default: D.volume, fmt: two },
];

// Console editor: [ sequencer row | inspector ]. The inspector holds the
// labeled macro knobs, waveform, and Reset Knobs / Clear A/S. `defaultPatch`
// is the machine's designed voice (Reset target). `getPlayingPattern` lets
// song mode swap what PLAYS per bar while the panel still displays `pattern`.
export function createVoice303Panel(container, { label, node, pattern, patch = {}, defaultPatch = {}, now, edit = (fn) => fn(), onPatchChange = null, getPlayingPattern = () => pattern }) {
  const root = document.createElement('div');
  root.className = 'panel303';
  container.appendChild(root);

  const body = document.createElement('div');
  body.className = 'p303-body';
  root.appendChild(body);

  const seqCol = document.createElement('div');
  seqCol.className = 'seq-col';
  body.appendChild(seqCol);

  const inspector = document.createElement('div');
  inspector.className = 'inspector';
  inspector.innerHTML = `
    <div class="insp-head">
      <label class="wave-pick">Wave
        <select><option value="saw">saw</option><option value="square">square</option></select>
      </label>
      <button class="reset-knobs" title="Reset all sound knobs to this machine's default">Reset Knobs</button>
      <button class="clear-as" title="Remove all accents & slides from this pattern">Clear A/S</button>
    </div>
    <div class="knob-grid"></div>`;
  body.appendChild(inspector);

  const waveSelect = inspector.querySelector('select');
  waveSelect.value = patch.waveform || 'saw';

  const getPatch = () => {
    const p = { waveform: waveSelect.value };
    for (const k of KNOBS) p[k.id] = node.parameters.get(k.id).value;
    return p;
  };
  const patchChanged = () => onPatchChange && onPatchChange(getPatch());

  const setWaveform = (v) => { waveSelect.value = v; node.port.postMessage({ type: 'waveform', value: v }); };
  waveSelect.addEventListener('change', () => { setWaveform(waveSelect.value); patchChanged(); });
  node.port.postMessage({ type: 'waveform', value: waveSelect.value });

  const grid = inspector.querySelector('.knob-grid');
  const knobsById = {};
  for (const k of KNOBS) {
    const value = patch[k.id] != null ? patch[k.id] : k.default;
    node.parameters.get(k.id).value = value;
    knobsById[k.id] = createKnob(grid, {
      label: k.label, min: k.min, max: k.max, value, format: k.fmt,
      onChange: (v) => { node.parameters.get(k.id).value = v; patchChanged(); },
    });
  }

  inspector.querySelector('.reset-knobs').addEventListener('click', () => {
    setWaveform(defaultPatch.waveform || 'saw');
    for (const k of KNOBS) {
      const dv = defaultPatch[k.id] != null ? defaultPatch[k.id] : k.default;
      knobsById[k.id].setValue(dv);
      node.parameters.get(k.id).value = dv;
    }
    patchChanged();
  });

  // Piano-roll sequencer: 12 pitch rows (one octave, high->low) x 16 steps,
  // plus per-step octave bump and accent/slide strips. The note stays
  // absolute (step.n); rows show its pitch class, a badge/stepper its octave.
  const BASE = CFG.VOICE303.PIANO_BASE_MIDI;
  const NOTE_MIN = CFG.VOICE303.NOTE_MIN;
  const NOTE_MAX = CFG.VOICE303.NOTE_MAX;
  const STEPS = pattern.steps.length;

  const pr = document.createElement('div');
  pr.className = 'pianoroll';
  seqCol.appendChild(pr);

  const gridRow = (cls) => { const el = document.createElement('div'); el.className = cls; pr.appendChild(el); return el; };
  const gutter = (parent, text, cls = '') => { const g = document.createElement('div'); g.className = `pr-gutter ${cls}`.trim(); g.textContent = text; g.setAttribute('aria-hidden', 'true'); parent.appendChild(g); return g; };

  // Keyboard help, referenced by the grid via aria-describedby.
  const help = document.createElement('div');
  help.className = 'sr-only';
  help.id = `pr-help-${label.replace(/\W/g, '')}`;
  help.textContent = 'Arrow keys move between steps and pitches. Enter or Space places or clears the note. Press A for accent, S for slide, Page Up or Page Down to shift the note by an octave.';
  pr.appendChild(help);

  // Step-number header (carries the playhead).
  const header = gridRow('pr-header');
  gutter(header, '');
  const headerCells = [];
  for (let c = 0; c < STEPS; c++) {
    const h = document.createElement('div');
    h.className = 'pr-stepnum' + (c % 4 === 0 ? ' beat' : '');
    h.textContent = c + 1;
    h.setAttribute('aria-hidden', 'true');
    header.appendChild(h);
    headerCells.push(h);
  }

  // Pitch grid: rows top (B) -> bottom (C). colCells[c][pitchClass] = cell.
  const prGrid = gridRow('pr-grid');
  prGrid.setAttribute('role', 'grid');
  prGrid.setAttribute('aria-label', `${label} note grid, 12 pitches by ${STEPS} steps`);
  prGrid.setAttribute('aria-describedby', help.id);
  const colCells = Array.from({ length: STEPS }, () => new Array(12));
  for (let i = 0; i < 12; i++) {
    const pc = 11 - i;
    const key = document.createElement('div');
    key.className = 'pr-key ' + (IS_NATURAL[pc] ? 'natural' : 'sharp');
    key.textContent = NOTE_LETTERS[pc];
    key.setAttribute('aria-hidden', 'true');
    prGrid.appendChild(key);
    for (let c = 0; c < STEPS; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'pr-cell' + (c % 4 === 0 ? ' beat' : '');
      cell.setAttribute('role', 'gridcell');
      cell.addEventListener('click', () => setPitch(c, pc));
      prGrid.appendChild(cell);
      colCells[c][pc] = cell;
    }
  }

  // Octave bump strip.
  const octRow = gridRow('pr-oct');
  gutter(octRow, 'Oct');
  const octNums = [];
  for (let c = 0; c < STEPS; c++) {
    const cell = document.createElement('div');
    cell.className = 'pr-octcell';
    cell.innerHTML = `<button type="button" class="oct-dn" tabindex="-1" aria-label="Step ${c + 1} down an octave">▼</button><span class="oct-n" aria-hidden="true"></span><button type="button" class="oct-up" tabindex="-1" aria-label="Step ${c + 1} up an octave">▲</button>`;
    cell.querySelector('.oct-up').addEventListener('click', () => bumpOct(c, +1));
    cell.querySelector('.oct-dn').addEventListener('click', () => bumpOct(c, -1));
    octRow.appendChild(cell);
    octNums.push(cell.querySelector('.oct-n'));
  }

  // Accent / slide strip.
  const flagRow = gridRow('pr-flags');
  gutter(flagRow, 'A/S');
  const accBtns = [];
  const sldBtns = [];
  for (let c = 0; c < STEPS; c++) {
    const cell = document.createElement('div');
    cell.className = 'pr-flagcell';
    cell.innerHTML = `<button type="button" class="acc" tabindex="-1" aria-label="Step ${c + 1} accent" aria-pressed="false">A</button><button type="button" class="sld" tabindex="-1" aria-label="Step ${c + 1} slide" aria-pressed="false">S</button>`;
    const acc = cell.querySelector('.acc');
    const sld = cell.querySelector('.sld');
    acc.addEventListener('click', () => { edit(() => { pattern.steps[c].a = pattern.steps[c].a ? 0 : 1; }); renderStep(c); });
    sld.addEventListener('click', () => { edit(() => { pattern.steps[c].s = pattern.steps[c].s ? 0 : 1; }); renderStep(c); });
    flagRow.appendChild(cell);
    accBtns.push(acc);
    sldBtns.push(sld);
  }

  function renderStep(c) {
    const step = pattern.steps[c];
    const pc = pitchClassOf(step.n, BASE);
    const oct = octaveOffsetOf(step.n, BASE);
    for (let p = 0; p < 12; p++) {
      const lit = !!step.g && p === pc;
      const cell = colCells[c][p];
      cell.classList.toggle('lit', lit);
      cell.textContent = lit ? noteName(step.n) : '';
      cell.setAttribute('aria-pressed', String(lit));
      cell.setAttribute('aria-label', `Step ${c + 1}, ${NOTE_LETTERS[p]}${lit ? `, ${noteName(step.n)}` : ''}`);
    }
    octNums[c].textContent = oct > 0 ? `+${oct}` : String(oct);
    octNums[c].classList.toggle('shifted', oct !== 0);
    accBtns[c].classList.toggle('on', !!step.a);
    accBtns[c].setAttribute('aria-pressed', String(!!step.a));
    sldBtns[c].classList.toggle('on', !!step.s);
    sldBtns[c].setAttribute('aria-pressed', String(!!step.s));
  }

  // Click a cell: place that pitch class (keeping the step's octave) and gate
  // on; click the lit note again to make the step a rest.
  function setPitch(c, pc) {
    const step = pattern.steps[c];
    if (step.g && pitchClassOf(step.n, BASE) === pc) {
      edit(() => { step.g = 0; });
    } else {
      const newN = clampNote(noteFrom(pc, octaveOffsetOf(step.n, BASE), BASE), NOTE_MIN, NOTE_MAX);
      edit(() => { step.n = newN; step.g = 1; });
    }
    renderStep(c);
  }
  function bumpOct(c, dir) {
    const step = pattern.steps[c];
    const newN = clampNote(step.n + dir * 12, NOTE_MIN, NOTE_MAX);
    if (newN === step.n) return; // already at the range edge
    edit(() => { step.n = newN; });
    renderStep(c);
  }

  for (let c = 0; c < STEPS; c++) renderStep(c);

  // Keyboard: arrow-key roving across the grid, with per-column shortcuts.
  const rows = Array.from({ length: 12 }, (_, i) => colCells.map((col) => col[11 - i]));
  rovingGrid(rows, {
    onColumnKey(c, e) {
      const k = e.key.toLowerCase();
      if (k === 'a') { accBtns[c].click(); return true; }
      if (k === 's') { sldBtns[c].click(); return true; }
      if (e.key === 'PageUp') { bumpOct(c, +1); return true; }
      if (e.key === 'PageDown') { bumpOct(c, -1); return true; }
      return false;
    },
  });

  inspector.querySelector('.clear-as').addEventListener('click', () => {
    edit(() => { for (const st of pattern.steps) { st.a = 0; st.s = 0; } });
    for (let c = 0; c < STEPS; c++) renderStep(c);
  });

  let playingCol = -1;
  const setPlayingCol = (col) => {
    if (col === playingCol) return;
    const paint = (cc, on) => {
      if (cc < 0) return;
      headerCells[cc].classList.toggle('playing', on);
      for (let p = 0; p < 12; p++) colCells[cc][p].classList.toggle('col-playing', on);
    };
    paint(playingCol, false);
    paint(col, true);
    playingCol = col;
  };

  const pendingHighlights = [];
  return {
    pattern,
    onStep(stepIndex, time, stepDur) {
      const playing = getPlayingPattern();
      if (playing) {
        for (const msg of eventsForStep(playing.steps, stepIndex, time, stepDur)) node.port.postMessage(msg);
      } else {
        node.port.postMessage({ type: 'note', time, gate: false });
      }
      const delayMs = Math.max(0, (time - now()) * 1000);
      pendingHighlights.push(setTimeout(() => setPlayingCol(stepIndex), delayMs));
    },
    onStop() {
      node.port.postMessage({ type: 'stop' });
      for (const id of pendingHighlights) clearTimeout(id);
      pendingHighlights.length = 0;
      setPlayingCol(-1);
    },
  };
}
