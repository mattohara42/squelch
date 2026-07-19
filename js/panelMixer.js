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

function createLedToggle(container, { label, ariaLabel, className = '', onChange }) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `led-toggle ${className}`.trim();
  el.setAttribute('aria-pressed', 'false');
  el.setAttribute('aria-label', ariaLabel || label);
  el.innerHTML = `<div class="led" aria-hidden="true"></div><div class="led-label" aria-hidden="true">${label}</div>`;
  let on = false;
  el.addEventListener('click', () => {
    on = !on;
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', String(on));
    onChange(on);
  });
  container.appendChild(el);
  return el;
}

// machines: [{ label, muteGain, mixLevelGain, setRouting }] — the audio-graph
// knowledge stays in main.js; this panel only renders controls and calls back.
export function createMixerPanel(container, { machines, distStages, delayNode, delayFeedback, delayWet, glueCompressor, masterGain, getBpm }) {
  const actx = masterGain.context;
  const smooth = (param, v) => param.setTargetAtTime(v, actx.currentTime, SMOOTH_TC_S);

  const root = document.createElement('div');
  root.className = 'panelMixer';
  root.innerHTML = `<h2>Mixer</h2>`;
  container.appendChild(root);

  const strip = document.createElement('div');
  strip.className = 'mixer-strip';
  root.appendChild(strip);

  // --- per-machine channel strips ---
  for (const m of machines) {
    const ch = document.createElement('div');
    ch.className = 'mixer-channel';
    ch.innerHTML = `<div class="mixer-channel-label">${m.label}</div>`;
    strip.appendChild(ch);

    createFader(ch, {
      label: 'Level', ariaLabel: `${m.label} level`, min: 0, max: 1, value: CFG.EFFECTS.MIXER_LEVEL_DEFAULT,
      onChange: (v) => smooth(m.mixLevelGain.gain, v),
    });

    const toggleRow = document.createElement('div');
    toggleRow.className = 'mixer-toggles';
    ch.appendChild(toggleRow);

    let distOn = false;
    let delayOn = false;
    createLedToggle(toggleRow, { label: 'Dist', ariaLabel: `${m.label} distortion`, onChange: (on) => { distOn = on; m.setRouting(distOn, delayOn); } });
    createLedToggle(toggleRow, { label: 'Delay', ariaLabel: `${m.label} delay`, onChange: (on) => { delayOn = on; m.setRouting(distOn, delayOn); } });
    createLedToggle(toggleRow, {
      label: 'Mute', className: 'mute-led', ariaLabel: `Mute ${m.label}`,
      onChange: (on) => m.muteGain.gain.setTargetAtTime(on ? 0 : 1, actx.currentTime, CFG.MUTE_RAMP_S),
    });
  }

  // --- shared FX section ---
  const fx = document.createElement('div');
  fx.className = 'mixer-fx';
  strip.appendChild(fx);

  const section = (label) => {
    const s = document.createElement('div');
    s.className = 'mixer-fx-section';
    s.innerHTML = `<div class="mixer-fx-label">${label}</div>`;
    fx.appendChild(s);
    const knobs = document.createElement('div');
    knobs.className = 'knob-row';
    s.appendChild(knobs);
    return knobs;
  };

  // Distortion: one set of knobs drives both stages (they are the same
  // pedal — two instances exist only so dist-only channels bypass the delay).
  const distKnobs = section('Distortion');
  const applyDistAmount = (v) => {
    const curve = makeDistortionCurve(v);
    for (const st of distStages) st.shaper.curve = curve;
  };
  const applyDistBlend = (v) => {
    for (const st of distStages) { smooth(st.wet.gain, v); smooth(st.dry.gain, 1 - v); }
  };
  createKnob(distKnobs, {
    label: 'Amount', min: 0, max: 1, value: CFG.EFFECTS.DISTORTION.AMOUNT_DEFAULT,
    onChange: applyDistAmount,
  });
  createKnob(distKnobs, {
    label: 'Blend', min: 0, max: 1, value: CFG.EFFECTS.DISTORTION.BLEND_DEFAULT,
    onChange: applyDistBlend,
  });
  applyDistAmount(CFG.EFFECTS.DISTORTION.AMOUNT_DEFAULT);
  applyDistBlend(CFG.EFFECTS.DISTORTION.BLEND_DEFAULT);

  // Delay.
  const delayControls = section('Delay');
  let currentSteps = CFG.EFFECTS.DELAY.STEPS_DEFAULT;
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
  stepsSelect.addEventListener('change', (e) => { currentSteps = parseInt(e.target.value, 10); applyDelayTime(); });
  stepsWrap.innerHTML = '<div class="knob-label">Steps</div>';
  stepsWrap.prepend(stepsSelect);
  delayControls.appendChild(stepsWrap);
  applyDelayTime();

  createKnob(delayControls, {
    label: 'Feedback', min: 0, max: 1, value: CFG.EFFECTS.DELAY.FEEDBACK_DEFAULT,
    onChange: (v) => smooth(delayFeedback.gain, v * CFG.EFFECTS.DELAY.FEEDBACK_MAX),
  });
  createKnob(delayControls, {
    label: 'Level', min: 0, max: 1, value: CFG.EFFECTS.DELAY.LEVEL_DEFAULT,
    onChange: (v) => smooth(delayWet.gain, v),
  });
  delayFeedback.gain.value = CFG.EFFECTS.DELAY.FEEDBACK_DEFAULT * CFG.EFFECTS.DELAY.FEEDBACK_MAX;
  delayWet.gain.value = CFG.EFFECTS.DELAY.LEVEL_DEFAULT;

  // Compressor.
  const compKnobs = section('Compressor');
  const C = CFG.EFFECTS.COMPRESSOR;
  createKnob(compKnobs, {
    label: 'Threshold', min: C.THRESHOLD_MIN_DB, max: C.THRESHOLD_MAX_DB, value: C.THRESHOLD_DEFAULT_DB,
    onChange: (v) => smooth(glueCompressor.threshold, v),
  });
  createKnob(compKnobs, {
    label: 'Amount', min: 0, max: 1, value: C.AMOUNT_DEFAULT,
    onChange: (v) => smooth(glueCompressor.ratio, compressorRatioForAmount(v)),
  });
  glueCompressor.threshold.value = C.THRESHOLD_DEFAULT_DB;
  glueCompressor.ratio.value = compressorRatioForAmount(C.AMOUNT_DEFAULT);

  // Master volume.
  const masterSection = document.createElement('div');
  masterSection.className = 'mixer-channel';
  masterSection.innerHTML = '<div class="mixer-channel-label">Master</div>';
  fx.appendChild(masterSection);
  createFader(masterSection, {
    label: 'Volume', ariaLabel: 'Master volume', min: 0, max: 1, value: CFG.MASTER_GAIN_DEFAULT,
    onChange: (v) => smooth(masterGain.gain, v),
  });

  return {
    updateDelayTimeForBpm() { applyDelayTime(); },
  };
}
