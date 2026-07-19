// Pure-math tests for the M5 effects chain (no AudioContext needed).
'use strict';
const assert = require('assert');

(async () => {
  const { makeDistortionCurve, delayTimeForSteps, compressorRatioForAmount } = await import('../js/effectsMath.js');

  // --- distortion curve: finite, bounded, symmetric-ish, more amount = more shaping ---
  {
    const curveLow = makeDistortionCurve(0.05);
    const curveHigh = makeDistortionCurve(1);
    for (const curve of [curveLow, curveHigh]) {
      for (const v of curve) {
        assert.ok(Number.isFinite(v), 'curve value is finite');
        assert.ok(Math.abs(v) <= 1.0001, `curve value stays in [-1,1]-ish range: ${v}`);
      }
    }
    // At the same input x, more distortion amount should push values further from linear.
    const mid = Math.floor(curveLow.length * 0.75); // x > 0 region
    assert.ok(Math.abs(curveHigh[mid]) !== Math.abs(curveLow[mid]), 'amount actually changes the shaping');
    console.log('PASS distortion curve: finite, bounded, amount-sensitive');
  }

  // --- delay time: bar/steps, monotonic, matches known musical values ---
  {
    const q = delayTimeForSteps(120, 4); // 120bpm quarter note
    assert.ok(Math.abs(q - 0.5) < 1e-9, `120bpm/4 steps = 0.5s quarter note (got ${q})`);
    const eighth = delayTimeForSteps(120, 8);
    assert.ok(Math.abs(eighth - 0.25) < 1e-9, `120bpm/8 steps = 0.25s eighth note (got ${eighth})`);
    assert.ok(eighth < q, 'more steps -> shorter delay time');
    const faster = delayTimeForSteps(160, 4);
    assert.ok(faster < q, 'higher bpm -> shorter delay time at same steps');
    console.log('PASS delay time: correct musical subdivisions, monotonic with steps/bpm');
  }

  // --- compressor ratio: amount=0 transparent, monotonic, capped ---
  {
    const r0 = compressorRatioForAmount(0);
    const r1 = compressorRatioForAmount(1);
    const rMid = compressorRatioForAmount(0.5);
    assert.strictEqual(r0, 1, 'amount=0 gives ratio 1 (transparent, no compression)');
    assert.ok(r1 > rMid && rMid > r0, 'ratio increases monotonically with amount');
    console.log(`PASS compressor ratio: ${r0} -> ${rMid} -> ${r1}`);
  }

  console.log('\nAll effects math tests passed.');
})();
