# CLAUDE.md — Working agreement & assumptions log

## Project
SQUELCH (working title): browser recreation of the ReBirth RB-338 rig.
Faithful sound, modernized kid-friendly workflow, skeuomorphic CSS/SVG look.
See SPEC.md (design, locked), BUILD_PLAN.md (milestones), BACKLOG.md (deferred).

## Conventions
- Vanilla JS, no build step. Serve with `python3 -m http.server 8080`.
- Multi-file repo. All synthesis in AudioWorklets under `js/worklets/`.
- **Every tuning constant lives in the single CFG object in `js/config.js`** —
  DSP coefficients, ranges, UI feel, scheduler timing. No magic numbers inline.
- Strict milestone scope. New ideas → BACKLOG.md, never straight into code.
- Design is locked before implementation; SPEC.md changes are explicit edits,
  discussed first.
- Flag design tensions proactively; never resolve them silently.
- No image assets. Panels are CSS/SVG. No copying of Propellerhead artwork or
  Roland trade dress; original layout/typography inspired-by only.
- Ask before assuming. When running unattended: pick the most reasonable
  interpretation, proceed, and record it below.

## Decisions (settled — do not relitigate silently)
- Full rig scope: 2×303, 808, 909, mixer, FX. Desktop/mouse only.
- Worklet-first custom 303 voice (not Tone.js primitives). Tone.js is NOT a
  dependency of this project.
- Flat named pattern lists (no bank/pattern grid).
- Effects (distortion, delay, compressor) in v1; PCF and knob automation
  backlogged.
- Slide semantics: slide flag = glide INTO the next step, gate held, no
  envelope retrigger.
- 909 hats/cymbals: procedural buffers first, base64 fallback via M4 gate.

## Assumptions log
- (M0) Ladder model, accent circuit, slide time, cutoff/env-mod ranges as
  documented in SPEC.md §303 — validated by ear on Mac mini, harness-tested
  for stability. Deviations tracked in BACKLOG.md fidelity section.
- (M0) Output chain: tanh soft-clip → 40 Hz one-pole HP → 0.85 trim →
  ±0.98 hard clamp. Worst-case stress peak 0.98, no NaN.
- (Docs) 808 reduced to 12 lanes; conga/claves dropped (SPEC open question).
- (Docs) Shuffle is global and applies to even 16ths; depth range tuned in M1.
- (M5) Per-machine dist/delay routing is exclusive with dry: a channel is
  either dry, or sent through distortion and/or delay, not dry+wet blended.
  Distortion's output always continues into the delay stage (serial, per
  SPEC.md's chain notation); a delay-only channel enters the delay stage
  directly, bypassing distortion. Compressor+master volume are always in
  every channel's path (they're the true master bus, not part of the
  optional wet chain) so "disabling all effects" (dist off, delay off,
  compressor amount=0) reproduces the dry M2-M4 sound.
- (M5) Mixer strip built skeuomorphic now (real CSS knobs/faders/LEDs), ahead
  of the M7.5 full panel art pass — user's explicit call, since M1-M4 stayed
  plain/functional by the original plan.
- (M5 review pass) Three sequencing fixes, all toward the locked spec:
  (1) transport Stop now posts a 'stop' message that flushes each worklet's
  lookahead queue and releases the gate — previously a queued gate-on could
  drone forever after Stop; (2) non-slide 303 notes gate off at
  GATE_FRACTION (0.6) of the step, restoring the M0 spike driver's
  articulation that the production sequencer had lost; (3) a 303 trigger's
  slide flag now comes from the PREVIOUS step (slide = glide INTO the next
  step, per the locked decision) — it had been reading the current step's
  flag, which made true held-gate glides impossible. Logic lives in
  js/seq303.js (pure, tested). Re-ear-test 303 patterns: articulation and
  slides now audibly differ from what M2-M4 shipped.
- (M5 review pass) Distortion stage is duplicated (two identical WaveShaper
  chains driven by the same knobs): one for dist-only channels (bypasses the
  delay line), one for dist+delay channels (serial into it). With a single
  shared stage, a dist-only channel picked up echoes whenever delay Level
  was up. Mute moved from machine panels into the mixer strip per the
  BACKLOG plan.
- (M6) "Refresh restores everything" read as: patterns + active selection +
  machine patches (303 knobs/waveform, drum lane knobs, accent) + tempo +
  shuffle. Mixer state deliberately excluded (backlogged). Undo covers
  pattern edits only — knob moves and tempo/shuffle are performance
  gestures, undoing a step toggle must not yank a filter sweep back.
