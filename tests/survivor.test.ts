import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  newGame,
  tickSurvival,
  staminaRegen,
  staminaDelay,
  SURVIVOR_STAMINA,
  DASH,
  PERKS,
} from '../src/rules.js';
import type { GameState } from '../src/rules.js';

test('the survivor perk speeds up stamina regen and shortens the post-dash delay', () => {
  const s = newGame();
  assert.equal(staminaRegen(s), DASH.regen);
  assert.equal(staminaDelay(s), DASH.delay);
  s.perks.push('survivor');
  assert.equal(staminaRegen(s), SURVIVOR_STAMINA.regen);
  assert.equal(staminaDelay(s), SURVIVOR_STAMINA.delay);
  assert.ok(staminaRegen(s) > DASH.regen, 'survivor regenerates faster');
  assert.ok(staminaDelay(s) < DASH.delay, 'survivor waits less before regenerating');
});

test('tickSurvival regains stamina sooner and faster with the survivor perk', () => {
  const ticksToRegen = (s: GameState): number => {
    let n = 0;
    while (!s.stamina && n < 20) {
      tickSurvival(s, 0.1);
      n++;
    }
    return n;
  };
  const base = newGame();
  base.stamina = 0;
  base.staminaDelay = DASH.delay;
  const baseTicks = ticksToRegen(base);
  const survivor = newGame();
  survivor.perks.push('survivor');
  survivor.stamina = 0;
  survivor.staminaDelay = DASH.delay;
  const survivorTicks = ticksToRegen(survivor);
  assert.ok(baseTicks >= 5, `base delay holds about 0.5s (${baseTicks} ticks)`);
  assert.equal(survivorTicks, 3, 'survivor clamps the delay to about 0.3s');
  assert.ok(survivorTicks < baseTicks, 'survivor starts regenerating sooner');
  const slow = newGame();
  slow.stamina = 0;
  slow.staminaDelay = 0;
  tickSurvival(slow, 1);
  assert.equal(slow.stamina, DASH.regen);
  const fast = newGame();
  fast.perks.push('survivor');
  fast.stamina = 0;
  fast.staminaDelay = 0;
  tickSurvival(fast, 1);
  assert.equal(fast.stamina, SURVIVOR_STAMINA.regen);
  assert.ok(fast.stamina > slow.stamina, 'same second, more stamina');
  tickSurvival(fast, 100);
  assert.equal(fast.stamina, 100, 'stamina still caps at 100');
});

test('the survivor card sells the stamina recovery improvement', () => {
  assert.match(PERKS.survivor.currentText, /体力/);
  assert.match(PERKS.survivor.currentText, /\+25/);
});
