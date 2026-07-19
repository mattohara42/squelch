# SQUELCH — Backlog

Deferred by decision, not forgotten. Nothing here gets built speculatively.

## Deferred features
- **PCF (pattern-controlled filter)** — ReBirth's signature effect; real
  complexity. Revisit after M8.
- **Knob automation in song mode** — big state/UI cost; live tweaking is more
  fun for family jams. Revisit only if song mode feels static.
- **Per-machine shuffle / per-pattern length** (12-step, polymeter tricks).
- **Pattern randomizer / mutate button** — strong kid-appeal candidate for a
  post-M8 fun pass.
- **WAV render/export** (OfflineAudioContext bounce).
- **MIDI export** of patterns; **MIDI clock/keyboard input**.
- **Full 808 voice matrix** — conga/tom switching + claves (dropped to 12
  lanes in v1; see SPEC open questions).
- **Wall-panel / touch mode** — explicitly out of scope for this project.
- **Theme variants** — CSS-token panel colorways once the skeuomorph pass
  settles.

## Fidelity follow-ups (from M0 spike assumptions)
- True diode-ladder topology with stage loading (vs. current blended
  Moog-style ZDF ladder).
- 303 asymmetric square oscillator shape.
- Filter-input high-pass and exact envelope curves (Open303/db303 as
  references).
- Accent sweep-cap constants: tuned by ear in spike; A/B against hardware
  recordings during M2.
- **909 procedural CH/OH/CC/RC buffers** — M4 decision gate was resolved
  provisionally (kept procedural) because neither of us had reference 909
  hardware recordings to A/B against. Revisit with real recordings if the
  fidelity ever bugs us; fallback is small base64 samples for those 4 lanes
  only, per SPEC.md.

## Notes for upcoming milestones
- ~~**M5 mixer:** absorb the pulled-forward Mute checkbox.~~ Done — Mute is
  now an amber LED on each mixer channel strip; the panel checkboxes are gone.
- **Pattern delete / reorder** — M6 shipped select/rename/new/duplicate only;
  delete needs a "can't delete the last one" guard and a confirm. Add with the
  M7.5 UX pass.
- **Mixer-settings persistence** — M6 persists patterns, machine patches
  (incl. drum lane knobs), and tempo/shuffle. Mixer state (levels, routing
  toggles, FX knobs, mutes) resets on refresh; persist it when the mixer
  gets its M7.5-era polish, reusing store.patches-style setNoUndo plumbing.

## Known smells / risks to watch
- Scheduler and UI share the main thread — if knob-drag ever audibly jitters
  the sequencer, move scheduling into the worklet clock (post events per-bar).
- One-sample feedback delay in the ladder is masked by 2× OS; if a future
  fidelity pass raises resonance range, revisit with a proper ZDF solve.