- (M6) Structural changes (undo, import, pattern switch/new/duplicate)
  rebuild the machine panels' DOM against the store's current state; audio
  nodes and the mixer are created once and survive rebuilds. Rebuilds are
  safe mid-playback (scheduler re-registers panels; step position persists).
- (M7) Song mode plays the current row's pattern refs while panels keep
  DISPLAYING (and editing) each machine's active pattern — the display does
  not follow the song. The conductor registers as the scheduler's first
  machine so row advances land before panels read step 0. A null pattern
  ref = that machine is silent for the row (303s get an explicit gate-off).
  Mode toggle stops the transport (clean-start semantics); play mode is
  session-only, not persisted. End-of-song stop defers one tick so panels
  aren't handed events after their stop-flush.
- (M7.5) The full audio graph + all panels build at page load via
  initAudio(); the AudioContext starts suspended (browser autoplay policy)
  and RUN resumes it. So the UI is always visible — RUN gates *sound*, not
  the interface. Earlier the whole rig was built lazily inside the first RUN
  click, which hid every panel until playback started.
- (M7.5 layout pass) Real-estate redesign per user: 303 macro controls are
  now a horizontal rotary-knob strip (was a stacked-slider column that left
  the panel's right half empty); drum lane controls are compact rotary knobs
  too. 808 + 909 share ONE section with an 808|909 tab — but both drum
  machines are always built, registered, and SOUNDING; the tab only picks
  which one you see/edit (both-play preserves the layering capability rather
  than silently dropping it). activeDrumTab survives panel rebuilds. Drum
  lanes show full kid-readable names (Kick, Snare, Closed Hat…), not the
  two-letter codes. 303 "Clear effects" resolved as two buttons: Reset Knobs
  (restores the machine's default patch; not undoable — it's a patch/perf
  gesture) and Clear A/S (strips accent+slide flags from the pattern, keeping
  notes/gates; undoable — it's a pattern edit).
- (M7.5 console redesign) Groove-box layout, locked with the user: ONE
  instrument on screen at a time via a 4-way tab bar (303-A/303-B/808/909);
  all four editors are still built + registered so every machine keeps
  sounding — the tab only picks what you see/edit (activeTab survives
  rebuilds). Each editor is [ sequencer | inspector ]: the grid holds only
  pads (+ lane names for drums); the inspector holds the labeled knobs. Drum
  lane knobs moved into the inspector — click a lane name to focus it and its
  Level/Tone/etc. appear labeled (fixes the unlabeled-knob problem). Song is
  now a VIEW, toggled from the transport (Pattern|Song), not a stacked panel;
  playMode still drives both the view and playback. Mixer is docked at the
  bottom, visible in both views. Net: the whole rig fits on one screen.
  buildMachines() → buildConsole(); panelSong lost its mode buttons.
- (M7.5 303 piano-roll) The 303 step lane is now a piano-roll: 12 pitch rows
  (one octave, high->low, mini-keyboard gutter) x 16 steps. Click a cell to
  place a note (keeps the step's octave, gate on); click the lit note to make
  it a rest. Per-step OCT ▼/▲ bumps a note by one octave (repeat for two),
  clamped to NOTE_MIN/MAX; a "+N/-N" badge shows the offset. Accent/slide
  moved to a strip under the grid. The note stays absolute in the data model
  (step.n) — no schema change; pitch<->row/octave math is pure in js/pitch.js
  (base octave CFG.VOICE303.PIANO_BASE_MIDI = 24/C1), tested in
  test/pitch.test.js. The roll fills the vertical space the console 303
  editor previously wasted.
- (M8 accessibility pass) Full keyboard + screen-reader support. Custom
  widgets that were click-only divs are now operable: knobs are ARIA sliders
  (role=slider, arrow/Page/Home/End keys, aria-valuetext); step pads and
  piano-roll cells are <button>s with role=gridcell + aria-pressed +
  descriptive labels, navigated by a shared roving-tabindex helper
  (js/a11yGrid.js) — arrows move, Enter/Space toggle, and per-column
  shortcuts (A accent, S slide, PageUp/Down octave) act on the focused step;
  mixer LEDs are buttons with aria-pressed; instrument tabs are a
  tablist/tab/tabpanel with arrow-key roving. Transport has a polite live
  status region and RUN aria-pressed; landmarks + skip link added. CSS adds a
  single :focus-visible ring, contrast-raised --ink tokens, and
  prefers-reduced-motion / prefers-contrast handling. The pads/knobs became
  <button>/role elements without visual change (a CSS reset strips native
  chrome). No data-model or DSP change — all headless tests still pass.
- (Post-M8) In-app Learn panel (js/help.js): accessible modal (role=dialog,
  aria-modal, focus trap, Escape/backdrop close, focus return, siblings set
  inert while open) with two tabs — a "How to play" quick-start tutorial and
  "The machines" historical notes on the TB-303/808/909 (their commercial-
  flop-to-genre-defining arc; acid house / hip-hop / techno). Opened from a
  Learn button in the transport. Static content, no coupling to live DOM.
- (Post-M8) Learn panel expanded: original stylized SVG "portraits" per
  machine (abstract synth/drum illustrations — NOT Roland trade dress, per the
  no-artwork rule) + external reference links (Wikipedia, target=_blank
  rel=noopener). Demo library grew to 8 303 presets (each now carries a knob
  `patch` applied on load, so a preset dials in the SOUND) + 11 drum beats,
  all original patterns written in-the-style-of genres (not song
  transcriptions). presetLibrary entries are now { name, create() ->
  { pattern, patch } }; patternBar applies patch via setNoUndo (performance
  gesture) alongside the undoable pattern add.
- (Post-M8) Full-rig Demos + blank slate + clearer pattern workflow (user
  feedback: "not clear how you create/save/clone a pattern; hard to get a blank
  slate; demos should be full genre tracks, not per-machine snippets"). New
  js/demoLibrary.js (pure, tested) defines full-track demos — each bundles
  tempo + shuffle + one pattern per machine + matched 303 patches + a 4-section
  song arrangement (intro drums / bass in / full / 303-only break, via null
  song refs). Lineup: Detroit House (124), Classic Hip Hop (90, shuffle), Acid
  Techno (135), Electro/Miami Bass (110). buildDemoState() and buildBlankState()
  return complete valid store states; store.loadRig() replaces the whole rig
  (undoable like import). A fresh profile now SEEDS from DEMO_LIBRARY[0] (was
  per-machine PRESET_* snippets) so first run opens on a coherent starter track;
  "New Rig" button is the one-click blank slate. Transport gains a Demo picker +
  New Rig (both confirm before replacing work). Per-machine Presets kept as
  building blocks. Pattern bar relabeled (PATTERN | … | LOAD groups, divider)
  with New/Duplicate/rename tooltips; Learn tutorial updated. Note: demo
  patterns are written by ear-model only — still need a Mac-mini ear-test pass
  (the final gate) to tune groove/mix; data validity is harness-tested
  (test/demoLibrary.test.js).
- (Post-M8) Mixer state now PERSISTED + carried by demos (supersedes the M6
  "mixer state excluded" note for this purpose). New js/mixerState.js
  (defaultMixerState/mergeMixerState, pure/tested) defines the slice: per-channel
  level + dist/delay sends + mute, plus shared dist/delay/comp/master. Stored in
  state.mixer (normalize backfills old saves). panelMixer reads initial values
  from the slice and APPLIES them to the audio graph on build (so a loaded
  demo's sends/levels are audible immediately) and persists every change via
  setNoUndo (perf gesture, like knobs). The panel is rebuilt (buildMixer) from
  the store on rig swaps; audio nodes still built once. Each demo carries a
  `mixer` overlay = its sonic touches (e.g. Acid Techno sends 303-A through
  dist→delay; Detroit House delays the stab). Undo redesign: undo entries now
  snapshot a per-op key set — incremental edits still snapshot only
  patterns/active/song (M6 rule intact), but a whole-rig swap (loadRig/import)
  snapshots RIG_KEYS (adds tempo/shuffle/patches/mixer) so ONE Undo restores the
  entire prior rig. Because rig loads are fully undoable, the native confirm()
  on demo/New-Rig was dropped; demo-load now switches to Song view + autoplays
  (deliberate gesture) and announces via the status live region; New Rig lands
  in Pattern view, stopped. Dead PRESET_303A/B/808/909 snippets removed (seed
  comes from the demo library now); their files keep the lane/noteName exports.
- (Post-M8) Mixer send routing made legible: the per-channel Dist/Delay LEDs
  are the sends into the shared Distortion/Delay FX boxes, but nothing showed
  that. Fixed presentation-only — two accent tokens (--fx-dist orange,
  --fx-delay cyan) color-code each send LED (ring+label, visible even when
  off) to a matching top accent bar on its FX section, plus a "◄ channel Dist
  sends" / "◄ channel Delay sends" caption. Compressor/Master are captioned
  "master bus · all channels" to mark them as always-on, not sends. No
  data-model/DSP/audio-graph change; the send LEDs keep the same
  aria-pressed semantics (aria-labels now read "Send <machine> to ...").
- Headless worklet harness (Node + stubbed AudioWorklet globals) lives in
  `test/`; run before shipping any DSP change: stability (NaN/peak at
  worst-case knobs), accent RMS delta, slide glide curve.
- Ear tests on the Mac mini are the final gate for anything audible.
