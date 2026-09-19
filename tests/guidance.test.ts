import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  newGame,
  guidanceStep,
  guidanceProgress,
  collectLog,
  logYield,
  GATHER,
  GUIDANCE,
  WAVES,
  COSTS,
  LOG_SWINGS,
} from '../src/rules.js';
import type { Building, LogNode } from '../src/rules.js';

const log = (id: string, remaining = LOG_SWINGS): LogNode => ({ id, x: 0, z: 0, remaining });
const tower = (): Building => ({
  id: 1,
  type: 'tower',
  x: 0,
  z: 6,
  angle: 0,
  level: 1,
  hp: 220,
  maxHp: 220,
  invested: { wood: COSTS.tower, scrap: 0 },
});

test('guidance step derives from logs, buildings and phase without new save fields', () => {
  const s = newGame();
  assert.equal(guidanceStep(s), 'gather');
  s.logs = [log('near'), log('far')];
  assert.equal(guidanceStep(s), 'gather', 'untouched logs keep the harvest step');
  s.logs[0].remaining--;
  assert.equal(guidanceStep(s), 'build');
  s.buildings.push(tower());
  assert.equal(guidanceStep(s), 'fight');
  s.phase = 'night';
  assert.equal(guidanceStep(s), 'done', 'guidance is hidden on night 1');
  s.phase = 'day';
  s.day = 2;
  assert.equal(guidanceStep(s), 'done', 'guidance is hidden from day 2 on');
});

test('building a tower first implies fight even when logs were never touched', () => {
  const s = newGame();
  s.logs = [log('near'), log('far')];
  s.buildings.push(tower());
  assert.equal(guidanceStep(s), 'fight', 'no backwards regression to gather');
  s.logs[0].remaining = 0;
  assert.equal(guidanceStep(s), 'fight');
});

test('guidance progress reports collectible wood and non-empty logs', () => {
  const s = newGame();
  s.logs = [log('a'), log('b')];
  const progress = guidanceProgress(s);
  assert.equal(progress.step, 'gather');
  assert.equal(progress.wood, 2 * LOG_SWINGS * logYield(s));
  assert.equal(progress.wood, 60);
  assert.equal(progress.logs, 2);
  s.logs.push(log('empty', 0));
  assert.equal(guidanceProgress(s).logs, 2, 'empty logs are not counted');
  assert.equal(guidanceProgress(s).wood, 60);
  assert.equal(guidanceProgress(s).step, 'build', 'a harvested log advances the step');
  s.perks.push('scavenger');
  assert.equal(guidanceProgress(s).wood, 2 * LOG_SWINGS * 15);
});

test('guidance copy consumes the night-one hint and the tower price', () => {
  assert.ok(GUIDANCE.gather.body.includes(WAVES[0].hint));
  assert.ok(GUIDANCE.build.body.includes(String(COSTS.tower)));
  assert.equal(GUIDANCE.fight.body.includes('N'), true);
});

test('collectLog decrements the log, adds wood, and refuses empty logs', () => {
  const s = newGame();
  s.wood = 0;
  const l = log('a');
  assert.equal(collectLog(s, l), 10);
  assert.equal(l.remaining, LOG_SWINGS - 1);
  assert.equal(s.wood, 10);
  l.remaining = 1;
  assert.equal(collectLog(s, l), 10);
  assert.equal(l.remaining, 0);
  assert.equal(s.wood, 20);
  assert.equal(collectLog(s, l), 0);
  assert.equal(l.remaining, 0);
  assert.equal(s.wood, 20);
});

test('collectLog honors the scavenger bonus', () => {
  const s = newGame();
  s.wood = 0;
  s.perks.push('scavenger');
  const l = log('a');
  assert.equal(collectLog(s, l), 15);
  assert.equal(s.wood, 15);
  assert.equal(l.remaining, LOG_SWINGS - 1);
});

test('GATHER constant freezes the gathering design values', () => {
  assert.deepEqual(GATHER, { reach: 3, swing: 0.45, hitAt: 0.28, cooldown: 0.35, perSwing: 10 });
});
