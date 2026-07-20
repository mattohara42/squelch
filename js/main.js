import { CFG } from './config.js';
import { Scheduler } from './scheduler.js';
import { createVoice303Panel } from './panel303.js';
import { createDrumPanel } from './panelDrum.js';
import { LANE_ORDER_808, LANE_LABELS_808, LANE_KNOBS_808 } from './presetsDrum.js';
import { LANE_ORDER_909, LANE_LABELS_909, LANE_KNOBS_909 } from './presetsDrum909.js';
import { createMixerPanel } from './panelMixer.js';
import { createStore } from './store.js';
import { DEMO_LIBRARY, buildDemoState, buildBlankState } from './demoLibrary.js';
import { createPatternBar } from './patternBar.js';
import { createSongPanel } from './panelSong.js';
import { createSongConductor } from './songConductor.js';
import { createHelp } from './help.js';

let ctx, scheduler, mixerPanel, initPromise;
let playMode = 'pattern'; // 'pattern' | 'song' — session-only, not persisted
let songUI = null;
let activeTab = '303a'; // which instrument the console shows; all always play
const store = createStore(window.localStorage);
const rig = { nodes: {} }; // audio nodes, created once in start(); panels rebuild around them

function stopTransport() {
  if (scheduler && scheduler.playing) {
    scheduler.stop();
    const p = document.getElementById('play');
    p.textContent = 'RUN';
    p.setAttribute('aria-pressed', 'false');
    document.getElementById('status').textContent = 'ready';
  }
}

// Start playback (unlocking audio on first use). Shared by the RUN button and
// demo-load autoplay. Safe to call when already playing.
async function startTransport() {
  await initPromise; // in case it's hit while worklet modules are still loading
  if (ctx.state === 'suspended') await ctx.resume(); // first gesture unlocks audio
  dismissNudge();
  if (scheduler && !scheduler.playing) {
    scheduler.start();
    const p = document.getElementById('play');
    p.textContent = 'STOP';
    p.setAttribute('aria-pressed', 'true');
    document.getElementById('status').textContent = 'running';
  }
}

// First-run "press RUN" nudge — shows once (per browser profile) until the
// user first hits play, then never again.
const NUDGE_KEY = 'squelch-seen-v1';
function dismissNudge() {
  const nudge = document.getElementById('nudge');
  if (nudge) nudge.remove();
  try { window.localStorage.setItem(NUDGE_KEY, '1'); } catch { /* private mode */ }
}
function maybeShowNudge() {
  let seen = false;
  try { seen = window.localStorage.getItem(NUDGE_KEY) === '1'; } catch { /* private mode */ }
  if (seen) return;
  const nudge = document.createElement('div');
  nudge.id = 'nudge';
  nudge.innerHTML = `<div class="nudge-arrow">▲</div><div class="nudge-text">Press <b>RUN</b> (or the Space bar) to start the jam!</div>`;
  document.body.appendChild(nudge);
}

// Registered ahead of the panels each rebuild, so row advances land before
// panels read the step. requestStop defers a tick: stopping mid-iteration
// would run panels' onStop flush and then hand them fresh step events.
const conductor = createSongConductor({
  getSong: () => store.getState().song,
  isSongMode: () => playMode === 'song',
  onRowChange: (row, time) => songUI && songUI.setPlayingRow(row, time),
  requestStop: () => setTimeout(stopTransport, 0),
});

// What a machine should PLAY right now: its active pattern in pattern mode,
// the current song row's ref in song mode (null = silent this row).
function playingPatternFor(machineKey) {
  if (playMode !== 'song') return store.activePattern(machineKey);
  const id = conductor.currentPatternId(machineKey);
  if (!id) return null;
  return store.getState().patterns[machineKey].find((p) => p.id === id) || null;
}

// Default patches used when nothing is stored yet.
const DEFAULT_PATCHES = {
  '303a': { waveform: 'saw', cutoff: 900, resonance: 0.6, envMod: 0.6, decay: 300, accent: 0.7, volume: 0.85 },
  '303b': { waveform: 'square', cutoff: 250, resonance: 0.4, envMod: 0.3, decay: 700, accent: 0.5, volume: 0.8 },
};

