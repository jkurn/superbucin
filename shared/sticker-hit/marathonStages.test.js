import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STICKER_HIT_GAME_CONFIG } from './gameConfig.js';
import { buildExpandedStageDefinitions } from './marathonStages.js';

describe('marathonStages', () => {
  it('default MARATHON_ROUNDS=1 matches base STAGES length and preserves stage-4 boss', () => {
    const expanded = buildExpandedStageDefinitions(STICKER_HIT_GAME_CONFIG);
    assert.equal(expanded.length, STICKER_HIT_GAME_CONFIG.STAGES.length);
    assert.equal(expanded[4].isBoss, true);
  });

  it('MARATHON_ROUNDS=2 chains 10 stages; boss at indices 4 and 9', () => {
    const cfg = { ...STICKER_HIT_GAME_CONFIG, MARATHON_ROUNDS: 2 };
    const expanded = buildExpandedStageDefinitions(cfg);
    assert.equal(expanded.length, 10);
    for (let i = 0; i < expanded.length; i += 1) {
      assert.equal(expanded[i].isBoss, i % 5 === 4, `stage ${i}`);
    }
    assert.ok(expanded[5].stickersToLand >= STICKER_HIT_GAME_CONFIG.STAGES[0].stickersToLand);
  });
});
