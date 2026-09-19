import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  newGame,
  applyArmor,
  wavePlan,
  waveSize,
  WAVES,
  ENEMY_TYPES,
  WEAPONS,
  DASH,
  FLARE,
  unlockWeapon,
  equipWeapon,
  damagePlayer,
  playerDown,
  tickSurvival,
  useFlare,
  heal,
  maxHp,
  upgrade,
  repair,
  refundValue,
  upgradeCost,
  expedition,
  EXPEDITIONS,
  MAX_LEVEL,
  dayReady,
} from '../src/rules.js';

test('armor reduces damage unless the weapon penetrates it; reduction is capped', () => {
  const brute = ENEMY_TYPES.brute;
  assert.ok(
    applyArmor(2, brute.armor, WEAPONS.carbine.armorPen) <
      (applyArmor(6, brute.armor, WEAPONS.rifle.armorPen) / 3) * 1.05,
  );
  assert.equal(applyArmor(10, 0, 0.5), 10);
  assert.equal(applyArmor(10, 5, 0), 10 * (1 - 0.7), 'reduction never exceeds the cap');
  assert.equal(applyArmor(10, 1, 1), 10);
  assert.equal(applyArmor(10, -3, 0.2), 10);
});

test('wave plan matches wave sizes, keeps group lanes and spaces later groups apart', () => {
  for (let day = 1; day <= WAVES.length; day++) {
    const plan = wavePlan(day);
    assert.equal(plan.length, waveSize(day));
    for (const entry of plan) {
      assert.ok(Object.hasOwn(ENEMY_TYPES, entry.type));
      assert.ok(entry.lane >= 0 && entry.lane < 3);
      assert.ok(entry.at > 0);
    }
    for (let i = 1; i < plan.length; i++)
      assert.ok(plan[i].at >= plan[i - 1].at, 'spawns stay ordered');
    const sources = WAVES[day - 1].groups;
    sources.forEach(([type, count, lane], group) => {
      const matches = plan.filter((e) => e.type === type && e.lane === lane);
      assert.equal(matches.length, count);
      if (group > 0)
        assert.ok(Math.min(...matches.map((e) => e.at)) - plan[0].at >= 6, 'later groups breathe');
    });
  }
  assert.ok(wavePlan(5).some((e) => e.type === 'alpha'));
  assert.deepEqual(
    wavePlan(1).map((e) => e.type),
    Array(10).fill('walker'),
  );
});

test('weapon unlock costs scrap, equips the new gun, and equip only accepts unlocked ids', () => {
  const s = newGame();
  assert.equal(equipWeapon(s, 'rifle'), false);
  s.scrap = 10;
  assert.equal(unlockWeapon(s, 'rifle'), false, 'the RV workbench gates new weapons');
  s.rv.push('workbench');
  assert.equal(unlockWeapon(s, 'rifle'), true);
  assert.deepEqual(s.unlocked, ['carbine', 'rifle']);
  assert.equal(s.weapon, 'rifle');
  assert.equal(s.scrap, 0);
  assert.equal(unlockWeapon(s, 'rifle'), false, 'no double unlock');
  assert.equal(equipWeapon(s, 'carbine'), true);
  assert.equal(equipWeapon(s, 'nope'), false);
  s.phase = 'night';
  assert.equal(unlockWeapon(s, 'shotgun'), false, 'workshop only opens in daylight');
  assert.equal(equipWeapon(s, 'rifle'), true, 'switching stays available at night');
});

