# SQUELCH — Design Spec

*Working title. Rename freely; nothing in the code depends on it. Avoid "ReBirth"
(Propellerhead trademark) and Roland model names in any published title.*

## Vision

A faithful-sounding, browser-based recreation of the classic ReBirth RB-338 rig:
two acid bass synths (TB-303 voice model), an 808-style drum machine, a 909-style
drum machine, a mixer, and an effects chain — with a **modernized workflow**
designed so a middle-schooler can make acid house in five minutes.

**Faithful means the sound.** The workflow deliberately breaks from the original
hardware where the original was hostile: visible pattern state, tap-to-edit,
always-on playheads, undo, and preset patterns to mangle.

**Look:** skeuomorphic hardware panels rendered in CSS/SVG (no image assets, no
pixel-copying of Propellerhead's artwork). Silver panels, real knobs, LEDs.

- **Primary user:** Matt (mouse, Mac). Secondary: the kids (mouse or trackpad).
- **Not targeted:** the wall panel, phones. Desktop browser only.
- **Stack:** vanilla JS, no build step, `python3 -m http.server 8080`. Multi-file
  repo (this project is too large for the single-file audio-toy pattern).
  AudioWorklet for all synthesis; Web Audio graph for mixing/effects.

## Machines

### 2 × Bass synth ("303-A", "303-B")
Voice model proven in the M0 spike (`spike/303-voice-spike.html`):

- 4-stage zero-delay-feedback ladder, 2× oversampled, tanh-saturated feedback,
  output = 0.55·stage3 + 0.45·stage4 (~18 dB/oct diode-ladder slope).
- Accent: fixed ~200 ms filter-envelope decay + VCA boost + resonance-scaled
  smoothing cap on the cutoff sweep (the "wow").
- Slide: ~35 ms exponential pitch glide, gate held, **no** envelope retrigger.
- Knobs: Tuning, Cutoff (100 Hz–4 kHz), Resonance, Env Mod (≤ ~3.6 oct),
  Decay (200 ms–2 s), Accent, Waveform (saw/square), Volume.
- Fidelity backlog (revisit if A/B against references falls short): true diode
  stage loading, asymmetric square shape, filter-input HPF, envelope curves.
  References: Open303, db303, Devil Fish notes.

### 808-style drum machine
Fully synthesized (no samples). Lanes (12): BD, SD, LT, MT, HT, RS, CP, CB,
CH, OH, CY, MA. Per-lane level + the classic tone knobs (BD: tone/decay,
SD: tone/snappy, CY/OH: decay, etc. — final knob map fixed in M3).
Per-step: hit + accent. Global accent knob sets accent amount.

### 909-style drum machine
Lanes (11): BD, SD, LT, MT, HT, RS, CP, CH, OH, CC (crash), RC (ride).
Kick/snare/toms/rimshot/clap synthesized. Hats/cymbals: **procedurally
generated sample buffers at load time** (keeps zero-asset ethos); decision
point in M4 — if they don't convince, fall back to small base64 samples for
CH/OH/CC/RC only.

### Mixer + effects (v1)
- Per-machine: level knob, delay send (on/off), distortion routing (on/off).
- Chain: **Distortion** (waveshaper, amount + blend) → **Delay** (tempo-synced,
  steps: 2/3/4/6/8, feedback, level) → **Compressor** (master glue, simple
  threshold/amount) → master volume.
- PCF (pattern-controlled filter): **backlog**, not v1.

## Sequencing

- One global transport: play/stop, tempo (60–200), shuffle (applies to even
  16ths, global). Single clock; all machines lock to it.
- Lookahead scheduler on the main thread (25 ms tick, 120 ms lookahead) posting
  timestamped events to worklets — the exact pattern proven in the spike.
- 16 steps per pattern (per-machine pattern length variation: backlog).

## Data model (locked)

```js
// 303 step
{ n: 33, g: 1, a: 0, s: 0 }        // note (MIDI), gate, accent, slide-into-next

// drum step (per lane)
{ h: 1, a: 0 }                     // hit, accent

// pattern — flat named list per machine (no bank/pattern grid)
{ id, name, machine: '303a'|'303b'|'808'|'909',
  steps: [16 × step]               // 303 machines
  lanes: { bd:[16 × step], … }     // drum machines
}

// song — ordered rows; per-machine pattern refs so drums can swap mid-song
{ rows: [ { pats: { '303a':id, '303b':id, '808':id, '909':id|null },
            repeat: 2 } ] }

// persistence: localStorage autosave + JSON file export/import
```

## Workflow modernizations (the kid layer)

1. Piano-roll-lite 303 lanes: note visible per step, drag = pitch, tap = gate,
   ACC/SLD dots per step (spike UI, refined).
2. Always-on playhead LEDs on every machine.
3. Preset patterns shipped in every machine — mutation beats blank-page.
4. Undo (single global history stack over pattern/song edits).
5. Knob cause-and-effect glow: a knob subtly glows while the sound it shapes
   is playing.
6. One transport, no per-machine arming, no write/play mode split.

## Open questions

- Project name (SQUELCH is a placeholder).
- 808 lane count: 12 chosen over the hardware's full 16-voice matrix
  (dropped the conga/tom switching and claves). Revisit in M3 if missed.
- Shuffle depth range: tune by ear in M1.
