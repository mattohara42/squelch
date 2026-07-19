# SQUELCH

A browser recreation of a ReBirth RB-338-style acid rig: **two TB-303 bass
synths, an 808 and a 909 drum machine, a mixer, and an effects chain** — all
synthesized live in AudioWorklets, no samples, no image assets, no build step.
Faithful sound with a modernized, kid-friendly workflow.

## Run it

No build, no dependencies. Serve the folder and open it:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

Press **RUN** (or the Space bar) to start. The whole rig is visible from the
start — RUN only unlocks *sound* (browsers require a gesture before audio).

## The rig

One instrument is on screen at a time; the tab bar (**303-A · 303-B · 808 ·
909**) picks which you edit. All four keep playing regardless of which tab is
showing — the tab is an editing focus, not a mute.

- **303-A / 303-B** — acid bass synths. The sequencer is a **piano-roll**: one
  octave of pitch rows (high→low) × 16 steps. Click a cell to place a note;
  click the lit note to make it a rest. Each step has an **octave bump**
  (▼/▲ — one octave per press, two presses for two) and **Accent / Slide**
  flags. The inspector holds the sound knobs (Tuning, Cutoff, Resonance, Env
  Mod, Decay, Accent, Volume), the waveform, **Reset Knobs**, and **Clear A/S**.
- **808 / 909** — drum machines. Click a lane name (Kick, Snare, Closed Hat…)
  to focus it; its knobs (Level, Tone, Decay…) appear labeled in the inspector.
  Toggle step hits and per-step accents in the grid; the global Accent knob
  sets accent depth.
- **Mixer** (docked, always visible) — per-machine Level fader, Dist / Delay
  routing, and Mute; a shared FX chain of **Distortion → tempo-synced Delay →
  Compressor → Master volume**.

### Patterns, songs, saving

- Each machine keeps a named list of patterns (dropdown · rename · **New** ·
  **Duplicate** · **Presets…** — a demo library of genre-flavored patterns;
  the 303 presets also load a matching knob **patch**, so "Chicago Acid" or
  "Screamer" dials in the sound, not just the notes).
- **Pattern / Song** toggle (in the transport): Pattern mode jams the active
  patterns; Song mode is a row arranger (per-machine pattern refs + repeats,
  loop toggle).
- Everything autosaves to `localStorage`. **Undo** covers pattern edits (knob
  moves and tempo are performance gestures, not undone). **Export / Import**
  round-trips the whole state as JSON.

### Keyboard

- **Space** — RUN / STOP
- **Cmd/Ctrl + Z** — Undo

### Learn

The **Learn** button (in the transport) opens a panel with a "How to play"
quick-start tutorial and "The machines" — short historical notes on the
TB-303, TR-808, and TR-909 and their outsized influence on acid house,
hip-hop, techno, and beyond.

## Develop

Vanilla JS ES modules, no bundler. All synthesis lives in AudioWorklets under
`js/worklets/`. **Every tuning constant is in the single `CFG` object in
`js/config.js`** — no magic numbers inline.

Headless tests (Node, stubs the AudioWorklet globals — no browser needed):

```sh
for t in test/*.test.js; do node "$t"; done
```

They cover the DSP (stability at worst-case knobs, accent RMS delta, slide
glide), the scheduler cadence/shuffle, the pure sequencing/pitch/effects math,
and the store (persistence, undo depth, export/import).

### Layout

```
index.html            transport + containers (#instrument-tabs, #machines, #song, #mixer)
css/style.css         skeuomorphic hardware styling
js/
  config.js           CFG — the single source of truth for tuning constants
  main.js             audio graph, console layout, wiring
  scheduler.js        lookahead clock (25ms tick / 120ms lookahead)
  store.js            state, localStorage autosave, undo, export/import
  panel303.js         303 piano-roll editor + inspector
  panelDrum.js        drum grid editor + inspector
  panelMixer.js       mixer strip + FX
  panelSong.js        song row arranger
  patternBar.js       per-machine pattern list controls
  knob.js             rotary knob widget (drag, Shift = fine, dbl-click reset)
  seq303.js / pitch.js / effectsMath.js   pure logic (unit-tested)
  presets*.js         seed patterns, lane maps, preset library
  worklets/           voice303, drum808, drum909, dsp-utils
```

## Accessibility

Everything is operable by keyboard and labeled for screen readers:

- **Keyboard**: Space = RUN/STOP, Cmd/Ctrl+Z = Undo. Instrument tabs are a
  proper tablist (arrow keys switch). The step grids use roving-tabindex —
  Tab lands on the grid, arrow keys move between cells, Enter/Space toggle,
  and per-column shortcuts act on the focused step: **A** accent, **S** slide,
  **PageUp/PageDown** octave (303). Knobs are ARIA sliders — arrows adjust
  (Shift = fine), Home/End jump to min/max.
- **Screen readers**: roles and labels throughout (tablist/tab/tabpanel,
  grid/gridcell with per-cell labels like "Kick step 3, accent", slider knobs
  with value text, pressed-state on toggles), a polite live region for
  transport status, landmarks, and a skip link.
- **Visual**: a single consistent keyboard-focus ring (`:focus-visible`),
  contrast-tuned text, and support for `prefers-reduced-motion` (stops the
  playhead animation) and `prefers-contrast: more`. Meaning never relies on
  color alone — machines, accents, and slides all carry text/letters too.

## Browser support

Developed and tested on Chromium. The AudioWorklet processors use ES-module
`import` (e.g. worklets import `CFG`); this works in Chromium and Firefox but
**should be verified on Safari**, whose AudioWorklet module-import support has
lagged — if it fails there, the fix is to inline the constants those worklets
need (avoiding a build step). Desktop / mouse only by design.
