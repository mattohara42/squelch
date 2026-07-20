// Mixer state tests: defaults come from CFG, and a partial demo overlay merges
// onto them without dropping the untouched fields.
'use strict';
const assert = require('assert');

(async () => {
  const { defaultMixerState, mergeMixerState } = await import('../js/mixerState.js');
  const { CFG } = await import('../js/config.js');

  // --- defaults mirror CFG and start fully dry (no sends, no mute) ---
  {
    const d = defaultMixerState();
    for (const k of ['303a', '303b', '808', '909']) {
      assert.strictEqual(d.channels[k].level, CFG.EFFECTS.MIXER_LEVEL_DEFAULT, `${k} default level`);
      assert.strictEqual(d.channels[k].dist, false, `${k} dist off`);
      assert.strictEqual(d.channels[k].delay, false, `${k} delay off`);
      assert.strictEqual(d.channels[k].mute, false, `${k} unmuted`);
    }
    assert.strictEqual(d.dist.amount, CFG.EFFECTS.DISTORTION.AMOUNT_DEFAULT, 'dist amount default');
    assert.strictEqual(d.delay.steps, CFG.EFFECTS.DELAY.STEPS_DEFAULT, 'delay steps default');
    assert.strictEqual(d.master.volume, CFG.MASTER_GAIN_DEFAULT, 'master default');
    console.log('PASS defaults mirror CFG and start dry');
  }

  // --- a partial overlay merges without dropping untouched fields ---
  {
    const m = mergeMixerState({ channels: { '303a': { delay: true } }, delay: { level: 0.5 } });
    assert.strictEqual(m.channels['303a'].delay, true, 'overlaid send applied');
    assert.strictEqual(m.channels['303a'].level, CFG.EFFECTS.MIXER_LEVEL_DEFAULT, 'untouched level kept');
    assert.strictEqual(m.channels['303b'].delay, false, 'other channel untouched');
    assert.strictEqual(m.delay.level, 0.5, 'overlaid delay level applied');
    assert.strictEqual(m.delay.feedback, CFG.EFFECTS.DELAY.FEEDBACK_DEFAULT, 'untouched delay feedback kept');
    console.log('PASS partial overlay merges onto defaults');
  }

  // --- null/undefined overlay yields plain defaults ---
  {
    const m = mergeMixerState(undefined);
    assert.strictEqual(m.channels['303a'].dist, false, 'null overlay -> defaults');
    console.log('PASS null overlay yields defaults');
  }

  console.log('\nAll mixerState tests passed.');
})();