const MACHINE_DEFS = [
  { key: '303a', label: '303-A', kind: '303', accent: '#b6e33a' },
  { key: '303b', label: '303-B', kind: '303', accent: '#ffb000' },
  { key: '808', label: '808', kind: 'drum', accent: '#4db8ff', laneOrder: LANE_ORDER_808, laneLabels: LANE_LABELS_808, laneKnobs: LANE_KNOBS_808 },
  { key: '909', label: '909', kind: 'drum', accent: '#ff5a3c', laneOrder: LANE_ORDER_909, laneLabels: LANE_LABELS_909, laneKnobs: LANE_KNOBS_909 },
];

function makeBlankPattern(def) {
  const base = { id: crypto.randomUUID(), name: `Pattern ${store.getState().patterns[def.key].length + 1}`, machine: def.key };
  if (def.kind === '303') {
    base.steps = Array.from({ length: CFG.STEPS_PER_PATTERN }, () => ({ n: 33, g: 0, a: 0, s: 0 }));
  } else {
    base.lanes = {};
    for (const lane of def.laneOrder) {
      base.lanes[lane] = Array.from({ length: CFG.STEPS_PER_PATTERN }, () => ({ h: 0, a: 0 }));
    }
  }
  return base;
}

const updateUndoButton = () => { document.getElementById('undo').disabled = !store.canUndo(); };
const editWithUndo = (fn) => { store.edit(fn); updateUndoButton(); };

// Replace the whole rig (load a demo, or the blank slate) and refresh the UI —
// same refresh path as undo/import. Stops the transport so playback restarts
// cleanly against the new patterns, and snaps back to the first instrument tab.
// No confirm dialog: a whole-rig load is one Undo away from your previous rig
// (tempo, patches, mixer and all — see store RIG_KEYS).
function loadRigState(newState) {
  stopTransport();
  store.loadRig(newState);
  activeTab = MACHINE_DEFS[0].key;
  updateUndoButton();
  applyTransportUI();
  if (ctx) { buildConsole(); buildMixer(); }
}

// Load a full demo: swap the rig, reveal its arrangement (Song view), announce
// it, and start playing — picking a demo is a deliberate gesture, so it plays.
async function loadDemo(demo) {
  loadRigState(buildDemoState(demo));
  if (playMode !== 'song') setView('song');
  document.getElementById('status').textContent = `Loaded ${demo.name} — press Undo to go back`;
  await startTransport();
}

// New Rig: one-click blank slate. Lands you in Pattern view, stopped, ready to
// build. Undoable like any rig load.
function newRig() {
  loadRigState(buildBlankState());
  if (playMode !== 'pattern') setView('pattern');
  document.getElementById('status').textContent = 'Blank rig — build something (Undo to restore)';
}

