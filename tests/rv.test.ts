import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  newGame,
  advance,
  choosePerk,
  installFurniture,
  uninstallFurniture,
  canInstallFurniture,
  furnitureReason,
  rvSlots,
  hasFurniture,
  maxMedkits,
  setWeaponMod,
  weaponDamage,
  weaponRange,
  spawnTimeline,
  unlockWeapon,
  RV,
  RV_FURNITURE,
  WEAPON_MODS,
  heal,
  MEDKIT_HEAL,
} from '../src/rules.js';

test('function slots unlock across days while decoration is available from day one', () => {
  const s = newGame();
  assert.equal(rvSlots(s), 1, 'one function slot on the first day');
  assert.equal(installFurniture(s, 'workbench'), true);
  assert.equal(s.wood, 55);
  assert.equal(s.scrap, 4);
  assert.equal(
    canInstallFurniture(s, 'radio'),
    false,
    'only one function slot before the first night',
  );
  assert.match(furnitureReason(s, 'radio'), /功能槽不足/);
  installFurniture(s, 'plant');
  assert.equal(hasFurniture(s, 'plant'), true, 'decor does not compete for function slots');
  advance(s);
  advance(s, true);
  choosePerk(s, 'marksman');
  assert.equal(rvSlots(s), 2);
  s.wood = 100;
  s.scrap = 20;
  assert.equal(installFurniture(s, 'radio'), true);
  assert.equal(canInstallFurniture(s, 'medcab'), false, 'third slot waits for the second night');
  advance(s);
  advance(s, true);
  choosePerk(s, 'engineer');
  s.wood = 100;
  s.scrap = 20;
  assert.equal(rvSlots(s), 3);
  assert.equal(installFurniture(s, 'medcab'), true);
  assert.equal(RV.slotDays.length, RV.functionSlots);
  assert.equal(RV_FURNITURE.workbench.kind, 'function');
});

test('installing is gated by daylight and resources; dismantling refunds 60%', () => {
  const s = newGame();
  assert.equal(canInstallFurniture(s, 'unknown'), false);
  s.wood = 5;
  assert.equal(installFurniture(s, 'radio'), false, 'cannot afford');
  assert.match(furnitureReason(s, 'radio'), /材料不足/);
  s.wood = 80;
  assert.equal(installFurniture(s, 'radio'), true);
  assert.equal(s.wood, 70);
  assert.equal(s.scrap, 2);
  const night = newGame();
  night.phase = 'night';
  assert.match(furnitureReason(night, 'radio'), /白天/);
  const day1 = newGame();
  installFurniture(day1, 'radio');
  assert.equal(uninstallFurniture(day1, 'radio'), true);
  assert.equal(day1.wood, 76, '10 wood refunds 6');
  assert.equal(day1.scrap, 5, '6 scrap refunds 3');
  day1.phase = 'night';
  assert.equal(uninstallFurniture(day1, 'plant'), false, 'no dismantling at night');
});

test('the medical cabinet raises the kit cap, refills on install and every dawn', () => {
  const s = newGame();
  assert.equal(maxMedkits(s), 2);
  assert.equal(installFurniture(s, 'medcab'), true);
  assert.equal(maxMedkits(s), 3);
  assert.equal(s.medkits, 3, 'install tops up one kit');
  s.medkits = 1;
  s.playerHp = 40;
  assert.equal(heal(s), true);
  assert.equal(s.playerHp, 40 + MEDKIT_HEAL);
  assert.equal(s.medkits, 0, 'the last kit is spent');
  advance(s);
  advance(s, true);
  choosePerk(s, 'marksman');
  assert.equal(s.medkits, 1, 'dawn restocks one kit');
  s.medkits = 3;
  advance(s);
  advance(s, true);
  choosePerk(s, 'engineer');
  assert.equal(s.medkits, 3, 'never exceeds the cap');
  assert.equal(uninstallFurniture(s, 'medcab'), true);
  assert.equal(maxMedkits(s), 2);
  assert.equal(s.medkits, 2, 'removing the cabinet trims overflow kits');
});

test('the workbench gates weapon unlocks and grants one nightly mod that resets at dawn', () => {
  const s = newGame();
  s.scrap = 20;
  assert.equal(unlockWeapon(s, 'rifle'), false, 'no workshop, no new weapons');
  assert.equal(setWeaponMod(s, 'power'), false, 'no workbench, no mods');
  assert.equal(installFurniture(s, 'workbench'), true);
  assert.equal(unlockWeapon(s, 'rifle'), true);
  assert.equal(s.scrap, 6);
  assert.equal(setWeaponMod(s, 'power'), true);
  assert.equal(weaponDamage(s, 'carbine'), 3);
  assert.equal(weaponRange(s, 'carbine'), 9);
  assert.equal(setWeaponMod(s, 'range'), true, 'switching mods is free');
  assert.equal(weaponDamage(s, 'carbine'), 2);
  assert.equal(weaponRange(s, 'carbine'), 10);
  assert.equal(setWeaponMod(s, 'bogus'), false);
  advance(s);
  assert.equal(weaponRange(s, 'carbine'), 10, 'the mod carries into the night');
  advance(s, true);
  choosePerk(s, 'marksman');
  assert.equal(weaponRange(s, 'carbine'), 9, 'dawn resets the mod');
  assert.equal(s.weaponMod, null);
  assert.equal(setWeaponMod(s, 'power'), true);
  assert.equal(uninstallFurniture(s, 'workbench'), true);
  assert.equal(s.weaponMod, null, 'removing the bench removes the mod');
  assert.equal(WEAPON_MODS.power.damage, 1);
});

test('radio timeline collapses consecutive spawns into readable rows', () => {
  const rows = spawnTimeline(1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 10);
  assert.equal(rows[0].lane, 0);
  assert.ok(rows[0].at > 0);
  const wide = spawnTimeline(4);
  assert.ok(wide.length >= 3, 'a mixed night reads as several beats');
  for (const row of wide) {
    assert.ok(row.count >= 1);
    assert.ok(row.end >= row.at);
  }
  const fog = spawnTimeline(4).map((row) => row.type);
  assert.ok(fog.includes('stalker'));
  const siege = spawnTimeline(3).map((row) => row.type);
  assert.ok(siege.includes('spitter'));
});
