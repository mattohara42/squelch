// Production 909: kick/snare/toms/rimshot/clap synthesized in real time,
// same one-processor/one-bus architecture as drum808. Hats/cymbals are the
// M4 decision point: procedurally generated into a fixed buffer once at
// load time (per SPEC.md), then played back like a one-shot sample — not
// resynthesized live. If these don't convince by ear, the fallback is small
// base64 samples for ch/oh/cc/rc only (not built unless that A/B fails).
import { CFG } from '../config.js';
import { noise, hpStep, hpCoefFor, expMult } from './dsp-utils.js';

const D = CFG.DRUM909;
const L = D.LANES;
const METALLIC = D.METALLIC_OSC_FREQS_HZ;

function tuneMultFrom(tuneParam) {
  const t = tuneParam != null ? tuneParam : 0.5;
  const semis = (t - 0.5) * D.TUNE_RANGE_SEMITONES;
  return Math.pow(2, semis / 12);
}

function generateMetallicBuffer(lengthMs, decayMs, hpHz) {
  const n = Math.round((sampleRate * lengthMs) / 1000);
  const buf = new Float32Array(n);
  const decayMult = expMult(decayMs);
  const phases = METALLIC.map(() => 0);
  const coef = hpCoefFor(hpHz);
  let env = 1;
  let hp = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < METALLIC.length; j++) {
      phases[j] += METALLIC[j] / sampleRate;
      if (phases[j] >= 1) phases[j] -= 1;
      sum += phases[j] < 0.5 ? 1 : -1;
    }
    sum /= METALLIC.length;
    hp = hp + coef * (sum - hp);
    const hpOut = sum - hp;
    buf[i] = hpOut * env;
    env *= decayMult;
  }
  return buf;
}

// Generated once at module load (sampleRate is available in the worklet
// global scope by the time this module is evaluated), not per hit.
const buffers = {
  ch: generateMetallicBuffer(L.ch.bufferLengthMs, L.ch.decayMs, L.ch.hpHz),
  oh: generateMetallicBuffer(L.oh.bufferLengthMs, L.oh.decayMaxMs, L.oh.hpHz),
  cc: generateMetallicBuffer(L.cc.bufferLengthMs, L.cc.decayMs, L.cc.hpHz),
  rc: generateMetallicBuffer(L.rc.bufferLengthMs, L.rc.decayMs, L.rc.hpHz),
};