// Console: one instrument on screen at a time, chosen by the tab bar. ALL
// instrument editors are built and registered (so every machine keeps
// SOUNDING) but only the active tab's editor is shown — the groove-box model.
// Song is a separate view (see applyView), not a stacked panel. Rebuilt on
// undo/import/pattern-structure changes; audio nodes + mixer survive rebuilds.
function buildConsole() {
  const tabsEl = document.getElementById('instrument-tabs');
  const editor = document.getElementById('machines');
  tabsEl.innerHTML = '';
  editor.innerHTML = '';
  scheduler.unregisterAll();
  scheduler.register(conductor); // FIRST: row advances must land before panels read the step
  const now = () => ctx.currentTime;

  tabsEl.setAttribute('role', 'tablist');
  tabsEl.setAttribute('aria-label', 'Instrument');
  const wrappers = {};
  const tabButtons = {};
  MACHINE_DEFS.forEach((def, idx) => {
    const btn = document.createElement('button');
    btn.className = 'inst-tab-btn';
    btn.id = `tab-${def.key}`;
    btn.textContent = def.label;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `panel-${def.key}`);
    btn.style.setProperty('--accent', def.accent);
    btn.addEventListener('click', () => selectTab(def.key));
    // Arrow keys move between tabs (standard tablist behavior).
    btn.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = MACHINE_DEFS[(idx + d + MACHINE_DEFS.length) % MACHINE_DEFS.length];
      selectTab(next.key);
      tabButtons[next.key].focus();
    });
    tabsEl.appendChild(btn);
    tabButtons[def.key] = btn;

    const wrapper = document.createElement('div');
    wrapper.className = 'inst-wrapper machine-section';
    wrapper.id = `panel-${def.key}`;
    wrapper.setAttribute('role', 'tabpanel');
    wrapper.setAttribute('aria-labelledby', `tab-${def.key}`);
    wrapper.style.setProperty('--accent', def.accent);
    editor.appendChild(wrapper);
    wrappers[def.key] = wrapper;

    createPatternBar(wrapper, {
      store, machineKey: def.key,
      makeBlank: () => makeBlankPattern(def),
      onStructureChange: () => { buildConsole(); updateUndoButton(); },
    });

    let panel;
    if (def.kind === '303') {
      panel = createVoice303Panel(wrapper, {
        label: def.label, node: rig.nodes[def.key], pattern: store.activePattern(def.key), now,
        patch: store.getState().patches[def.key] || DEFAULT_PATCHES[def.key],
        defaultPatch: DEFAULT_PATCHES[def.key],
        edit: editWithUndo,
        onPatchChange: (patch) => store.setNoUndo((s) => { s.patches[def.key] = patch; }),
        getPlayingPattern: () => playingPatternFor(def.key),
      });
    } else {
      panel = createDrumPanel(wrapper, {
        label: def.label, node: rig.nodes[def.key], pattern: store.activePattern(def.key), now,
        laneOrder: def.laneOrder, laneLabels: def.laneLabels, laneKnobs: def.laneKnobs,
        knobs: store.getState().patches[def.key] || null,
        edit: editWithUndo,
        onKnobsChange: (knobs) => store.setNoUndo((s) => { s.patches[def.key] = knobs; }),
        getPlayingPattern: () => playingPatternFor(def.key),
      });
    }
    scheduler.register(panel); // registered regardless of visibility -> always plays
  });

  function selectTab(key) {
    activeTab = key;
    for (const def of MACHINE_DEFS) {
      const sel = def.key === key;
      wrappers[def.key].style.display = sel ? '' : 'none';
      tabButtons[def.key].classList.toggle('active', sel);
      tabButtons[def.key].setAttribute('aria-selected', String(sel));
      tabButtons[def.key].tabIndex = sel ? 0 : -1; // roving: only the active tab is a tab stop
    }
  }
  if (!MACHINE_DEFS.some((d) => d.key === activeTab)) activeTab = MACHINE_DEFS[0].key;
  selectTab(activeTab);

  buildSong();
  applyView();
}

// Rebuilt (not just re-applied) whenever the rig is replaced — the panel reads
// the store's mixer slice and applies it to the surviving audio graph, so a
// loaded demo's sends/levels take effect and the controls show the right state.
function buildMixer() {
  const el = document.getElementById('mixer');
  el.innerHTML = '';
  const fx = rig.fx;
  mixerPanel = createMixerPanel(el, {
    machines: rig.mixChannels,
    distStages: [fx.distSolo, fx.distToDelay],
    delayNode: fx.delayNode, delayFeedback: fx.delayFeedback, delayWet: fx.delayWet,
    glueCompressor: fx.glueCompressor, masterGain: fx.masterGain,
    getBpm: () => scheduler.bpm,
    mixerState: store.getState().mixer,
    persist: (fn) => store.setNoUndo((s) => fn(s.mixer)),
  });
}

function buildSong() {
  songUI = createSongPanel(document.getElementById('song'), {
    store,
    machineDefs: MACHINE_DEFS,
    edit: editWithUndo,
    rebuild: buildSong,
    now: () => ctx.currentTime,
  });
}

// Pattern view = instrument tabs + editor; Song view = the arranger. The
// mixer is docked and stays visible in both. playMode drives both the view
// and playback (you're either jamming a pattern or arranging a song).
function applyView() {
  const patternView = playMode === 'pattern';
  document.getElementById('instrument-tabs').style.display = patternView ? '' : 'none';
  document.getElementById('machines').style.display = patternView ? '' : 'none';
  document.getElementById('song').style.display = patternView ? 'none' : '';
  const vp = document.getElementById('viewPattern');
  const vs = document.getElementById('viewSong');
  vp.classList.toggle('active', patternView);
  vs.classList.toggle('active', !patternView);
  vp.setAttribute('aria-pressed', String(patternView));
  vs.setAttribute('aria-pressed', String(!patternView));
}

