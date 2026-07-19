// SQUELCH — M0 spike: single 303 voice.
// Architecture per SPEC.md §303 / BACKLOG.md fidelity notes:
//   4-stage ladder, one-sample-delayed feedback (not a solved ZDF), tanh-
//   saturated feedback, 2x oversampled to mask the delay. Output blends
//   stage3/stage4 for the ~18dB/oct diode-ladder character.
// Kept standalone (constants inlined, not js/config.js) — this file predates
// the M1 CFG convention and stays frozen as the M0 reference.

const V = {
  RESONANCE_MAX_K: 4.2,
  ENV_MOD_MAX_OCT: 3.6,
  DECAY_MIN_MS: 200,
  DECAY_MAX_MS: 2000,
  ACCENT_DECAY_MS: 200,
  ACCENT_BOOST_GAIN: 0.9,
  RELEASE_MS: 30,
  WOW_MAX_MS: 15,
  OVERSAMPLE: 2,
  HPF_HZ: 40,
  TRIM: 0.85,
  CLAMP: 0.98,
  CUTOFF_MIN_HZ: 100,
  CUTOFF_MAX_HZ: 4000,
};

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
    this.currentAccentKnob = 0;
    this.currentDecayMs = 400;

    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    if (msg.type === 'waveform') {
      this.waveform = msg.value;
      return;
    }
    if (msg.type !== 'note') return;

    if (msg.gate === false) {
      if (this.gate) this.releaseEnv = 1; // only (re)start the release on the actual on->off transition
      this.gate = false;
      return;
    }

    const freq = midiToFreq(msg.note);
    this.targetFreq = freq;
    if (!(msg.slide && this.gate)) {
      // Normal trigger: instant pitch, envelope retriggers.
      this.freq = freq;
      this.env = 1;
    }
    // Slide-into: keep gliding toward targetFreq, do NOT reset env.
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

    const envTauMs = this.accentEnv > 0.5 ? V.ACCENT_DECAY_MS : decayMs;
    const envDecayMult = Math.exp(-dt / (envTauMs / 1000));
    const accentDecayMult = Math.exp(-dt / (V.ACCENT_DECAY_MS / 1000));
    const releaseMult = Math.exp(-dt / (V.RELEASE_MS / 1000));
    const glideMult = Math.exp(-dt / 0.035);

    const k = resonance * V.RESONANCE_MAX_K;
    const tuneMult = Math.pow(2, tuning / 12);

    for (let i = 0; i < out.length; i++) {
      let subSum = 0;
      for (let s = 0; s < V.OVERSAMPLE; s++) {
        // Pitch glide (slide) toward target.
        this.freq += (this.targetFreq * tuneMult - this.freq) * (1 - glideMult);

        // Oscillator.
        const inc = this.freq / fs2;
        this.phase += inc;
        if (this.phase >= 1) this.phase -= 1;
        const osc = this.waveform === 'square'
          ? (this.phase < 0.5 ? 1 : -1)
          : (2 * this.phase - 1);

        // Envelopes.
        this.env *= envDecayMult;
        this.accentEnv *= accentDecayMult;
        if (this.gate) this.releaseEnv = 1;
        else this.releaseEnv *= releaseMult;

        // Cutoff sweep with resonance-scaled "wow" smoothing (accent only).
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

        // 4-stage ladder, one-sample-delayed feedback, tanh-saturated.
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

      // Output chain: tanh soft-clip -> 40Hz HP -> trim -> hard clamp.
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
