// Mixer state slice: per-channel level + dist/delay sends + mute, and the
// shared FX settings (distortion, delay, compressor, master). Persisted in the
// store (M6 had deliberately excluded it; full-rig Demos need it so a demo can
// carry its "sonic touches" — which sends are on, how much delay, etc.). Pure
// data + CFG; no DOM/audio, so it's unit-testable and safe for the store to
// import. Mixer moves are performance gestures (setNoUndo), like knob turns.
import { CFG } from './config.js';

const KEYS = ['303a', '303b', '808', '909'];

export function defaultMixerState() {
  const E = CFG.EFFECTS;
  return {
    channels: Object.fromEntries(KEYS.map((k) => [k, {
      level: E.MIXER_LEVEL_DEFAULT, dist: false, delay: false, mute: false,
    }])),
    dist: { amount: E.DISTORTION.AMOUNT_DEFAULT, blend: E.DISTORTION.BLEND_DEFAULT },
    delay: { steps: E.DELAY.STEPS_DEFAULT, feedback: E.DELAY.FEEDBACK_DEFAULT, level: E.DELAY.LEVEL_DEFAULT },
    comp: { threshold: E.COMPRESSOR.THRESHOLD_DEFAULT_DB, amount: E.COMPRESSOR.AMOUNT_DEFAULT },
    master: { volume: CFG.MASTER_GAIN_DEFAULT },
  };
}

// Overlay a partial spec (e.g. a demo's "sonic touches") onto the defaults.
export function mergeMixerState(partial) {
  const base = defaultMixerState();
  if (!partial) return base;
  if (partial.channels) {
    for (const k of KEYS) if (partial.channels[k]) Object.assign(base.channels[k], partial.channels[k]);
  }
  for (const grp of ['dist', 'delay', 'comp', 'master']) {
    if (partial[grp]) Object.assign(base[grp], partial[grp]);
  }
  return base;
}
