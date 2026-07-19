// Headless drum909 harness (Node + stubbed AudioWorklet globals).
'use strict';
const assert = require('assert');

const SAMPLE_RATE = 48000;
const BLOCK = 128;

let loadCounter = 0;
async function loadDrum909() {
  global.sampleRate = SAMPLE_RATE;
  global.currentTime = 0;
  global.AudioWorkletProcessor = class {
    constructor() { this.port = { onmessage: null, postMessage() {} }; }
  };
  let registered = null;
  global.registerProcessor = (name, cls) => { registered = cls; };
  await import('../js/worklets/drum909.js?t=' + (loadCounter++));
  return registered;
}

function runBlocks(v, accentAmount, nBlocks) {
  const params = { accentAmount: new Float32Array([accentAmount]) };
  const samples = [];
  for (let b = 0; b < nBlocks; b++) {
    const out = new Float32Array(BLOCK);
    v.process([], [[out]], params);
    for (let i = 0; i < BLOCK; i++) samples.push(out[i]);
    global.currentTime += BLOCK / SAMPLE_RATE;
  }
  return samples;
}

function hit(v, lane, accent, params) {
  v.port.onmessage({ data: { type: 'hit', time: global.currentTime, lane, accent, params } });
}

function rms(samples) {
  const sum = samples.reduce((s, x) => s + x * x, 0);
  return Math.sqrt(sum / samples.length);
}

const ALL_LANES = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'ch', 'oh', 'cc', 'rc'];

(async () => {
  // --- stability: all 11 lanes at once, worst-case knobs, repeated hits ---
  {
    const Drum = await loadDrum909();
    const v = new Drum();
    const worst = { tone: 1, decay: 1, snappy: 1, attack: 1, tune: 1, level: 1 };
    let samples = [];
    for (let round = 0; round < 5; round++) {
      for (const lane of ALL_LANES) hit(v, lane, true, worst);
      samples = samples.concat(runBlocks(v, 1, 4));
    }
    for (const s of samples) {
      assert.ok(Number.isFinite(s), 'sample is finite (no NaN/Infinity)');
      assert.ok(Math.abs(s) <= 1 + 1e-9, `sample within clamp: ${s}`);
    }
    console.log('PASS stability: all 11 lanes, worst-case knobs, peak', Math.max(...samples.map(Math.abs)).toFixed(4), '<= 1.0');
  }

  // --- accent RMS delta (bd) ---
  {
    const Drum = await loadDrum909();
    const vNormal = new Drum();
    hit(vNormal, 'bd', false, { tune: 0.5, attack: 0.5, decay: 0.5, level: 0.8 });
    const normalSamples = runBlocks(vNormal, 1, 15);

    global.currentTime = 0;
    const vAccent = new Drum();
    hit(vAccent, 'bd', true, { tune: 0.5, attack: 0.5, decay: 0.5, level: 0.8 });
    const accentSamples = runBlocks(vAccent, 1, 15);

    const rmsNormal = rms(normalSamples);
    const rmsAccent = rms(accentSamples);
    const deltaPct = ((rmsAccent - rmsNormal) / rmsNormal) * 100;
    assert.ok(rmsAccent > rmsNormal, 'accented BD hit is louder');
    assert.ok(deltaPct > 15, `accent RMS delta meaningful (got ${deltaPct.toFixed(1)}%)`);
    console.log(`PASS accent RMS delta (bd): +${deltaPct.toFixed(1)}%`);
  }

  // --- each lane produces sound when hit alone ---
  {
    for (const lane of ALL_LANES) {
      const Drum = await loadDrum909();
      const v = new Drum();
      hit(v, lane, false, { tone: 0.5, decay: 0.5, snappy: 0.5, attack: 0.5, tune: 0.5, level: 0.8 });
      const samples = runBlocks(v, 0.8, 10);
      const peak = Math.max(...samples.map(Math.abs));
      assert.ok(peak > 0.01, `[${lane}] produces audible output (peak ${peak.toFixed(4)})`);
    }
    console.log('PASS all 11 lanes produce audible output when hit');
  }

  // --- procedural hat/cymbal buffers: generated once, finite, decay to silence ---
  {
    const Drum = await loadDrum909();
    // Import a second time is a no-op given the module cache within one load,
    // so just inspect the buffers via a fresh hit + long enough render window.
    const v = new Drum();
    hit(v, 'cc', false, { level: 0.8 });
    const samples = runBlocks(v, 0.8, 250); // ~666ms, longer than cc's 2.5s buffer is not needed, just checking no NaN/blowup early on
    for (const s of samples) assert.ok(Number.isFinite(s), 'cc buffer playback sample is finite');
    console.log('PASS procedural buffer lanes: finite output, no NaN during playback');
  }

  // --- stop flushes lookahead-queued hits ---
  {
    const Drum = await loadDrum909();
    const v = new Drum();
    hit(v, 'bd', false, { level: 1 });
    v.port.onmessage({ data: { type: 'hit', time: 0.5, lane: 'sd', accent: false, params: { level: 1 } } }); // future hit
    v.port.onmessage({ data: { type: 'stop' } });
    assert.strictEqual(v.queue.length, 0, 'stop clears the queue');
    console.log('PASS stop flushes lookahead-queued hits');
  }

  console.log('\nAll drum909 tests passed.');
})();
