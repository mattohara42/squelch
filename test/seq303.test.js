// Tests for the locked 303 slide/gate semantics (CLAUDE.md decisions).
'use strict';
const assert = require('assert');

(async () => {
  const { eventsForStep } = await import('../js/seq303.js');
  const { CFG } = await import('../js/config.js');
  const FRAC = CFG.VOICE303.GATE_FRACTION;

  const S = (n, g, a, s) => ({ n, g, a, s });
  const dur = 0.125;

  // Rest step: single gate-off at the step time.
  {
    const steps = [S(33, 1, 0, 0), S(33, 0, 0, 0)];
    const ev = eventsForStep(steps, 1, 2.0, dur);
    assert.deepStrictEqual(ev, [{ type: 'note', time: 2.0, gate: false }]);
    console.log('PASS rest step posts a single gate-off');
  }

  // Plain gated step: trigger (no slide) + gate-off at GATE_FRACTION of the step.
  {
    const steps = [S(33, 1, 0, 0), S(45, 1, 1, 0)];
    const ev = eventsForStep(steps, 1, 2.0, dur);
    assert.strictEqual(ev.length, 2);
    assert.deepStrictEqual(ev[0], { type: 'note', time: 2.0, note: 45, gate: true, accent: true, slide: false });
    assert.strictEqual(ev[1].gate, false);
    assert.ok(Math.abs(ev[1].time - (2.0 + dur * FRAC)) < 1e-12, 'gate-off lands at GATE_FRACTION of the step');
    console.log('PASS plain note: retrigger + gate-off at', FRAC, 'of step');
  }

  // Slide-flagged step: gate held (no gate-off event).
  {
    const steps = [S(33, 1, 0, 0), S(33, 1, 0, 1)];
    const ev = eventsForStep(steps, 1, 2.0, dur);
    assert.strictEqual(ev.length, 1, 'no gate-off when the step slides into the next');
    console.log('PASS slide-flagged step holds its gate');
  }

  // Step AFTER a slide-flagged step triggers with slide=true (the locked
  // "glide INTO the next step" reading — flag comes from the previous step).
  {
    const steps = [S(33, 1, 0, 1), S(45, 1, 0, 0)];
    const ev = eventsForStep(steps, 1, 2.0, dur);
    assert.strictEqual(ev[0].slide, true, 'trigger inherits slide from the previous step\'s flag');
    console.log('PASS slide flag applies to the NEXT step\'s trigger');
  }

  // Slide flag on a step followed by a rest: prev must be gated for slide to carry.
  {
    const steps = [S(33, 0, 0, 1), S(45, 1, 0, 0)];
    const ev = eventsForStep(steps, 1, 2.0, dur);
    assert.strictEqual(ev[0].slide, false, 'slide does not carry over a rest');
    console.log('PASS slide does not carry over a rest');
  }

  // Wraparound: step 0 inherits slide from the last step.
  {
    const steps = Array.from({ length: 16 }, () => S(33, 1, 0, 0));
    steps[15] = S(36, 1, 0, 1);
    const ev = eventsForStep(steps, 0, 4.0, dur);
    assert.strictEqual(ev[0].slide, true, 'step 0 inherits slide from step 15');
    console.log('PASS slide wraps from step 15 to step 0');
  }

  console.log('\nAll seq303 tests passed.');
})();
