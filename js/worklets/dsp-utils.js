// Shared building blocks for percussion synthesis worklets (drum808, drum909).
// Relies on `sampleRate` being present in the AudioWorkletGlobalScope of
// whichever module imports these.

export function noise() {
  return Math.random() * 2 - 1;
}

export function hpStep(x, state, key, coef) {
  state[key] = state[key] + coef * (x - state[key]);
  return x - state[key];
}

export function hpCoefFor(hz) {
  return 1 - Math.exp((-2 * Math.PI * hz) / sampleRate);
}

export function expMult(ms) {
  return Math.exp(-1 / (sampleRate * (ms / 1000)));
}
