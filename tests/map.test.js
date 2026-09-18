import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP, cameraFocus } from '../src/map.js';
import { walkable, shore } from '../src/world.js';
test('expanded terrain supports movement beyond old world, but excludes shore and limits', () => {
  assert.equal(MAP.size, 180);
  assert.equal(walkable(-56, -5), true);
  assert.equal(walkable(0, -60), true);
  assert.equal(walkable(-64, 0), false);
  assert.equal(walkable(shore(0), 0), false);
  assert.equal(walkable(NaN, 0), false);
});
test('camera preserves camp deadzone and clamps far views to terrain', () => {
  assert.deepEqual(cameraFocus(1, -6, 33, 23), { x: 0, z: 0 });
  assert.ok(cameraFocus(-56, -5, 33, 23).x < -40);
  for (const width of [20, 33, 60, 100]) {
    const p = cameraFocus(-500, 500, width, 32);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    assert.ok(Math.abs(p.x) <= Math.max(0, MAP.half - width - 9));
    assert.ok(Math.abs(p.z) <= MAP.half - 32 * 1.32 - 12);
  }
});
