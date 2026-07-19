// Production 303 voice. DSP identical to spike/voice303-processor.js (the
// verified M0 reference) — only difference is note events carry a `time`
// and are applied sample-accurately from a queue, so the main-thread
// lookahead scheduler can drive it.
import { CFG } from '../config.js';

const V = CFG.VOICE303;

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

class Voice303Processor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'tuning', defaultValue: 0, minValue: -24, maxValue: 24, automationRate: 'k-rate' },
      { name: 'cutoff', defaultValue: 500, minValue: V.CUTOFF_MIN_HZ, maxValue: V.CUTOFF_MAX_HZ, automationRate: 'k-rate' },
      { name: 'resonance', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'envMod', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'decay', defaultValue: 400, minValue: V.DECAY_MIN_MS, maxValue: V.DECAY_MAX_MS, automationRate: 'k-rate' },
      { name: 'accent', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'volume', defaultValue: 0.8, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.waveform = 'saw';
    this.phase = 0;
    this.freq = midiToFreq(45);
    this.targetFreq = this.freq;
    this.gate = false;
    this.env = 0;
    this.accentEnv = 0;
    this.releaseEnv = 0;
    this.cutoffSmoothed = 500;
    this.z1 = this.z2 = this.z3 = this.z4 = 0;
    this.hpLp = 0;
    this.queue = [];

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'waveform') {
        this.waveform = d.value;
      } else if (d.type === 'stop') {
        // Transport stopped: drop any lookahead-queued events (a queued
        // gate-on with no follow-up would otherwise drone forever) and
        // release the current note.
        this.queue.length = 0;
        if (this.gate) this.releaseEnv = 1;
        this.gate = false;
      } else if (d.type === 'note') {
        if (d.time == null) d.time = 0; // missing time would block the FIFO forever (undefined <= t is false)
        this.queue.push(d);
      }
    };
  }

  applyNote(msg) {
    if (msg.gate === false) {
      if (this.gate) this.releaseEnv = 1; // only (re)start the release on the actual on->off transition
      this.gate = false;
      return;
    }
    const freq = midiToFreq(msg.note);
    this.targetFreq = freq;
    if (!(msg.slide && this.gate)) {
      this.freq = freq;
      this.env = 1;
    }
    if (msg.accent) this.accentEnv = 1;
    this.gate = true;
    this.releaseEnv = 1;
  }

  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    const p = (name) => parameters[name][0];

    const tuning = p('tuning');
    const cutoffBase = p('cutoff');
    const resonance = p('resonance');
    const envModOct = p('envMod') * V.ENV_MOD_MAX_OCT;
    const decayMs = p('decay');
    const accentKnob = p('accent');
    const volume = p('volume');

    const fs2 = sampleRate * V.OVERSAMPLE;
    const dt = 1 / fs2;

    const accentDecayMult = Math.exp(-dt / (V.ACCENT_DECAY_MS / 1000));
    const releaseMult = Math.exp(-dt / (V.RELEASE_MS / 1000));
    const glideMult = Math.exp(-dt / (V.GLIDE_MS / 1000));

    const k = resonance * V.RESONANCE_MAX_K;
    const tuneMult = Math.pow(2, tuning / 12);

    for (let i = 0; i < out.length; i++) {
      const t = currentTime + i / sampleRate;
      while (this.queue.length && this.queue[0].time <= t) {
        this.applyNote(this.queue.shift());
      }

      let subSum = 0;
      const envTauMs = this.accentEnv > 0.5 ? V.ACCENT_DECAY_MS : decayMs;
      const envDecayMult = Math.exp(-dt / (envTauMs / 1000));

      for (let s = 0; s < V.OVERSAMPLE; s++) {
        this.freq += (this.targetFreq * tuneMult - this.freq) * (1 - glideMult);

        const inc = this.freq / fs2;
        this.phase += inc;
        if (this.phase >= 1) this.phase -= 1;
        const osc = this.waveform === 'square'
          ? (this.phase < 0.5 ? 1 : -1)
          : (2 * this.phase - 1);

        this.env *= envDecayMult;
        this.accentEnv *= accentDecayMult;
        if (this.gate) this.releaseEnv = 1;
        else this.releaseEnv *= releaseMult;

        const cutoffRaw = Math.min(
          V.CUTOFF_MAX_HZ * 4,
          Math.max(V.CUTOFF_MIN_HZ, cutoffBase * Math.pow(2, envModOct * this.env))
        );
        const tauWow = (V.WOW_MAX_MS / 1000) * resonance * this.accentEnv;
        if (tauWow > 1e-6) {
          const wowMult = Math.exp(-dt / tauWow);
          this.cutoffSmoothed = cutoffRaw + (this.cutoffSmoothed - cutoffRaw) * wowMult;
        } else {
          this.cutoffSmoothed = cutoffRaw;
        }

        const fcClamped = Math.min(fs2 * 0.45, Math.max(20, this.cutoffSmoothed));
        const a = 1 - Math.exp((-2 * Math.PI * fcClamped) / fs2);

        const fb = k * Math.tanh(this.z4);
        const x1 = osc - fb;
        this.z1 += a * (x1 - this.z1);
        this.z2 += a * (this.z1 - this.z2);
        this.z3 += a * (this.z2 - this.z3);
        this.z4 += a * (this.z3 - this.z4);
        const ladderOut = 0.55 * this.z3 + 0.45 * this.z4;

        const ampEnv = (this.gate ? 1 : this.releaseEnv) + V.ACCENT_BOOST_GAIN * this.accentEnv * accentKnob;
        subSum += ladderOut * ampEnv * volume;
      }

      const avg = subSum / V.OVERSAMPLE;

      const clipped = Math.tanh(avg);
      const hpCoef = 1 - Math.exp((-2 * Math.PI * V.HPF_HZ) / sampleRate);
      this.hpLp += hpCoef * (clipped - this.hpLp);
      const hp = clipped - this.hpLp;
      const trimmed = hp * V.TRIM;
      out[i] = Math.max(-V.CLAMP, Math.min(V.CLAMP, trimmed));
    }

    return true;
  }
}

registerProcessor('voice303', Voice303Processor);
