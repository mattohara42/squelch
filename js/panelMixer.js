import { CFG } from './config.js';
import { createKnob } from './knob.js';
import { makeDistortionCurve, delayTimeForSteps, compressorRatioForAmount } from './effectsMath.js';

const SMOOTH_TC_S = 0.02; // setTargetAtTime constant for click-free knob/fader moves

function createFader(container, { label, ariaLabel, min, max, value, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'fader-wrap';
  wrap.innerHTML = `
    <div class="fader-track"><input type="range" min="${min}" max="${max}" step="0.01" value="${value}" aria-label="${ariaLabel || label}"></div>
    <div class="fader-label" aria-hidden="true">${label}</div>`;
  container.appendChild(wrap);
  const input = wrap.querySelector('input');
  input.addEventListener('input', (e) => onChange(parseFloat(e.target.value)));
  return input;
}

function createLedToggle(container, { label, ariaLabel, className = '', initial = false, onChange }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `led-toggle ${className}`.trim();
  let on = !!initial;
  el.classList.toggle('on', on);
  el.setAttribute('aria-pressed', String(on));
  el.setAttribute('aria-label', ariaLabel || label);
  el.innerHTML = `<div class="led" aria-hidden="true"></div><div class="led-label" aria-hidden="true">${label}</div>`;
  el.addEventListener('click', () => {
    on = !on;
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
    onChange(on);
  });
  container.appendChild(el);
  return el;
}

// machines: [{ key, label, muteGain, mixLevelGain, setRouting }]. `mixerState`
// seeds every control's INITIAL value and is applied to the audio graph on
// build (so a loaded demo's sends/levels take effect immediately); `persist(fn)`
// writes a change back to the store's mixer slice. The panel is rebuilt from
// scratch when the rig is replaced (demo/undo/import), so it always reflects the
// stored mixer without needing a separate re-apply path.
export function createMixerPanel(container, { machines, distStages, delayNode, delayFeedback, delayWet, glueCompressor, masterGain, getBpm, mixerState, persist }) {
  const actx = masterGain.context;
  const smooth = (param, v) => param.setTargetAtTime(v, actx.currentTime, SMOOTH_TC_S);
  const ms = mixerState;

  const root = document.createElement('div');
  root.className = 'panelMixer';
  root.innerHTML = `<h2>Mixer</h2>`;
  container.appendChild(root);

  const strip = document.createElement('div');
  strip.className = 'mixer-strip';
  root.appendChild(strip);

  // --- per-machine channel strips ---
  for (const m of machines) {
    const cs = ms.channels[m.key];
    const ch = document.createElement('div');
    ch.className = 'mixer-channel';
    ch.innerHTML = `<div class="mixer-channel-label">${m.label}</div>`;
    strip.appendChild(ch);

    createFader(ch, {
      label: 'Level', ariaLabel: `${m.label} level`, min: 0, max: 1, value: cs.level,
      onChange: (v) => { smooth(m.mixLevelGain.gain, v); persist((mx) => { mx.channels[m.key].level = v; }); },
    });
    smooth(m.mixLevelGain.gain, cs.level); // apply initial level to the graph

    const toggleRow = document.createElement('div');
    toggleRow.className = 'mixer-toggles';
    ch.appendChild(toggleRow);

    let distOn = cs.dist;
    let delayOn = cs.delay;
    createLedToggle(toggleRow, {
      label: 'Dist', className: 'send-dist', initial: distOn, ariaLabel: `Send ${m.label} to distortion`,
      onChange: (on) => { distOn = on; m.setRouting(distOn, delayOn); persist((mx) => { mx.channels[m.key].dist = on; }); },
    });
    createLedToggle(toggleRow, {
      label: 'Delay', className: 'send-delay', initial: delayOn, ariaLabel: `Send ${m.label} to delay`,
      onChange: (on) => { delayOn = on; m.setRouting(distOn, delayOn); persist((mx) => { mx.channels[m.key].delay = on; }); },
    });
    m.setRouting(distOn, delayOn); // apply initial send routing to the graph
    createLedToggle(toggleRow, {
      label: 'Mute', className: 'mute-led', initial: cs.mute, ariaLabel: `Mute ${m.label}`,
      onChange: (on) => { m.muteGain.gain.setTargetAtTime(on ? 0 : 1, actx.currentTime, CFG.MUTE_RAMP_S); persist((mx) => { mx.channels[m.key].mute = on; }); },
    });
    if (cs.mute) m.muteGain.gain.value = 0; // apply initial mute
  }

  // --- shared FX section ---
  const fx = document.createElement('div');
  fx.className = 'mixer-fx';
  strip.appendChild(fx);

  // `accent` ('dist' | 'delay') color-codes a send-FX section to the matching
  // per-channel LED so the routing reads at a glance; `sub` captions where the
  // section's input comes from (a channel send, or the always-on master bus).
  const section = (label, { accent = '', sub = '' } = {}) => {
    const s = document.createElement('div');
    s.className = `mixer-fx-section${accent ? ` fx-${accent}` : ''}`;
    s.innerHTML = `<div class="mixer-fx-label">${label}</div>` +
      (sub ? `<div class="mixer-fx-sub" aria-hidden="true">${sub}</div>` : '');
    fx.appendChild(s);
    const knobs = document.createElement('div');
    knobs.className = 'knob-row';
    s.appendChild(knobs);
    return knobs;
  };

  // Distortion: one set of knobs drives both stages (they are the same
  // pedal — two instances exist only so dist-only channels bypass the delay).
  const distKnobs = section('Distortion', { accent: 'dist', sub: '◄ channel Dist sends' });
  const applyDistAmount = (v) => {
    const curve = makeDistortionCurve(v);
    for (const st of distStages) st.shaper.curve = curve;
  };
  const applyDistBlend = (v) => {
    for (const st of distStages) { smooth(st.wet.gain, v); smooth(st.dry.gain, 1 - v); }
  };
  createKnob(distKnobs, {
    label: 'Amount', min: 0, max: 1, value: ms.dist.amount,
    onChange: (v) => { applyDistAmount(v); persist((mx) => { mx.dist.amount = v; }); },
  });
  createKnob(distKnobs, {
    label: 'Blend', min: 0, max: 1, value: ms.dist.blend,
    onChange: (v) => { applyDistBlend(v); persist((mx) => { mx.dist.blend = v; }); },
  });
  applyDistAmount(ms.dist.amount);
  applyDistBlend(ms.dist.blend);

  // Delay.
  const delayControls = section('Delay', { accent: 'delay', sub: '◄ channel Delay sends' });
  let currentSteps = ms.delay.steps;
  const applyDelayTime = () => smooth(delayNode.delayTime, delayTimeForSteps(getBpm(), currentSteps));

  const stepsWrap = document.createElement('div');
  stepsWrap.className = 'knob-widget';
  const stepsSelect = document.createElement('select');
  stepsSelect.setAttribute('aria-label', 'Delay steps per bar');
  for (const s of CFG.EFFECTS.DELAY.STEP_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = `1/${s}`;
    if (s === currentSteps) opt.selected = true;
    stepsSelect.appendChild(opt);
  }
  stepsSelect.addEventListener('change', (e) => {
    currentSteps = parseInt(e.target.value, 10);
    applyDelayTime();
    persist((mx) => { mx.delay.steps = currentSteps; });
  });
  stepsWrap.innerHTML = '<div class="knob-label">Steps</div>';
  stepsWrap.prepend(stepsSelect);
  delayControls.appendChild(stepsWrap);
  applyDelayTime();

  createKnob(delayControls, {
    label: 'Feedback', min: 0, max: 1, value: ms.delay.feedback,
    onChange: (v) => { smooth(delayFeedback.gain, v * CFG.EFFECTS.DELAY.FEEDBACK_MAX); persist((mx) => { mx.delay.feedback = v; }); },
  });
  createKnob(delayControls, {
    label: 'Level', min: 0, max: 1, value: ms.delay.level,
    onChange: (v) => { smooth(delayWet.gain, v); persist((mx) => { mx.delay.level = v; }); },
  });
  delayFeedback.gain.value = ms.delay.feedback * CFG.EFFECTS.DELAY.FEEDBACK_MAX;
  delayWet.gain.value = ms.delay.level;

  // Compressor.
  const compKnobs = section('Compressor', { sub: 'master bus · all channels' });
  const C = CFG.EFFECTS.COMPRESSOR;
  createKnob(compKnobs, {
    label: 'Threshold', min: C.THRESHOLD_MIN_DB, max: C.THRESHOLD_MAX_DB, value: ms.comp.threshold,
    onChange: (v) => { smooth(glueCompressor.threshold, v); persist((mx) => { mx.comp.threshold = v; }); },
  });
  createKnob(compKnobs, {
    label: 'Amount', min: 0, max: 1, value: ms.comp.amount,
    onChange: (v) => { smooth(glueCompressor.ratio, compressorRatioForAmount(v)); persist((mx) => { mx.comp.amount = v; }); },
  });
  glueCompressor.threshold.value = ms.comp.threshold;
  glueCompressor.ratio.value = compressorRatioForAmount(ms.comp.amount);

  // Master volume.
  const masterSection = document.createElement('div');
  masterSection.className = 'mixer-channel';
  masterSection.innerHTML = '<div class="mixer-channel-label">Master</div>';
  fx.appendChild(masterSection);
  createFader(masterSection, {
    label: 'Volume', ariaLabel: 'Master volume', min: 0, max: 1, value: ms.master.volume,
    onChange: (v) => { smooth(masterGain.gain, v); persist((mx) => { mx.master.volume = v; }); },
  });
  smooth(masterGain.gain, ms.master.volume);

  return {
    updateDelayTimeForBpm() { applyDelayTime(); },
  };
}
