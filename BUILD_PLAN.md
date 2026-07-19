# SQUELCH — Build Plan

Rules of engagement: milestones ship in order, each independently testable.
Anything discovered mid-milestone that isn't in scope goes to BACKLOG.md, not
into the code. All tuning constants live in `js/config.js` (one CFG object).

## M0 — 303 voice spike ✅ DONE
Standalone worklet voice; squelch, accent "wow", liquid slides confirmed by ear
on the Mac mini. Headless harness: no NaN at worst-case settings, accents
~+37% RMS, slide glide verified. File kept at `spike/303-voice-spike.html`
as the reference implementation.

## M1 — Skeleton, clock, transport ✅ DONE
Repo structure (`index.html`, `css/`, `js/`, `js/worklets/`), CFG object,
global transport (play/stop/tempo/shuffle), lookahead scheduler abstraction
that any machine can register with, master gain + safety limiter.
**Accept:** metronome blip machine plays in time; shuffle audibly swings;
tempo changes don't glitch. Confirmed by ear. Headless tests in
`test/scheduler.test.js`.

## M2 — 303s productionized ✅ DONE
Extract spike worklet into `js/worklets/voice303.js`; instantiate two; panel UI
(knobs + step lane) as a reusable component; per-machine pattern editing wired
to the locked data model.
**Accept:** two independent basslines with different patches play locked
together; spike pattern sounds identical to M0. Confirmed by ear. Headless
DSP checks in `test/voice303.test.js` verify production output matches the
spike bit-for-bit.

## M3 — 808 ✅ DONE
All 12 synthesized voices + per-lane tone knobs; drum grid UI (lane × 16,
hit/accent); global accent knob. Lock the final knob map for each voice here.
**Accept:** classic 808 groove (BD/SD/CH/OH/CP) sounds credible next to
reference recordings; accents audibly pop. Confirmed by ear (found and fixed
a real release-envelope retrigger bug along the way). Headless checks in
`test/drum808.test.js`. Per-machine Mute pulled forward as a debugging aid
(see BACKLOG.md note for M5).

## M4 — 909 ✅ DONE
Synthesized BD/SD/toms/RS/CP; procedural buffer generation for CH/OH/CC/RC.
**Decision gate:** A/B procedural cymbals vs. reference — if unconvincing,
switch those four lanes to base64 samples (≤100 KB total) and log it.
**Accept:** four-on-the-floor 909 kick + open-hat offbeat passes the ear test.
Decision gate resolved provisionally: kept procedural (zero-asset, credible,
no crashes) since neither of us has reference 909 hardware recordings to A/B
against right now — see BACKLOG.md fidelity follow-ups. Headless checks in
`test/drum909.test.js`. Also fixed a real CSS Grid overflow bug (303 panels
were overlapping) along the way.

## M5 — Mixer + effects ✅ DONE
Per-machine level/delay-send/distortion routing; distortion → tempo-synced
delay → master compressor → master volume. Skeuomorphic mixer strip panel.
**Accept:** 303 through delay+distortion produces the classic dub-acid wash;
disabling all effects yields the dry M2–M4 sound unchanged.
Built skeuomorphic (user's call, ahead of M7.5). Review pass fixed four real
bugs (drone-after-stop, lost gate articulation, inverted slide indexing,
dist-only channels leaking into the delay line) — see CLAUDE.md assumptions.
Pure FX math tested in `test/effectsMath.test.js`, sequencing semantics in
`test/seq303.test.js`.

## M6 — Patterns, persistence, undo ✅ DONE
Flat named pattern lists per machine; pattern copy/duplicate; localStorage
autosave; JSON export/import; global undo stack across edits.
**Accept:** refresh restores everything; undo reverses the last 20 edits;
exported file re-imports on a clean profile. All three verified in-browser
(refresh restored steps/hits/knob patches; 22 sequential undos returned to
the exact prior state; export re-imported on a wiped profile through the
real file-input path). Store logic in `js/store.js`, tested headlessly in
`test/store.test.js`. Undo covers pattern edits only — knob moves and
tempo/shuffle persist but aren't undoable (performance gestures, not edits).

## M7 — Song mode ✅ DONE
Row-based arrangement ({per-machine pattern refs, repeat}); row editor UI;
seamless pattern switching on bar boundaries; loop-song toggle.
**Accept:** a 16-row song plays through with drum swaps mid-song and no
timing hiccups at row transitions. Verified in-browser: 16 rows alternating
two 808 patterns advanced in strict sequence, looped to row 0, and loop-off
auto-stopped exactly at song end with the row indicator cleared; the song
survives refresh. Conductor logic in `js/songConductor.js` (pure, tested in
`test/song.test.js`). Final timing-feel check by ear pending user session.

## M7.5 — Juice + skeuomorph polish ✅ DONE
Full panel art pass (CSS/SVG), knob feel (fine-drag, reset), LED glow,
knob cause-and-effect glow, preset pattern library (≥6 per machine),
keyboard shortcuts, first-run "press RUN" nudge.
**Accept:** a kid can sit down cold and get a groove going without help.
Delivered: hardware-rack CSS design system (metal chassis, corner screws,
per-machine accent theming via --accent — 303-A green, 303-B amber, 808
blue, 909 red — backlit glowing step pads, synced white playheads); knob
fine-drag (Shift), double-click-reset, live value bubble; 6 presets/machine
in `js/presetLibrary.js` loaded via a Presets dropdown on each pattern bar;
Space=RUN/STOP and Cmd/Ctrl+Z=undo (ignored while typing); first-run nudge
(localStorage-gated, dismisses on first play). All verified in-browser.

## M8 — QA + ship (in progress)
Cross-browser pass (Chrome/Safari/Firefox on Mac), CPU profiling (target:
full rig < 40% of one core), edge cases (tempo drag while playing, rapid
pattern switching), README, Netlify deploy if desired.
**Accept:** 30-minute family jam session with zero crashes or dropouts.

Done (autonomous):
- Edge-case hardening — stress-tested mid-playback: 12 tab switches + 12
  pattern new/duplicate ops + 25 undos + 6 Pattern/Song toggles + tempo/
  shuffle drags, then full rig for 5s. Result: zero console errors, no DOM
  or scheduler-registration accumulation (buildConsole does unregisterAll
  then re-registers exactly 5), no stuck notes/highlights after stop, clean
  replay. The rebuild-around-persistent-nodes architecture holds; no fixes
  needed.
- README.md (usage + dev + layout + browser-support caveat).
- netlify.toml (static, publish root, JS Content-Type belt-and-suspenders).

Remaining (needs the user's machine/ears):
- Real Safari + Firefox pass. KNOWN RISK: worklets use ES-module `import`
  (they import CFG); fine on Chromium/Firefox, verify Safari — if it breaks,
  inline the constants those worklets need (no build step). Noted in README.
- CPU profiling on the Mac mini under full 4-machine + FX load (<40% target).
  Preview smoke test showed no dropouts/xruns but isn't a real % measurement.
- The accept criterion itself: the 30-minute family jam.
- Accumulated ear-tests still open: M5 dub-acid wash / effects-off = dry,
  M4 909 cymbals, M7 row-transition feel, restored M5 303 articulation+slides,
  and "a kid can groove cold" (M7.5).
