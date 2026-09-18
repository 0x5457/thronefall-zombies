import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInterior, interiorBlocked } from '../src/interior.js';

test('bedside switch changes actual light and shade, without changing walkable aisle', () => {
  const room = makeInterior();
  const lamp = room.scene.children.find(o => o.isPointLight);
  const shade = room.scene.children.find(o => o.isMesh && o.position.x === -4.15 && o.material.isMeshBasicMaterial);
  assert.equal(room.lampOn, true);
  assert.equal(lamp.intensity, 5);
  assert.equal(room.toggleLamp(), false);
  assert.equal(lamp.intensity, 0);
  assert.equal(shade.visible, false);
  assert.equal(room.toggleLamp(), true);
  assert.equal(lamp.intensity, 5);
  assert.equal(shade.visible, true);
  for (const [x, z] of [[1.02, .85], [-1.5, .85], [3.9, .85]]) assert.equal(interiorBlocked(x, z), false);
  for (const [x, z] of [[-3, .85], [0, -1], [NaN, 0]]) assert.equal(interiorBlocked(x, z), true);
});