test('player damage, down penalty and survival ticks are bounded', () => {
  const s = newGame();
  assert.equal(damagePlayer(s, 30), false);
  assert.equal(s.playerHp, 70);
  assert.equal(damagePlayer(s, 100), true, 'lethal damage reports a down');
  assert.equal(s.playerHp, 0);
  const over = playerDown(s);
  assert.equal(over, false);
  assert.equal(s.health, 85, 'down costs 15 camp durability');
  assert.equal(s.playerHp, Math.ceil(maxHp(s) / 2));
  damagePlayer(s, 0);
  assert.equal(damagePlayer(s, NaN), false);
  s.paused = true;
  assert.equal(damagePlayer(s, 10), false, 'paused players take no damage');
  s.paused = false;
  s.playerHp = 60;
  assert.equal(heal(s), true);
  assert.equal(s.playerHp, 100);
  assert.equal(s.medkits, 1);
  assert.equal(heal(s), false, 'full health refuses to waste a kit');
  s.stamina = 50;
  s.staminaDelay = 0;
  tickSurvival(s, 1);
  assert.equal(s.stamina, 50 + DASH.regen);
  tickSurvival(s, 100);
  assert.equal(s.stamina, 100, 'stamina caps');
  assert.equal(s.flareCooldown, 0);
  assert.equal(useFlare(s), true);
  assert.equal(s.flareCooldown, FLARE.cooldown);
  assert.equal(useFlare(s), false);
  tickSurvival(s, 3);
  assert.equal(s.flareCooldown, FLARE.cooldown - 3);
  const paused = newGame();
  paused.paused = true;
  tickSurvival(paused, 5);
  assert.equal(paused.stamina, 100);
});

test('building upgrade tracks invested resources and dismantling refunds 60%', () => {
  const s = newGame();
  s.wood = 500;
  s.scrap = 500;
  const building = {
    type: 'tower',
    level: 1,
    hp: 220,
    maxHp: 220,
    invested: { wood: 35, scrap: 0 },
  };
  assert.equal(upgrade(s, building), true);
  assert.equal(building.level, 2);
  assert.equal(building.maxHp, 320);
  assert.equal(building.hp, 320);
  assert.deepEqual(building.invested, { wood: 55, scrap: 4 });
  assert.equal(refundValue(building).wood, 33);
  assert.equal(refundValue(building).scrap, 2);
  assert.equal(upgrade(s, building), true);
  assert.equal(building.level, 3);
  assert.equal(upgrade(s, building), false, 'three levels is the cap');
  assert.equal(MAX_LEVEL, 3);
  const poor = newGame();
  poor.wood = 0;
  poor.scrap = 0;
  assert.equal(upgrade(poor, { level: 1, hp: 1, maxHp: 1, invested: {} }), false);
  assert.deepEqual(upgradeCost({ level: 1 }), { wood: 20, scrap: 4 });
  assert.deepEqual(upgradeCost({ level: 2 }), { wood: 40, scrap: 8 });
});

test('repair works in daylight only and respects the engineer perk', () => {
  const s = newGame();
  const building = { level: 1, hp: 100, maxHp: 220, invested: {} };
  assert.equal(repair(s, building), true);
  assert.equal(s.wood, 70);
  assert.equal(building.hp, 190, '90 repair restores a structure');
  s.perks.push('engineer');
  s.wood = 50;
  assert.equal(repair(s, building), true);
  assert.equal(building.hp, 220, 'clamped at max');
  s.phase = 'night';
  building.hp = 10;
  assert.equal(repair(s, building), false, 'no repairs at night');
  assert.equal(dayReady(newGame()), true);
});

test('expeditions are once per day, cost daylight, and can injure the scout', () => {
  const s = newGame();
  const station = EXPEDITIONS.find((e) => e.id === 'station');
  assert.equal(expedition(s, 'station'), true);
  assert.equal(s.expeditionDay, 1);
  assert.equal(s.elapsed, station.time);
  assert.equal(s.scrap, 8 + station.scrap);
  assert.equal(s.playerHp, 100 - station.injury);
  assert.equal(expedition(s, 'mill'), false, 'one trip per day');
  const hurt = newGame();
  hurt.playerHp = 10;
  assert.equal(expedition(hurt, 'station'), false, 'cannot march while badly hurt');
  const late = newGame();
  late.elapsed = 100;
  assert.equal(expedition(late, 'station'), false, 'needs enough daylight left');
  assert.equal(expedition(late, 'mill'), true, 'a short trip still fits');
  const night = newGame();
  night.phase = 'night';
  assert.equal(expedition(night, 'mill'), false);
});
