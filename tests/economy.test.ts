import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  COSTS,
  DAWN_SUPPLIES,
  GATHER,
  LOG_SWINGS,
  RV_FURNITURE,
  START_SUPPLIES,
  canBuild,
  collectLog,
  freshLogSwings,
  newGame,
} from '../src/rules.js';
import type { LogNode } from '../src/rules.js';

// ECO-01 constraints (docs/GAME_DESIGN.md §4/§5): the starting budget must not cover a tower,
// one full log must not cover tower+lantern+fence, and a day cannot field a tower and the bench.
test('ECO-01: a new campaign starts with 25 wood / 6 scrap and cannot afford a tower', () => {
  const s = newGame();
  assert.equal(s.wood, 25);
  assert.equal(s.scrap, 6);
  assert.deepEqual(START_SUPPLIES, { wood: 25, scrap: 6 });
  assert.ok(s.wood < COSTS.tower, 'spawn wood never covers a tower (35)');
  assert.equal(canBuild(s, 'tower'), false, 'the spawn player cannot place a tower');
  assert.equal(canBuild(s, 'lantern'), true, 'but the cheaper lantern is playable');
});

test('ECO-01: one full log is 3 swings x 10 wood, still short of tower+lantern+fence', () => {
  assert.equal(LOG_SWINGS, 3);
  assert.equal(freshLogSwings(), 3);
  const oneLog = LOG_SWINGS * GATHER.perSwing;
  assert.equal(oneLog, 30, 'one log pays 30 wood');
  const fullOpening = COSTS.tower + COSTS.lantern + COSTS.fence;
  assert.equal(fullOpening, 60, 'tower 35 + lantern 10 + fence 15');
  assert.ok(START_SUPPLIES.wood + oneLog < fullOpening, 'one log never buys the full set');
});

test('ECO-01: documented day-one and dawn budgets keep the trade-off real', () => {
  const dayOne = START_SUPPLIES.wood + LOG_SWINGS * GATHER.perSwing;
  const dawn = START_SUPPLIES.wood + DAWN_SUPPLIES.wood;
  assert.equal(dayOne, 55, 'day-one realistic budget: 25 start + 30 from one log');
  assert.equal(dawn, 50, 'dawn budget: 25 start + 25 supplies');
  const towerPlusBench = COSTS.tower + RV_FURNITURE.workbench.wood;
  assert.equal(towerPlusBench, 60, 'tower 35 + workbench 25');
  assert.ok(dayOne < towerPlusBench, 'a tower and the workbench cannot share day one');
  assert.ok(dawn < towerPlusBench, 'dawn supplies alone do not change that');
});

test('ECO-01: scavenger dawn bonus is trimmed with the base income', () => {
  assert.equal(DAWN_SUPPLIES.scrap, 5);
  assert.equal(DAWN_SUPPLIES.scavengerWood, 10);
  assert.equal(DAWN_SUPPLIES.scavengerScrap, 3);
  assert.equal(DAWN_SUPPLIES.wood + DAWN_SUPPLIES.scavengerWood, 35);
  assert.equal(DAWN_SUPPLIES.scrap + DAWN_SUPPLIES.scavengerScrap, 8);
});

test('ECO-01: a fresh log yields exactly LOG_SWINGS collects and then refuses', () => {
  const s = newGame();
  s.wood = 0;
  const log: LogNode = { id: 'economy', x: 0, z: 0, remaining: freshLogSwings() };
  for (let i = 0; i < LOG_SWINGS; i++) assert.equal(collectLog(s, log), GATHER.perSwing);
  assert.equal(log.remaining, 0);
  assert.equal(collectLog(s, log), 0, 'an empty log never pays again');
  assert.equal(s.wood, LOG_SWINGS * GATHER.perSwing);
});
