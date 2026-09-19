import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  WAVES,
  WINDS,
  WIND_DIR_ANGLE,
  WIND_TIER_STRENGTH,
  WIND_DRIFT_SCALE,
  nightWind,
  nightIntel,
  windVector,
  windDrift,
} from '../src/rules.js';

test('each night has a deterministic wind within the compass and strength bounds', () => {
  assert.equal(WINDS.length, WAVES.length, 'one wind entry per night');
  for (const w of WINDS) {
    assert.ok(Object.hasOwn(WIND_DIR_ANGLE, w.dir), `${w.dir} is a compass direction`);
    assert.ok(Object.hasOwn(WIND_TIER_STRENGTH, w.tier), `${w.tier} is a strength tier`);
    assert.equal(w.angle, WIND_DIR_ANGLE[w.dir], 'angle derives from the compass direction');
    assert.equal(w.strength, WIND_TIER_STRENGTH[w.tier], 'strength derives from the tier');
    assert.ok(w.strength > 0 && w.strength <= 1, 'strength stays inside 0..1');
    assert.ok(w.note.length > 0, 'intel copy exists');
  }
  for (let day = 1; day <= WAVES.length; day++) {
    assert.deepEqual(nightWind(day), WINDS[day - 1]);
    assert.deepEqual(nightWind(day), nightWind(day), 'no runtime randomness');
  }
});

test('nightWind clamps to campaign bounds like wave lookups', () => {
  assert.deepEqual(nightWind(0), nightWind(1));
  assert.deepEqual(nightWind(-3), nightWind(1));
  assert.deepEqual(nightWind(99), nightWind(WAVES.length));
});

test('windVector points where the wind blows and scales with strength', () => {
  const north = nightWind(1);
  assert.equal(north.dir, 'N');
  assert.ok(Math.abs(windVector(north).x) < 1e-12, 'north has no east-west push');
  assert.equal(windVector(north).z, -north.strength, 'north pushes toward -Z');
  const east = nightWind(3);
  assert.equal(east.dir, 'E');
  assert.equal(windVector(east).x, east.strength, 'east pushes toward +X');
  assert.ok(Math.abs(windVector(east).z) < 1e-12);
});

test('acid drift follows the wind component perpendicular to the shot', () => {
  const east = nightWind(3);
  const t = 0.5;
  const shotNorth = windDrift(east, 0, -1, t);
  assert.equal(shotNorth.z, 0, 'no drift along the shot');
  assert.ok(shotNorth.x > 0, 'east wind pushes a northbound glob east');
  assert.ok(Math.abs(shotNorth.x - east.strength * WIND_DRIFT_SCALE * t) < 1e-12);
  const still = (d: { x: number; z: number }, message: string): void => {
    assert.ok(Math.hypot(d.x, d.z) < 1e-12, message);
  };
  still(windDrift(nightWind(1), 0, -1, t), 'a tailwind has no lateral component');
  still(windDrift(nightWind(1), 0, 1, t), 'a headwind only shortens range, not aim');
  still(windDrift(east, 0, 0, t), 'no shot, no drift');
  still(windDrift(east, 1, 0, 0), 'no flight time, no drift');
  still(windDrift(east, 1, 0, t), 'wind along the shot does not bend it');
});

test('every night bends the shot across the wind, never along it', () => {
  const shots = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [3, 2],
  ] as const;
  for (let day = 1; day <= WAVES.length; day++) {
    const wind = nightWind(day);
    const w = windVector(wind);
    const t = 1.3;
    for (const [dx, dz] of shots) {
      const drift = windDrift(wind, dx, dz, t);
      const length = Math.hypot(dx, dz);
      assert.ok(
        Math.abs(drift.x * dx + drift.z * dz) < 1e-12,
        `day ${day}: drift stays perpendicular to the shot`,
      );
      const perpX = -dz / length,
        perpZ = dx / length;
      const crosswind = w.x * perpX + w.z * perpZ;
      if (Math.abs(crosswind) < 1e-12) {
        assert.ok(Math.hypot(drift.x, drift.z) < 1e-12, `day ${day}: no crosswind, no drift`);
      } else {
        assert.ok(
          crosswind * (drift.x * perpX + drift.z * perpZ) > 0,
          `day ${day}: drift follows the crosswind side`,
        );
        assert.ok(
          Math.abs(Math.hypot(drift.x, drift.z) - Math.abs(crosswind) * WIND_DRIFT_SCALE * t) <
            1e-12,
          `day ${day}: drift magnitude is crosswind speed times flight time`,
        );
      }
    }
  }
});

test('adjacent nights never repeat the same wind', () => {
  for (let day = 1; day < WAVES.length; day++)
    assert.notDeepEqual(nightWind(day), nightWind(day + 1), `night ${day} vs ${day + 1}`);
});

test('pre-night intel carries the wave brief plus its wind', () => {
  for (let day = 1; day <= WAVES.length; day++) {
    const intel = nightIntel(day);
    const wave = WAVES[day - 1];
    assert.notEqual(intel, wave, 'intel is a copy, not the mutable wave entry');
    assert.equal(intel.day, day);
    assert.equal(intel.name, wave.name);
    assert.equal(intel.lesson, wave.lesson);
    assert.equal(intel.advice, wave.advice);
    assert.equal(intel.fog, wave.fog);
    assert.ok(intel.groups.length > 0, 'groups stay available for the intel page');
    assert.deepEqual(intel.wind, nightWind(day));
    assert.ok(intel.wind.strength > 0, 'intel exposes a usable strength');
  }
  assert.equal(nightIntel(0).day, 1, 'intel clamps like the wind query');
});
