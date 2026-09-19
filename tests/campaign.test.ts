import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  newGame,
  advance,
  choosePerk,
  PERKS,
  attackDamage,
  logYield,
  damageCamp,
} from '../src/rules.js';

test('five-night rules: no skipping, mandatory unique rewards, victory and defeat', () => {
  const s = newGame();
  assert.equal(choosePerk(s, 'marksman'), false);
  for (const id of Object.keys(PERKS)) {
    assert.equal(advance(s), true);
    assert.equal(choosePerk(s, id), false);
    assert.equal(advance(s), false, 'living wave cannot be skipped');
    assert.equal(advance(s, true), true);
    assert.equal(advance(s), false, 'reward blocks next night');
    const snapshot = structuredClone(s);
    assert.equal(choosePerk(s, 'invalid'), false);
    assert.deepEqual(s, snapshot);
    s.paused = true; // Reward modal freezes simulation, but accepts a selection.
    assert.equal(choosePerk(s, id), true);
    assert.equal(choosePerk(s, id), false);
    s.paused = false;
  }
  assert.equal(s.day, 5);
  assert.equal(advance(s), true);
  assert.equal(advance(s, true), true);
  assert.equal(s.won, true);
  assert.equal(advance(s, true), false);
  assert.equal(choosePerk(s, 'marksman'), false);
  const loss = newGame();
  damageCamp(loss, 100);
  assert.equal(loss.over, true);
  assert.equal(loss.won, false);
});

test('reward effects: separate player/tower damage, harvesting, dawn supplies, health cap', () => {
  const s = newGame();
  assert.equal(attackDamage(s, 2), 2);
  assert.equal(logYield(s), 10);
  s.perks = ['marksman'];
  assert.equal(attackDamage(s, 2), 2.7);
  assert.equal(attackDamage(s, 2, true), 2);
  s.perks.push('engineer', 'scavenger');
  assert.equal(attackDamage(s, 2, true), 2.7);
  assert.equal(logYield(s), 15);
  advance(s);
  const wood = s.wood,
    scrap = s.scrap;
  advance(s, true);
  assert.equal(s.wood - wood, 50);
  assert.equal(s.scrap - scrap, 9);
  assert.equal(choosePerk(s, 'scavenger'), false);
  assert.equal(choosePerk(s, 'survivor'), true);
  assert.equal(s.playerHp, 125);
  assert.equal(s.health, 100);
});
