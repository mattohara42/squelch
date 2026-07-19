// Pure math for the M5 effects chain — no AudioContext needed, so this is
// unit-testable directly in Node.
import { CFG } from './config.js';

// Classic WaveShaper distortion curve (amount 0..1).
export function makeDistortionCurve(amount) {
  const n = CFG.EFFECTS.DISTORTION.CURVE_SAMPLES;
  const k = amount * 100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Tempo-synced delay time: one bar (4 beats) divided into `steps` equal parts.
export function delayTimeForSteps(bpm, steps) {
  const barSeconds = (60 / bpm) * 4;
  return barSeconds / steps;
}

// Compressor "Amount" knob (0..1) -> ratio (1..RATIO_MAX). 0 = transparent.
export function compressorRatioForAmount(amount) {
  const C = CFG.EFFECTS.COMPRESSOR;
  return C.RATIO_MIN + amount * (C.RATIO_MAX - C.RATIO_MIN);
}