function setView(v) {
  if (v === playMode) return;
  stopTransport(); // mode switches take effect from a clean start
  playMode = v;
  applyView();
}

function applyTransportUI() {
  const s = store.getState();
  const tempoSlider = document.getElementById('tempo');
  const shuffleSlider = document.getElementById('shuffle');
  tempoSlider.value = s.tempo;
  document.getElementById('tempoVal').textContent = s.tempo;
  shuffleSlider.value = s.shuffle;
  document.getElementById('shuffleVal').textContent = s.shuffle;
  if (scheduler) {
    scheduler.setTempo(s.tempo);
    scheduler.setShuffle(s.shuffle);
  }
  if (mixerPanel) mixerPanel.updateDelayTimeForBpm();
}

function buildDistStage() {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  input.connect(dry).connect(output);
  input.connect(shaper).connect(wet).connect(output);
  return { input, output, dry, wet, shaper };
}

function createMixChannel(muteGain, { dryBus, distSolo, distToDelay, delaySendBus }) {
  const mixLevelGain = ctx.createGain();
  mixLevelGain.gain.value = CFG.EFFECTS.MIXER_LEVEL_DEFAULT;
  const dryRouteGain = ctx.createGain();
  const distRouteGain = ctx.createGain();
  const delayRouteGain = ctx.createGain();
  dryRouteGain.gain.value = 1;
  distRouteGain.gain.value = 0;
  delayRouteGain.gain.value = 0;

  muteGain.connect(mixLevelGain);
  mixLevelGain.connect(dryRouteGain).connect(dryBus);
  mixLevelGain.connect(distRouteGain);
  distRouteGain.connect(distSolo.input);
  mixLevelGain.connect(delayRouteGain).connect(delaySendBus);

  const setRouting = (distOn, delayOn) => {
    const t = ctx.currentTime;
    distRouteGain.disconnect();
    distRouteGain.connect(delayOn ? distToDelay.input : distSolo.input);
    dryRouteGain.gain.setTargetAtTime((distOn || delayOn) ? 0 : 1, t, CFG.MUTE_RAMP_S);
    distRouteGain.gain.setTargetAtTime(distOn ? 1 : 0, t, CFG.MUTE_RAMP_S);
    delayRouteGain.gain.setTargetAtTime((delayOn && !distOn) ? 1 : 0, t, CFG.MUTE_RAMP_S);
  };

  return { muteGain, mixLevelGain, setRouting };
}

