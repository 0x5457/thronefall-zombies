import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  SAVE_BACKUP_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  applySave,
  campaignPayload,
  isValidSave,
  readSave,
  resetCampaign,
  saveSummary,
  writeSave,
} from '../src/save.js';
import type { ReadSaveResult } from '../src/save.js';
import { newGame } from '../src/rules.js';
import type { Building } from '../src/rules.js';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

function campaign() {
  const state = newGame();
  state.day = 3;
  state.wood = 42;
  state.scrap = 7;
  state.health = 86;
  state.playerHp = 70;
  state.perks = ['marksman', 'scavenger'];
  state.unlocked = ['carbine', 'rifle'];
  state.weapon = 'rifle';
  state.rv = ['workbench', 'radio'];
  state.weaponMod = 'range';
  state.nextBuildId = 3;
  state.buildings.push(
    {
      id: 1,
      type: 'tower',
      x: -3,
      z: -8,
      angle: 1.5707963267948966,
      r: 1.2,
      level: 2,
      maxHp: 320,
      hp: 210,
      invested: { wood: 55, scrap: 4 },
    } as Building,
    {
      id: 2,
      type: 'lantern',
      x: 4,
      z: 2,
      angle: 0,
      r: 0.35,
      level: 1,
      maxHp: 220,
      hp: 220,
      invested: { wood: 10, scrap: 0 },
    } as Building,
  );
  state.logs.forEach((log, index) => {
    log.id = `log-${index + 1}`;
    log.remaining = index + 1;
  });
  return state;
}

test('checkpoint payload round-trips through storage and restores in place', () => {
  const original = campaign();
  const storage = memoryStorage();
  assert.deepEqual(writeSave(original, storage), { ok: true });

  const loaded = readSave(storage) as Extract<ReadSaveResult, { ok: true }>;
  assert.equal(loaded.ok, true);
  assert.equal(loaded.save.version, SAVE_VERSION);
  assert.equal(loaded.recovered, false);

  const restored = newGame();
  const buildings = restored.buildings,
    logs = restored.logs;
  applySave(restored, loaded.save);
  assert.equal(restored.buildings, buildings, 'building array reference survives a load');
  assert.equal(restored.logs, logs, 'log array reference survives a load');
  assert.equal(restored.day, 3);
  assert.equal(restored.wood, 42);
  assert.equal(restored.weapon, 'rifle');
  assert.deepEqual(restored.perks, ['marksman', 'scavenger']);
  assert.deepEqual(restored.rv, ['workbench', 'radio']);
  assert.deepEqual(restored.buildings, original.buildings);
  assert.deepEqual(
    restored.logs.map((l) => l.remaining),
    original.logs.map((l) => l.remaining),
  );
  assert.equal(restored.paused, false);
  assert.equal(restored.manualPause, false);
});

test('a reset keeps the live arrays but returns every rule field to day one', () => {
  const state = campaign();
  const buildings = state.buildings;
  resetCampaign(state);
  assert.equal(state.buildings, buildings);
  assert.equal(state.buildings.length, 0);
  assert.equal(state.day, 1);
  assert.equal(state.wood, 80);
  assert.deepEqual(state.perks, []);
});

test('corrupt current falls back to the previous valid backup', () => {
  const storage = memoryStorage();
  writeSave(campaign(), storage);
  const backup = storage.map.get(SAVE_KEY)!;
  storage.map.set(SAVE_BACKUP_KEY, backup);
  storage.map.set(SAVE_KEY, '{not json');
  const loaded = readSave(storage) as Extract<ReadSaveResult, { ok: true }>;
  assert.equal(loaded.ok, true);
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.save.state.day, 3);
});

test('a newer save version is refused without touching the stored data', () => {
  const storage = memoryStorage();
  const future = campaignPayload(campaign());
  future.version = SAVE_VERSION + 4;
  storage.map.set(SAVE_KEY, JSON.stringify(future));
  const loaded = readSave(storage) as Extract<ReadSaveResult, { ok: false }>;
  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, 'version');
  assert.equal(
    storage.map.get(SAVE_KEY),
    JSON.stringify(future),
    'refusal never rewrites the slot',
  );
});

test('missing, storage-disabled and quota-failing paths report reasons', () => {
  assert.equal(
    (readSave(memoryStorage()) as Extract<ReadSaveResult, { ok: false }>).reason,
    'missing',
  );
  assert.equal((readSave(null) as Extract<ReadSaveResult, { ok: false }>).reason, 'storage');
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.deepEqual(writeSave(campaign(), full as unknown as Storage), {
    ok: false,
    reason: 'quota',
  });
});

test('only day checkpoints are written and validated', () => {
  const night = campaign();
  night.phase = 'night';
  assert.deepEqual(writeSave(night, memoryStorage()), { ok: false, reason: 'phase' });
  const payload = campaignPayload(campaign());
  payload.phase = 'night';
  assert.equal(isValidSave(payload), false);
  assert.equal(isValidSave(campaignPayload(campaign())), true);
});

test('saveSummary exposes what the home screen needs', () => {
  const summary = saveSummary(campaignPayload(campaign()))!;
  assert.deepEqual(
    { day: summary.day, health: summary.health, perks: summary.perks },
    { day: 3, health: 86, perks: 2 },
  );
});
