// Headless scheduler test: pure logic, injectable clock, no real timers/audio.
'use strict';
const assert = require('assert');

(async () => {
  const { Scheduler } = await import('../js/scheduler.js');

  // --- steps fire at the right cadence for a given tempo ---
  {
    let clock = 0;
    const s = new Scheduler(() => clock);
    const fired = [];
    s.register({ onStep: (i, t, dur) => fired.push({ i, t, dur }) });
    s.setTempo(120); // 120 bpm -> 16th = 0.125s
    s.start(); // schedules everything within lookahead of clock=0

    assert.ok(fired.length > 0, 'steps scheduled on start');
    assert.ok(fired.every((f) => Math.abs(f.dur - 60 / 120 / 4) < 1e-12), 'onStep receives the step duration as its third arg');
    const stepDur = 60 / 120 / 4;
    for (let i = 1; i < fired.length; i++) {
      const isSwingStep = fired[i - 1].i % 2 === 1;
      const expectedDelta = isSwingStep ? stepDur : stepDur; // shuffle=0 here
      assert.ok(Math.abs((fired[i].t - fired[i - 1].t) - expectedDelta) < 1e-9, 'even step spacing at shuffle=0');
    }
    console.log('PASS cadence: steps spaced', stepDur, 's apart at 120bpm, shuffle=0');
    s.stop();
  }

  // --- shuffle swings only the even 16ths (odd step index), no drift ---
  {
    let clock = 0;
    const s = new Scheduler(() => clock);
    const fired = [];
    s.register({ onStep: (i, t) => fired.push({ i, t }) });
    s.setTempo(120);
    s.setShuffle(1); // full depth
    s.start();

    const stepDur = 60 / 120 / 4;
    const swing = 1 * 0.3 * stepDur; // CFG.SHUFFLE_MAX_FRACTION = 0.3
    for (let i = 1; i < fired.length; i++) {
      const prevIsOdd = fired[i - 1].i % 2 === 1;
      const curIsOdd = fired[i].i % 2 === 1;
      let expectedDelta = stepDur;
      if (curIsOdd) expectedDelta += swing; // this step delayed
      if (prevIsOdd) expectedDelta -= swing; // previous step's delay doesn't compound
      assert.ok(
        Math.abs((fired[i].t - fired[i - 1].t) - expectedDelta) < 1e-9,
        `swing step ${i} spacing (no drift): got ${fired[i].t - fired[i - 1].t}, want ${expectedDelta}`
      );
    }
    console.log('PASS shuffle: even 16ths swing by', swing.toFixed(4), 's, no compounding drift');
    s.stop();
  }

  // --- tempo change mid-stream takes effect from the next step, no glitch/jump ---
  {
    let clock = 0;
    const s = new Scheduler(() => clock);
    const fired = [];
    s.register({ onStep: (i, t) => fired.push({ i, t }) });
    s.setTempo(120);
    s.start();
    const firedBeforeChange = fired.length;
    const lastTimeBeforeChange = fired[fired.length - 1].t;

    s.setTempo(200); // speed up
    clock = 5; // advance the injected clock so _tick schedules more steps
    s._tick();

    const newStepDur = 60 / 200 / 4;
    const firstNewStep = fired[firedBeforeChange];
    assert.ok(firstNewStep.t > lastTimeBeforeChange, 'new steps scheduled after old ones, no time-travel');
    for (let i = firedBeforeChange + 1; i < fired.length; i++) {
      const delta = fired[i].t - fired[i - 1].t;
      assert.ok(delta > 0, 'no negative/zero gaps after tempo change');
    }
    console.log('PASS tempo change: steps continue forward, new spacing ~', newStepDur.toFixed(4), 's');
    s.stop();
  }

  console.log('\nAll scheduler tests passed.');
})();
