import { CFG } from './config.js';
import { createKnob } from './knob.js';
import { rovingGrid } from './a11yGrid.js';

const KNOB_LABELS = { level: 'Level', tone: 'Tone', decay: 'Decay', snappy: 'Snap', tune: 'Tune', attack: 'Attack' };

// Console editor: [ lane grid | inspector ]. The grid is just lane names +
// step pads. Clicking a lane name selects it; the inspector shows that lane's
// labeled knobs (plus the global Accent). knobState persists across inspector
// re-renders. `getPlayingPattern` lets song mode swap what PLAYS per bar.
export function createDrumPanel(container, { label, node, pattern, now, laneOrder, laneLabels, laneKnobs, edit = (fn) => fn(), onKnobsChange = null, knobs = null, getPlayingPattern = () => pattern }) {
  const root = document.createElement('div');
  root.className = 'panelDrum';
  container.appendChild(root);

  const body = document.createElement('div');
  body.className = 'pdrum-body';
  root.appendChild(body);
  const seqCol = document.createElement('div');
  seqCol.className = 'seq-col';
  seqCol.setAttribute('role', 'grid');
  seqCol.setAttribute('aria-label', `${label} drum grid`);
  body.appendChild(seqCol);
  const help = document.createElement('div');
  help.className = 'sr-only';
  help.id = `drum-help-${label}`;
  help.textContent = 'Arrow keys move between drums and steps. Enter or Space toggles the hit. Press A for accent.';
  seqCol.setAttribute('aria-describedby', help.id);
  seqCol.appendChild(help);
  const inspector = document.createElement('div');
  inspector.className = 'inspector pdrum-inspector';
  inspector.innerHTML = `<div class="insp-accent"></div><div class="insp-lane"><div class="insp-lane-title"></div><div class="insp-knobs"></div></div>`;
  body.appendChild(inspector);

  const knobState = {}; // laneName -> { level, tone, decay, ... }
  const cellsByLane = {};
  const nameByLane = {};
  let accentValue = knobs && knobs.accent != null ? knobs.accent : CFG.DRUM_ACCENT_AMOUNT_DEFAULT;
  const getKnobs = () => ({ accent: accentValue, lanes: knobState });
  const knobsChanged = () => onKnobsChange && onKnobsChange(getKnobs());

  // Global Accent knob (top of inspector).
  node.parameters.get('accentAmount').value = accentValue;
  createKnob(inspector.querySelector('.insp-accent'), {
    label: 'Accent', min: 0, max: 1, value: accentValue, format: (v) => v.toFixed(2),
    onChange: (v) => { accentValue = v; node.parameters.get('accentAmount').value = v; knobsChanged(); },
  });

  // Lane-focused knob section.
  const laneTitle = inspector.querySelector('.insp-lane-title');
  const laneKnobsEl = inspector.querySelector('.insp-knobs');
  let selectedLane = laneOrder[0];
  function renderLaneInspector() {
    laneTitle.textContent = laneLabels[selectedLane];
    laneKnobsEl.innerHTML = '';
    for (const k of ['level', ...(laneKnobs[selectedLane] || [])]) {
      createKnob(laneKnobsEl, {
        label: KNOB_LABELS[k] || k, min: 0, max: 1, value: knobState[selectedLane][k], format: (v) => v.toFixed(2),
        onChange: (v) => { knobState[selectedLane][k] = v; knobsChanged(); },
      });
    }
    for (const lane of laneOrder) {
      nameByLane[lane].classList.toggle('selected', lane === selectedLane);
      nameByLane[lane].setAttribute('aria-pressed', String(lane === selectedLane));
    }
  }
  const selectLane = (lane) => { selectedLane = lane; renderLaneInspector(); };

  for (const laneName of laneOrder) {
    const laneKnobIds = laneKnobs[laneName] || [];
    const saved = knobs && knobs.lanes && knobs.lanes[laneName];
    knobState[laneName] = { level: CFG.DRUM_LANE_LEVEL_DEFAULT };
    for (const k of laneKnobIds) knobState[laneName][k] = 0.5;
    if (saved) Object.assign(knobState[laneName], saved);

    const row = document.createElement('div');
    row.className = 'drum-row';

    const nameEl = document.createElement('button');
    nameEl.className = 'drum-name';
    nameEl.textContent = laneLabels[laneName];
    nameEl.setAttribute('aria-label', `Edit ${laneLabels[laneName]} sound`);
    nameEl.setAttribute('aria-pressed', 'false');
    nameEl.addEventListener('click', () => selectLane(laneName));
    row.appendChild(nameEl);
    nameByLane[laneName] = nameEl;

    const grid = document.createElement('div');
    grid.className = 'drum-lane';
    const cells = pattern.lanes[laneName].map((step, ci) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dstep';
      cell.setAttribute('role', 'gridcell');
      cell.innerHTML = `<span class="acc" aria-hidden="true">A</span>`;
      const accEl = cell.querySelector('.acc');
      const render = () => {
        cell.classList.toggle('hit-on', !!step.h);
        accEl.classList.toggle('on', !!step.a);
        cell.setAttribute('aria-pressed', String(!!step.h));
        cell.setAttribute('aria-label', `${laneLabels[laneName]} step ${ci + 1}${step.a ? ', accent' : ''}`);
      };
      accEl.addEventListener('click', (e) => { e.stopPropagation(); edit(() => { step.a = step.a ? 0 : 1; }); render(); });
      cell.addEventListener('click', () => { edit(() => { step.h = step.h ? 0 : 1; }); render(); });
      cell.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'a') { e.preventDefault(); edit(() => { step.a = step.a ? 0 : 1; }); render(); }
      });
      render();
      grid.appendChild(cell);
      return cell;
    });
    cellsByLane[laneName] = cells;
    row.appendChild(grid);
    seqCol.appendChild(row);
  }

  rovingGrid(laneOrder.map((lane) => cellsByLane[lane]));
  renderLaneInspector();

  // Empty-pattern nudge: a one-time hint over the grid until the first click,
  // so a fresh/blank kit tells you what to do (removed on first interaction).
  if (laneOrder.every((l) => pattern.lanes[l].every((s) => !s.h))) {
    const hint = document.createElement('div');
    hint.className = 'grid-hint';
    hint.textContent = 'Click the pads to add a beat';
    hint.setAttribute('aria-hidden', 'true');
    seqCol.appendChild(hint);
    seqCol.addEventListener('pointerdown', () => hint.remove(), { once: true });
  }

  const pendingHighlights = [];
  return {
    pattern,
    onStep(stepIndex, time) {
      const playing = getPlayingPattern();
      if (playing) {
        for (const laneName of laneOrder) {
          const step = playing.lanes[laneName][stepIndex];
          if (step.h) {
            node.port.postMessage({ type: 'hit', time, lane: laneName, accent: !!step.a, params: knobState[laneName] });
          }
        }
      }
      const delayMs = Math.max(0, (time - now()) * 1000);
      pendingHighlights.push(setTimeout(() => {
        for (const laneName of laneOrder) {
          cellsByLane[laneName].forEach((c, i) => c.classList.toggle('playing', i === stepIndex));
        }
      }, delayMs));
    },
    onStop() {
      node.port.postMessage({ type: 'stop' });
      for (const id of pendingHighlights) clearTimeout(id);
      pendingHighlights.length = 0;
      for (const laneName of laneOrder) cellsByLane[laneName].forEach((c) => c.classList.remove('playing'));
    },
  };
}
