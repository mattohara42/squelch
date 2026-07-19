// Headless worklet harness (Node + stubbed AudioWorklet globals).
// Runs the shared DSP checks against both the frozen M0 spike and the
// production js/worklets/voice303.js, plus one production-only check for
// the sample-accurate note queue. Run before shipping any DSP change.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 48000;
const BLOCK = 128;

function loadSpike() {
  global.sampleRate = SAMPLE_RATE;
  global.AudioWorkletProcessor = class {
    constructor() { this.port = { onmessage: null, postMessage() {} }; }
  };
  let registered = null;
  global.registerProcessor = (name, cls) => { registered = cls; };
  const src = fs.readFileSync(path.join(__dirname, '../spike/voice303-processor.js'), 'utf8');
  new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', src)(
    global.AudioWorkletProcessor, global.registerProcessor, SAMPLE_RATE
  );
  return registered;
}

let loadCounter = 0;
async function loadProduction() {
  global.sampleRate = SAMPLE_RATE;
  global.currentTime = 0;
  global.AudioWorkletProcessor = class {
    constructor() { this.port = { onmessage: null, postMessage() {} }; }
  };
  let registered = null;
  global.registerProcessor = (name, cls) => { registered = cls; };
  await import('../js/worklets/voice303.js?t=' + (loadCounter++)); // unique per call so the ESM cache always re-executes the module
  return registered;
}

const DRIVERS = [
  { name: 'spike', load: loadSpike, trigger: (v, msg) => v.handleMessage(msg) },
  { name: 'production', load: loadProduction, trigger: (v, msg) => v.applyNote(msg) },
];

function paramsFor(overrides, defaults) {
  const merged = Object.assign({}, defaults, overrides);
  const p = {};
  for (const k in merged) p[k] = new Float32Array([merged[k]]);
  return p;
}

function runBlocks(v, params, nBlocks) {
  const samples = [];
  for (let b = 0; b < nBlocks; b++) {
    const out = new Float32Array(BLOCK);
    v.process([], [[out]], params);
    for (let i = 0; i < BLOCK; i++) samples.push(out[i]);
    if (typeof global.currentTime === 'number') global.currentTime += BLOCK / SAMPLE_RATE;
  }
  return samples;
}

function rms(samples) {
  const sum = samples.reduce((s, x) => s + x * x, 0);
  return Math.sqrt(sum / samples.length);
}

async function testStability(driver) {
  const Voice = await driver.load();
  const v = new Voice();
  const worstCase = { tuning: 24, cutoff: 4000, resonance: 1, envMod: 1, decay: 200, accent: 1, volume: 1 };
  const params = paramsFor(worstCase, worstCase);

  driver.trigger(v, { type: 'note', note: 33, gate: true, accent: true, slide: false });
  let samples = runBlocks(v, params, 20);
  driver.trigger(v, { type: 'note', gate: false });
  samples = samples.concat(runBlocks(v, params, 20));
  for (let i = 0; i < 10; i++) {
    driver.trigger(v, { type: 'note', note: 33 + i, gate: true, accent: i % 2 === 0, slide: i % 3 === 0 });
    samples = samples.concat(runBlocks(v, params, 5));
  }

  for (const s of samples) {
    assert.ok(Number.isFinite(s), `[${driver.name}] sample is finite (no NaN/Infinity)`);
    assert.ok(Math.abs(s) <= 0.98 + 1e-9, `[${driver.name}] sample within clamp: ${s}`);
  }
  console.log(`PASS [${driver.name}] stability: no NaN, peak`, Math.max(...samples.map(Math.abs)).toFixed(4), '<= 0.98');
}

async function testAccentRMS(driver) {
  const Voice = await driver.load();
  const defaults = { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 400, accent: 0.7, volume: 0.8 };
  const params = paramsFor({}, defaults);

  const vNormal = new Voice();
  driver.trigger(vNormal, { type: 'note', note: 45, gate: true, accent: false, slide: false });
  const normalSamples = runBlocks(vNormal, params, 40);

  const vAccent = new Voice();
  driver.trigger(vAccent, { type: 'note', note: 45, gate: true, accent: true, slide: false });
  const accentSamples = runBlocks(vAccent, params, 40);

  const rmsNormal = rms(normalSamples);
  const rmsAccent = rms(accentSamples);
  const deltaPct = ((rmsAccent - rmsNormal) / rmsNormal) * 100;

  assert.ok(rmsAccent > rmsNormal, `[${driver.name}] accented note is louder than normal note`);
  assert.ok(deltaPct > 15, `[${driver.name}] accent RMS delta is meaningful (got ${deltaPct.toFixed(1)}%, want >15%)`);
  console.log(`PASS [${driver.name}] accent RMS delta: +${deltaPct.toFixed(1)}% (normal ${rmsNormal.toFixed(4)}, accent ${rmsAccent.toFixed(4)})`);
}

async function testSlideGlide(driver) {
  const Voice = await driver.load();
  const defaults = { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 1000, accent: 0.7, volume: 0.8 };
  const params = paramsFor({}, defaults);
  const v = new Voice();

  driver.trigger(v, { type: 'note', note: 33, gate: true, accent: false, slide: false });
  runBlocks(v, params, 10);
  const envBeforeSlide = v.env;
  assert.ok(envBeforeSlide < 1 && envBeforeSlide > 0, `[${driver.name}] envelope decaying before slide`);

  driver.trigger(v, { type: 'note', note: 45, gate: true, accent: false, slide: true });
  assert.strictEqual(v.env, envBeforeSlide, `[${driver.name}] slide does not retrigger the envelope`);

  const freqs = [];
  for (let b = 0; b < 100; b++) { // ~266ms, >6 tau at 35ms so error is negligible
    runBlocks(v, params, 1);
    freqs.push(v.freq);
  }
  const targetFreq = 440 * Math.pow(2, (45 - 69) / 12);
  for (let i = 1; i < freqs.length; i++) {
    assert.ok(freqs[i] >= freqs[i - 1] - 1e-6, `[${driver.name}] freq moves monotonically toward target during glide`);
  }
  const finalError = Math.abs(freqs[freqs.length - 1] - targetFreq) / targetFreq;
  assert.ok(finalError < 0.01, `[${driver.name}] glide converges to target freq (residual error ${(finalError * 100).toFixed(2)}%)`);
  console.log(`PASS [${driver.name}] slide glide: no retrigger, monotonic approach, converged within`, (finalError * 100).toFixed(3) + '%');
}

