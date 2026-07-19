// SQUELCH — single source of truth for tuning constants (per CLAUDE.md).
export const CFG = {
  TEMPO_MIN_BPM: 60,
  TEMPO_MAX_BPM: 200,
  TEMPO_DEFAULT_BPM: 130,
  STEPS_PER_PATTERN: 16,

  // Shuffle swings the even 16ths (odd step index, 0-based) later by this
  // fraction of a step duration at full depth. Range tuned by ear in M1.
  SHUFFLE_MAX_FRACTION: 0.3,

  SCHEDULER_TICK_MS: 25,
  SCHEDULER_LOOKAHEAD_S: 0.12,

  MASTER_GAIN_DEFAULT: 0.9,
  MUTE_RAMP_S: 0.005, // click-free mute/unmute transition time
  MASTER_LIMITER: {
    threshold: -3,
    knee: 0,
    ratio: 20,
    attack: 0.003,
    release: 0.1,
  },

  VOICE303: {
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
    GLIDE_MS: 35,
    // Non-slide notes gate off at this fraction of the step (matches the M0
    // spike's riff driver, which the production sequencer had lost).
    GATE_FRACTION: 0.6,
    NOTE_MIN: 20,
    NOTE_MAX: 72,
    PIANO_BASE_MIDI: 24, // C1 — the octave the piano-roll shows; roots sit here, ups read as +1/+2
    PIANO_ROWS: 12,
    KNOB_DEFAULTS: { tuning: 0, cutoff: 500, resonance: 0.5, envMod: 0.5, decay: 400, accent: 0.7, volume: 0.8 },
  },

  DRUM_LANE_LEVEL_DEFAULT: 0.8,
  DRUM_ACCENT_AMOUNT_DEFAULT: 0.8,

  STORAGE_KEY: 'squelch-state-v1',
  UNDO_DEPTH: 50, // accept criterion needs >= 20

  SONG: {
    REPEAT_MAX: 16, // max bars a single row can repeat
  },

  UI: {
    KNOB_DRAG_RANGE_PX: 160, // vertical px for full min->max sweep
    KNOB_ROTATION_DEG: 270, // total sweep, centered (-135deg..+135deg)
    KNOB_FINE_FACTOR: 0.25, // Shift-drag sensitivity multiplier
  },

  // 808. Knob map locked here per SPEC.md (final knob map fixed in M3):
  // bd: tone+decay, sd: tone+snappy, oh/cy: decay, everything else: level only.
  DRUM808: {
    ACCENT_BOOST_GAIN: 0.8,
    METALLIC_OSC_FREQS_HZ: [205.3, 304.4, 369.6, 522.7, 619.8, 845.4],
    LANES: {
      bd: { baseFreqHz: 55, pitchSweepHz: 150, pitchTauMs: 40, decayMinMs: 150, decayMaxMs: 800, decayDefaultMs: 400, toneDefault: 0.5 },
      sd: { toneFreqsHz: [180, 330], tonalDecayMs: 220, noiseDecayMinMs: 50, noiseDecayMaxMs: 400, noiseDecayDefaultMs: 150, toneDefault: 0.5, snappyDefault: 0.5 },
      lt: { freqHz: 90, decayMs: 300 },
      mt: { freqHz: 130, decayMs: 280 },
      ht: { freqHz: 180, decayMs: 250 },
      rs: { toneFreqHz: 400, decayMs: 15 },
      cp: { burstGapMs: 8, burstCount: 3, tailDecayMs: 150, bandHz: 1200 },
      cb: { freqsHz: [540, 800], decayMs: 300 },
      ch: { decayMs: 50, hpHz: 6000 },
      oh: { decayMinMs: 100, decayMaxMs: 500, decayDefaultMs: 250, hpHz: 5000 },
      cy: { decayMinMs: 300, decayMaxMs: 1500, decayDefaultMs: 700, hpHz: 3000 },
      ma: { decayMs: 20, bpHz: 6000 },
    },
  },

  // 909. Kick/snare/toms/rimshot/clap synthesized in real time; hats/cymbals
  // are procedurally generated into fixed buffers once at load time (per
  // SPEC.md), then played back like one-shot samples.
  DRUM909: {
    ACCENT_BOOST_GAIN: 0.8,
    METALLIC_OSC_FREQS_HZ: [239, 347.5, 419, 590, 700, 973],
    TUNE_RANGE_SEMITONES: 12,
    LANES: {
      bd: { baseFreqHz: 50, pitchSweepHz: 120, pitchTauMs: 35, decayMinMs: 150, decayMaxMs: 700, decayDefaultMs: 350, attackDefault: 0.5, attackClickMs: 3 },
      sd: { toneFreqsHz: [190, 340], tonalDecayMs: 180, noiseDecayMinMs: 40, noiseDecayMaxMs: 350, noiseDecayDefaultMs: 130, toneDefault: 0.5, snappyDefault: 0.5 },
      lt: { baseFreqHz: 100, decayMinMs: 150, decayMaxMs: 500, decayDefaultMs: 280 },
      mt: { baseFreqHz: 140, decayMinMs: 150, decayMaxMs: 500, decayDefaultMs: 260 },
      ht: { baseFreqHz: 190, decayMinMs: 150, decayMaxMs: 500, decayDefaultMs: 240 },
      rs: { toneFreqHz: 420, decayMs: 12 },
      cp: { burstGapMs: 7, burstCount: 3, tailDecayMs: 130, bandHz: 1300 },
      ch: { bufferLengthMs: 150, decayMs: 60, hpHz: 7000 },
      oh: { bufferLengthMs: 800, decayMinMs: 100, decayMaxMs: 500, decayDefaultMs: 250, hpHz: 6000 },
      cc: { bufferLengthMs: 2500, decayMs: 1800, hpHz: 4000 },
      rc: { bufferLengthMs: 1800, decayMs: 1200, hpHz: 3500 },
    },
  },

  // M5 mixer + effects. Per-machine dist/delay routing is exclusive with dry
  // (see ASSUMPTIONS.md-style note in BUILD_PLAN.md M5): a machine is either
  // dry, or routed through distortion and/or delay, not both simultaneously.
  // Chain is Distortion -> Delay -> Compressor -> master volume per SPEC.md;
  // distortion's output always continues into the delay stage.
  EFFECTS: {
    DISTORTION: { AMOUNT_DEFAULT: 0.3, BLEND_DEFAULT: 0.6, CURVE_SAMPLES: 1024 },
    DELAY: {
      STEP_OPTIONS: [2, 3, 4, 6, 8], // bar subdivisions: delayTime = barSeconds / steps
      STEPS_DEFAULT: 4,
      FEEDBACK_DEFAULT: 0.35,
      FEEDBACK_MAX: 0.9,
      LEVEL_DEFAULT: 0.4,
      MAX_DELAY_S: 2.0,
    },
    COMPRESSOR: {
      THRESHOLD_MIN_DB: -40,
      THRESHOLD_MAX_DB: 0,
      THRESHOLD_DEFAULT_DB: -18,
      RATIO_MIN: 1, // amount=0 -> ratio 1 (transparent, "disabling all effects" stays dry)
      RATIO_MAX: 12,
      AMOUNT_DEFAULT: 0,
    },
    MIXER_LEVEL_DEFAULT: 0.8,
  },
};