const LANES = {
  bd: {
    trigger(s, p) {
      s.env = 1; s.pitchEnv = 1; s.phase = 0; s.clickEnv = 1;
      const decayMs = p.decay != null ? L.bd.decayMinMs + p.decay * (L.bd.decayMaxMs - L.bd.decayMinMs) : L.bd.decayDefaultMs;
      s.decayMult = expMult(decayMs);
      s.pitchMult = expMult(L.bd.pitchTauMs);
      s.clickMult = expMult(L.bd.attackClickMs);
      s.attack = p.attack != null ? p.attack : L.bd.attackDefault;
      s.tuneMult = tuneMultFrom(p.tune);
    },
    render(s) {
      const freq = (L.bd.baseFreqHz + L.bd.pitchSweepHz * s.pitchEnv) * s.tuneMult;
      s.phase += freq / sampleRate; if (s.phase >= 1) s.phase -= 1;
      const click = noise() * s.clickEnv * s.attack;
      const out = Math.sin(2 * Math.PI * s.phase) * s.env + click;
      s.env *= s.decayMult; s.pitchEnv *= s.pitchMult; s.clickEnv *= s.clickMult;
      return out;
    },
  },
  sd: {
    trigger(s, p) {
      s.tonalEnv = 1; s.noiseEnv = 1; s.phase1 = 0; s.phase2 = 0; s.hp = 0;
      const tone = p.tone != null ? p.tone : L.sd.toneDefault;
      const snappy = p.snappy != null ? p.snappy : L.sd.snappyDefault;
      s.tonalMult = expMult(L.sd.tonalDecayMs * (0.6 + tone));
      const noiseMs = L.sd.noiseDecayMinMs + snappy * (L.sd.noiseDecayMaxMs - L.sd.noiseDecayMinMs);
      s.noiseMult = expMult(noiseMs);
      s.tuneMult = tuneMultFrom(p.tune);
    },
    render(s) {
      s.phase1 += (L.sd.toneFreqsHz[0] * s.tuneMult) / sampleRate; if (s.phase1 >= 1) s.phase1 -= 1;
      s.phase2 += (L.sd.toneFreqsHz[1] * s.tuneMult) / sampleRate; if (s.phase2 >= 1) s.phase2 -= 1;
      const tonal = 0.5 * Math.sin(2 * Math.PI * s.phase1) + 0.5 * Math.sin(2 * Math.PI * s.phase2);
      const noiseHp = hpStep(noise(), s, 'hp', hpCoefFor(1000));
      const out = tonal * s.tonalEnv * 0.6 + noiseHp * s.noiseEnv * 0.8;
      s.tonalEnv *= s.tonalMult; s.noiseEnv *= s.noiseMult;
      return out;
    },
  },
  ...['lt', 'mt', 'ht'].reduce((acc, name) => {
    acc[name] = {
      trigger(s, p) {
        s.env = 1; s.phase = 0;
        const cfg = L[name];
        const decayMs = p.decay != null ? cfg.decayMinMs + p.decay * (cfg.decayMaxMs - cfg.decayMinMs) : cfg.decayDefaultMs;
        s.decayMult = expMult(decayMs);
        s.tuneMult = tuneMultFrom(p.tune);
      },
      render(s) {
        s.phase += (L[name].baseFreqHz * s.tuneMult) / sampleRate; if (s.phase >= 1) s.phase -= 1;
        const out = Math.sin(2 * Math.PI * s.phase) * s.env;
        s.env *= s.decayMult;
        return out;
      },
    };
    return acc;
  }, {}),
  rs: {
    trigger(s) { s.env = 1; s.phase = 0; s.decayMult = expMult(L.rs.decayMs); },
    render(s) {
      s.phase += L.rs.toneFreqHz / sampleRate; if (s.phase >= 1) s.phase -= 1;
      const out = Math.sin(2 * Math.PI * s.phase) * s.env + noise() * s.env * 0.5;
      s.env *= s.decayMult;
      return out * 0.8;
    },
  },
  cp: {
    trigger(s) {
      const gapSamples = Math.round((sampleRate * L.cp.burstGapMs) / 1000);
      s.sampleCounter = 0;
      s.bursts = [0, 1, 2].map((i) => ({ delay: i * gapSamples, env: 0, triggered: false, mult: expMult(15) }));
      s.tail = { delay: 3 * gapSamples, env: 0, triggered: false, mult: expMult(L.cp.tailDecayMs) };
      s.hp = 0; s.lp = 0;
    },
    render(s) {
      for (const b of s.bursts) if (!b.triggered && s.sampleCounter >= b.delay) { b.env = 1; b.triggered = true; }
      if (!s.tail.triggered && s.sampleCounter >= s.tail.delay) { s.tail.env = 1; s.tail.triggered = true; }
      s.sampleCounter++;

      let totalEnv = s.tail.env;
      for (const b of s.bursts) { totalEnv += b.env; if (b.triggered) b.env *= b.mult; }
      if (s.tail.triggered) s.tail.env *= s.tail.mult;

      const n = noise();
      const hp = hpStep(n, s, 'hp', hpCoefFor(L.cp.bandHz * 0.7));
      s.lp = s.lp + hpCoefFor(L.cp.bandHz * 1.6) * (hp - s.lp);
      return s.lp * totalEnv * 0.7;
    },
  },
  ch: {
    trigger(s) { s.playhead = 0; },
    render(s) {
      const buf = buffers.ch;
      const v = s.playhead < buf.length ? buf[s.playhead] : 0;
      s.playhead++;
      return v;
    },
  },
  oh: {
    trigger(s, p) {
      s.playhead = 0;
      s.env = 1;
      const ms = L.oh.decayMinMs + (p.decay != null ? p.decay : 0.5) * (L.oh.decayMaxMs - L.oh.decayMinMs);
      s.decayMult = expMult(ms);
    },
    render(s) {
      const buf = buffers.oh;
      const raw = s.playhead < buf.length ? buf[s.playhead] : 0;
      s.playhead++;
      const out = raw * s.env;
      s.env *= s.decayMult;
      return out;
    },
  },
  ...['cc', 'rc'].reduce((acc, name) => {
    acc[name] = {
      trigger(s) { s.playhead = 0; },
      render(s) {
        const buf = buffers[name];
        const v = s.playhead < buf.length ? buf[s.playhead] : 0;
        s.playhead++;
        return v;
      },
    };
    return acc;
  }, {}),
};

const LANE_NAMES = Object.keys(LANES);

class Drum909Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'accentAmount', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.states = {};
    for (const name of LANE_NAMES) this.states[name] = { env: 0 };
    this.queue = [];
    this.port.onmessage = (e) => {
      if (e.data.type === 'stop') {
        this.queue.length = 0; // drop lookahead-queued hits; active one-shots decay naturally
      } else if (e.data.type === 'hit') {
        if (e.data.time == null) e.data.time = 0;
        this.queue.push(e.data);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    const accentAmount = parameters.accentAmount[0];

    for (let i = 0; i < out.length; i++) {
      const t = currentTime + i / sampleRate;
      while (this.queue.length && this.queue[0].time <= t) {
        const hit = this.queue.shift();
        const lane = LANES[hit.lane];
        if (!lane) continue;
        lane.trigger(this.states[hit.lane], hit.params || {});
        this.states[hit.lane].active = true;
        this.states[hit.lane].accentMult = hit.accent ? 1 + D.ACCENT_BOOST_GAIN * accentAmount : 1;
        this.states[hit.lane].level = hit.params && hit.params.level != null ? hit.params.level : 0.8;
      }

      let sum = 0;
      for (const name of LANE_NAMES) {
        const s = this.states[name];
        if (!s.active) continue;
        const v = LANES[name].render(s);
        sum += v * s.level * s.accentMult;
      }
      out[i] = Math.max(-1, Math.min(1, sum));
    }

    return true;
  }
}

registerProcessor('drum909', Drum909Processor);