// Production-only: a note queued for a time inside the *next* block must not
// sound before its scheduled sample, proving the lookahead scheduler can post
// events ahead of time without them firing early.
async function testProductionQueueTiming() {
  const Voice = await loadProduction();
  const defaults = { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 400, accent: 0.7, volume: 0.8 };
  const params = paramsFor({}, defaults);
  const v = new Voice();

  // Post a note scheduled 50 samples into the future (as the lookahead
  // scheduler would, up to 120ms ahead) before any audio has been pulled.
  global.currentTime = 0;
  const triggerSample = 50;
  const triggerTime = triggerSample / SAMPLE_RATE;
  v.port.onmessage({ data: { type: 'note', time: triggerTime, note: 45, gate: true, accent: false, slide: false } });

  // Render only up to (not including) the scheduled sample: must not fire early.
  v.process([], [[new Float32Array(triggerSample)]], params);
  assert.strictEqual(v.gate, false, '[production] note has not fired before its scheduled sample');

  // Advance the clock past the scheduled sample and render the rest: must fire now.
  global.currentTime = triggerSample / SAMPLE_RATE;
  v.process([], [[new Float32Array(BLOCK - triggerSample)]], params);
  assert.strictEqual(v.gate, true, '[production] note fires once currentTime reaches its scheduled sample');

  console.log('PASS [production] queued note fires exactly at its scheduled sample, not before');
}

// Production-only: the scheduler sends an explicit gate:false message on
// *every* rest step, not just the on->off transition. Redundant gate:false
// messages while already off must not retrigger the release envelope, or
// every rest step would produce an audible click even with all notes off.
async function testNoRepeatedGateOffClick() {
  const Voice = await loadProduction();
  const defaults = { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 400, accent: 0.7, volume: 0.8 };
  const params = paramsFor({}, defaults);
  const v = new Voice();

  v.port.onmessage({ data: { type: 'note', time: 0, note: 45, gate: true, accent: false, slide: false } });
  runBlocks(v, params, 5);
  v.port.onmessage({ data: { type: 'note', time: global.currentTime, gate: false } }); // real on->off transition
  runBlocks(v, params, 100); // let the release fully decay (~266ms, well past the 30ms release tau)
  assert.ok(v.releaseEnv < 0.001, `release has decayed to silence (releaseEnv=${v.releaseEnv})`);

  // Simulate several subsequent rest steps: each sends a redundant gate:false.
  let maxPeakAfterRedundantOff = 0;
  for (let i = 0; i < 4; i++) {
    v.port.onmessage({ data: { type: 'note', time: global.currentTime, gate: false } });
    assert.ok(v.releaseEnv < 0.001, `redundant gate:false does not retrigger the release (releaseEnv=${v.releaseEnv})`);
    const samples = runBlocks(v, params, 10);
    maxPeakAfterRedundantOff = Math.max(maxPeakAfterRedundantOff, ...samples.map(Math.abs));
  }
  assert.ok(maxPeakAfterRedundantOff < 0.001, `no audible click from redundant gate:false (peak ${maxPeakAfterRedundantOff})`);
  console.log('PASS [production] redundant gate:false on rest steps does not click, peak', maxPeakAfterRedundantOff.toFixed(6));
}

// Production-only: pressing Stop mid-note must not leave a drone. The
// lookahead scheduler can have posted a gate-on up to 120ms ahead with no
// follow-up gate-off; the 'stop' message must flush the queue and release.
async function testStopKillsDrone() {
  const Voice = await loadProduction();
  const defaults = { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 400, accent: 0.7, volume: 0.8 };
  const params = paramsFor({}, defaults);
  const v = new Voice();

  // A note is sounding, and another gate-on sits queued in the future.
  v.port.onmessage({ data: { type: 'note', time: 0, note: 45, gate: true, accent: false, slide: false } });
  runBlocks(v, params, 5);
  v.port.onmessage({ data: { type: 'note', time: global.currentTime + 0.1, note: 47, gate: true, accent: false, slide: false } });

  v.port.onmessage({ data: { type: 'stop' } });
  assert.strictEqual(v.queue.length, 0, 'stop flushes the lookahead queue');
  assert.strictEqual(v.gate, false, 'stop releases the gate');

  const samples = runBlocks(v, params, 100); // well past the queued note's time and the release tau
  const tailPeak = Math.max(...samples.slice(-1280).map(Math.abs));
  assert.ok(tailPeak < 0.001, `no drone after stop (tail peak ${tailPeak})`);
  console.log('PASS [production] stop flushes queue and releases gate, tail peak', tailPeak.toFixed(6));
}

(async () => {
  for (const driver of DRIVERS) {
    await testStability(driver);
    await testAccentRMS(driver);
    await testSlideGlide(driver);
  }
  await testProductionQueueTiming();
  await testNoRepeatedGateOffClick();
  await testStopKillsDrone();
  console.log('\nAll voice303 tests passed.');
})();
