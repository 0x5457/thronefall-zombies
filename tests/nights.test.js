import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVES, ENEMY_TYPES, LANES, wavePlan, waveSize, siegeGoal, rangedGoal, revealed, applyArmor } from '../src/rules.js';

test('every night is a lesson with intents and reachable types', () => {
  assert.equal(WAVES.length, 5);
  for (const wave of WAVES) {
    assert.ok(wave.lesson && wave.advice, `${wave.name} explains itself`);
    for (const [type, count, lane, spacing, intent] of wave.groups) {
      assert.ok(Object.hasOwn(ENEMY_TYPES, type), `${type} exists`);
      assert.ok(count > 0 && spacing > 0);
      assert.ok(lane >= 0 && lane < LANES.length);
      assert.ok(intent, `${wave.name}/${type} has an intent tag`);
    }
  }
  const lessons = WAVES.map(w => w.lesson);
  assert.equal(new Set(lessons).size, 5, 'no two nights share the same lesson');
});

test('night 4 introduces fog with stealth enemies, night 3 fields the ranged enemy, night 1 stays a single-lane tutorial', () => {
  const fog = WAVES[3];
  assert.ok(fog.fog > 0 && fog.fog < 1, 'fog reduces visibility without blinding');
  const fogTypes = wavePlan(4).map(e => e.type);
  assert.ok(fogTypes.includes('stalker'), 'fog night fields stalkers');
  assert.ok(!fogTypes.includes('spitter'), 'ranged pressure belongs to the siege night');
  assert.equal(ENEMY_TYPES.stalker.stealth, true);
  assert.ok(wavePlan(3).map(e => e.type).includes('spitter'), 'siege night fields the ranged enemy');
  assert.equal(ENEMY_TYPES.spitter.ranged, true);
  assert.deepEqual(wavePlan(1).map(e => e.type), Array(10).fill('walker'), 'tutorial night unchanged');
  assert.equal(waveSize(2), 16, 'first two nights keep their size for the campaign test');
});

test('siege enemies pick the nearest tower inside their range and nothing otherwise', () => {
  const buildings = [
    { type: 'tower', x: 2, z: 0 },
    { type: 'tower', x: 9, z: 0 },
    { type: 'fence', x: 1, z: 0 },
  ];
  assert.equal(siegeGoal(0, 0, buildings, 15), buildings[0], 'closest tower wins');
  assert.equal(siegeGoal(0, 0, buildings, 1.5), null, 'out of range ignores targets');
  assert.equal(siegeGoal(20, 0, buildings, 15), buildings[1], 'range is measured from the enemy');
  assert.equal(siegeGoal(0, 0, [{ type: 'fence', x: .5, z: 0 }], 15), null, 'fences are not siege goals');
});

test('ranged enemies prefer buildings, then the player, then keep walking', () => {
  const buildings = [{ type: 'lantern', x: 4, z: 0 }];
  assert.deepEqual(rangedGoal(0, 0, 50, 50, buildings, 6.5), { kind: 'building', building: buildings[0] });
  assert.deepEqual(rangedGoal(0, 0, 3, 0, [], 6.5), { kind: 'player' });
  assert.equal(rangedGoal(0, 0, 20, 0, [], 6.5), null);
  assert.equal(rangedGoal(0, 0, 50, 50, [{ type: 'tower', x: 40, z: 0 }], 6.5), null, 'distant buildings are ignored');
});

test('stealth reveal comes from lamps, flares and close range, and fog is required to hide', () => {
  const lamps = [{ x: 0, z: 0, radius: 5 }];
  const flares = [{ active: true, x: 20, z: 0, radius: 5 }];
  const inactive = [{ active: false, x: 20, z: 0, radius: 5 }];
  assert.equal(revealed(3, 0, 99, 99, [], [], 0), true, 'no fog means always visible');
  assert.equal(revealed(3, 0, 99, 99, lamps, [], .4), true, 'inside lamp radius');
  assert.equal(revealed(20, 0, 99, 99, [], flares, .4), true, 'inside an active flare');
  assert.equal(revealed(20, 0, 99, 99, [], inactive, .4), false, 'expired flares reveal nothing');
  assert.equal(revealed(12, 0, 10, 0, [], [], .4), true, 'players reveal what is on top of them');
  assert.equal(revealed(12, 0, 30, 0, [], [], .4), false, 'otherwise fog hides');
});

test('new enemy stats stay bounded and armor applies as usual', () => {
  for (const type of ['spitter', 'stalker']) {
    const def = ENEMY_TYPES[type];
    assert.ok(def.hp > 0 && def.speed > 0 && def.damage > 0 && def.bounty > 0);
    assert.equal(applyArmor(10, def.armor, 0), 10, 'armor-less enemies take full damage');
  }
});