// Builds the entire audio graph + UI once, at page load. The AudioContext
// starts suspended (browser autoplay policy) so nothing is audible until the
// user hits RUN, which resumes it — but every panel is visible from the start.
async function initAudio() {
  if (ctx) return;
  ctx = new AudioContext();

  const masterGain = ctx.createGain();
  masterGain.gain.value = CFG.MASTER_GAIN_DEFAULT;

  const limiter = ctx.createDynamicsCompressor();
  const L = CFG.MASTER_LIMITER;
  limiter.threshold.value = L.threshold;
  limiter.knee.value = L.knee;
  limiter.ratio.value = L.ratio;
  limiter.attack.value = L.attack;
  limiter.release.value = L.release;

  // Effects chain: Distortion -> Delay -> Compressor -> master volume.
  const glueCompressor = ctx.createDynamicsCompressor();
  const dryBus = ctx.createGain();
  dryBus.connect(glueCompressor);

  const distSolo = buildDistStage();
  const distToDelay = buildDistStage();
  distSolo.output.connect(glueCompressor);

  const delaySendBus = ctx.createGain();
  distToDelay.output.connect(delaySendBus);
  const delayNode = ctx.createDelay(CFG.EFFECTS.DELAY.MAX_DELAY_S);
  const delayFeedback = ctx.createGain();
  const delayWet = ctx.createGain();
  delaySendBus.connect(glueCompressor);
  delaySendBus.connect(delayNode);
  delayNode.connect(delayFeedback).connect(delayNode);
  delayNode.connect(delayWet).connect(glueCompressor);

  glueCompressor.connect(masterGain);
  masterGain.connect(limiter).connect(ctx.destination);

  await ctx.audioWorklet.addModule('js/worklets/voice303.js');
  await ctx.audioWorklet.addModule('js/worklets/drum808.js');
  await ctx.audioWorklet.addModule('js/worklets/drum909.js');

  const makeVoiceNode = (name) =>
    new AudioWorkletNode(ctx, name, { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
  rig.nodes['303a'] = makeVoiceNode('voice303');
  rig.nodes['303b'] = makeVoiceNode('voice303');
  rig.nodes['808'] = makeVoiceNode('drum808');
  rig.nodes['909'] = makeVoiceNode('drum909');

  const fxBus = { dryBus, distSolo, distToDelay, delaySendBus };
  const mixChannels = [];
  for (const def of MACHINE_DEFS) {
    const muteGain = ctx.createGain();
    rig.nodes[def.key].connect(muteGain);
    mixChannels.push({ key: def.key, label: def.label, ...createMixChannel(muteGain, fxBus) });
  }
  // Stash channels + FX nodes so buildMixer() can rebuild the panel against the
  // same (once-created) audio graph when the rig is replaced.
  rig.mixChannels = mixChannels;
  rig.fx = { distSolo, distToDelay, delayNode, delayFeedback, delayWet, glueCompressor, masterGain };

  scheduler = new Scheduler(() => ctx.currentTime);
  buildConsole();
  buildMixer();

  applyTransportUI();
  document.getElementById('status').textContent = 'ready';
}

function wireTransport() {
  const playBtn = document.getElementById('play');
  const tempoSlider = document.getElementById('tempo');
  const shuffleSlider = document.getElementById('shuffle');

  tempoSlider.min = CFG.TEMPO_MIN_BPM;
  tempoSlider.max = CFG.TEMPO_MAX_BPM;
  applyTransportUI();

  const togglePlay = async () => {
    await initPromise; // in case RUN is hit while modules are still loading
    if (scheduler.playing) stopTransport();
    else await startTransport();
  };
  playBtn.addEventListener('click', togglePlay);

  document.getElementById('viewPattern').addEventListener('click', () => setView('pattern'));
  document.getElementById('viewSong').addEventListener('click', () => setView('song'));

  // Full-rig Demos: load a whole track. Snaps the select back to its
  // placeholder after loading (it's an action, not a persistent selection).
  const demoSelect = document.getElementById('demos');
  DEMO_LIBRARY.forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = d.name;
    demoSelect.appendChild(opt);
  });
  demoSelect.addEventListener('change', () => {
    const idx = demoSelect.value;
    demoSelect.value = '';
    if (idx === '') return;
    loadDemo(DEMO_LIBRARY[parseInt(idx, 10)]);
  });

  // New Rig: one-click blank slate across all four machines.
  document.getElementById('newRig').addEventListener('click', newRig);

  // Keyboard shortcuts. Ignore while typing in a field so pattern renaming and
  // repeat entry aren't hijacked.
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      document.getElementById('undo').click();
    }
  });

  tempoSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('tempoVal').textContent = v;
    store.setNoUndo((s) => { s.tempo = v; });
    if (scheduler) scheduler.setTempo(v);
    if (mixerPanel) mixerPanel.updateDelayTimeForBpm();
  });

  shuffleSlider.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('shuffleVal').textContent = v;
    store.setNoUndo((s) => { s.shuffle = v; });
    if (scheduler) scheduler.setShuffle(v);
  });

  document.getElementById('undo').addEventListener('click', () => {
    if (!store.undo()) return;
    updateUndoButton();
    applyTransportUI();
    if (ctx) { buildConsole(); buildMixer(); }
  });

  document.getElementById('export').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'squelch-patterns.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  const fileInput = document.getElementById('importFile');
  document.getElementById('import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      store.importJSON(await file.text());
      updateUndoButton();
      applyTransportUI();
      if (ctx) { buildConsole(); buildMixer(); }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  });

  const help = createHelp();
  document.getElementById('learn').addEventListener('click', () => help.open());
}

wireTransport();
maybeShowNudge();
initPromise = initAudio(); // build the full rig immediately; audio stays suspended until RUN
