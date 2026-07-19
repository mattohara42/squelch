// Production 808: 12 fully synthesized lanes in one processor (one voice
// pool, one output bus — simpler graph than 12 separate nodes). Each lane's
// knobs (tone/decay/snappy/level) are applied at trigger time, matching how
// a real drum machine's knobs affect the next hit, not a sustained note.
import { CFG } from '../config.js';
import { noise, hpStep, hpCoefFor, expMult } from './dsp-utils.js';

const D = CFG.DRUM808;
const L = D.LANES;
const METALLIC = D.METALLIC_OSC_FREQS_HZ;

// Each lane gets a trigger(state, params, accentMult) and render(state) pair.
const LANES = {
  bd: {
    trigger(s, p) {
      s.env = 1; s.pitchEnv = 1; s.phase = 0;
      s.decayMult = expMult(p.decay != null ? p.decay : L.bd.decayDefaultMs);
      s.pitchMult = expMult(L.bd.pitchTauMs);
      s.tone = p.tone != null ? p.tone : L.bd.toneDefault;
    },
    render(s) {
      const freq = L.bd.baseFreqHz + L.bd.pitchSweepHz * s.tone * s.pitchEnv;
      s.phase += freq / sampleRate; if (s.phase >= 1) s.phase -= 1;
      const out = Math.sin(2 * Math.PI * s.phase) * s.env;
      s.env *= s.decayMult; s.pitchEnv *= s.pitchMult;
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
    },
    render(s) {
      s.phase1 += L.sd.toneFreqsHz[0] / sampleRate; if (s.phase1 >= 1) s.phase1 -= 1;
      s.phase2 += L.sd.toneFreqsHz[1] / sampleRate; if (s.phase2 >= 1) s.phase2 -= 1;
      const tonal = 0.5 * Math.sin(2 * Math.PI * s.phase1) + 0.5 * Math.sin(2 * Math.PI * s.phase2);
      const noiseHp = hpStep(noise(), s, 'hp', hpCoefFor(1000));
      const out = tonal * s.tonalEnv * 0.6 + noiseHp * s.noiseEnv * 0.8;
      s.tonalEnv *= s.tonalMult; s.noiseEnv *= s.noiseMult;
      return out;
    },
  },
  ...['lt', 'mt', 'ht'].reduce((acc, name) => {
    acc[name] = {
      trigger(s) { s.env = 1; s.phase = 0; s.decayMult = expMult(L[name].decayMs); },
      render(s) {
        s.phase += L[name].freqHz / sampleRate; if (s.phase >= 1) s.phase -= 1;
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
  cb: {
    trigger(s) { s.env = 1; s.phase1 = 0; s.phase2 = 0; s.hp = 0; s.decayMult = expMult(L.cb.decayMs); },
    render(s) {
      s.phase1 += L.cb.freqsHz[0] / sampleRate; if (s.phase1 >= 1) s.phase1 -= 1;
      s.phase2 += L.cb.freqsHz[1] / sampleRate; if (s.phase2 >= 1) s.phase2 -= 1;
      const sq = (s.phase1 < 0.5 ? 1 : -1) * 0.5 + (s.phase2 < 0.5 ? 1 : -1) * 0.5;
      const hp = hpStep(sq, s, 'hp', hpCoefFor(300));
      const out = hp * s.env;
      s.env *= s.decayMult;
      return out;
    },
  },
  ...['ch', 'oh', 'cy'].reduce((acc, name) => {
    acc[name] = {
      trigger(s, p) {
        s.phases = METALLIC.map(() => 0);
        s.hp = 0;
        s.env = 1;
        const cfg = L[name];
        // ch has a fixed decay (no knob); oh/cy's decay knob maps 0..1 -> min..max ms.
        let ms;
        if (cfg.decayMs != null) ms = cfg.decayMs;
        else if (p.decay != null) ms = cfg.decayMinMs + p.decay * (cfg.decayMaxMs - cfg.decayMinMs);
        else ms = cfg.decayDefaultMs;
        s.decayMult = expMult(ms);
      },
      render(s) {
        let sum = 0;
        for (let j = 0; j < METALLIC.length; j++) {
          s.phases[j] += METALLIC[j] / sampleRate;
          if (s.phases[j] >= 1) s.phases[j] -= 1;
          sum += s.phases[j] < 0.5 ? 1 : -1;
        }
        sum /= METALLIC.length;
        const hp = hpStep(sum, s, 'hp', hpCoefFor(L[name].hpHz));
        const out = hp * s.env;
        s.env *= s.decayMult;
        return out;
      },
    };
    return acc;
  }, {}),
  ma: {
    trigger(s) { s.env = 1; s.hp = 0; s.lp = 0; s.decayMult = expMult(L.ma.decayMs); },
    render(s) {
      const hp = hpStep(noise(), s, 'hp', hpCoefFor(L.ma.bpHz * 0.7));
      s.lp = s.lp + hpCoefFor(L.ma.bpHz * 1.6) * (hp - s.lp);
      const out = s.lp * s.env;
      s.env *= s.decayMult;
      return out;
    },
  },
};

const LANE_NAMES = Object.keys(LANES);

class Drum808Processor extends AudioWorkletProcessor {
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
        if (!s.active) continue; // never triggered: silent, and its state isn't initialized
        const v = LANES[name].render(s);
        sum += v * s.level * s.accentMult;
      }
      out[i] = Math.max(-1, Math.min(1, sum));
    }

    return true;
  }
}

registerProcessor('drum808', Drum808Processor);
