import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { makeInterior, interiorBlocked } from '../src/interior.js';

test('bedside switch changes actual light and shade, without changing walkable aisle', () => {
  const room = makeInterior();
  const lamp = room.scene.children.find((o): o is T.PointLight => o instanceof T.PointLight)!;
  const shade = room.scene.children.find(
    (o): o is T.Mesh<T.BufferGeometry, T.MeshBasicMaterial> =>
      o instanceof T.Mesh && o.material instanceof T.MeshBasicMaterial && o.position.x === -4.15,
  )!;
  assert.equal(room.lampOn, true);
  assert.equal(lamp.intensity, 5);
  assert.equal(room.toggleLamp(), false);
  assert.equal(lamp.intensity, 0);
  assert.equal(shade.visible, false);
  assert.equal(room.toggleLamp(), true);
  assert.equal(lamp.intensity, 5);
  assert.equal(shade.visible, true);
  for (const [x, z] of [
    [1.02, 0.85],
    [-1.5, 0.85],
    [3.9, 0.85],
  ])
    assert.equal(interiorBlocked(x, z), false);
  for (const [x, z] of [
    [-3, 0.85],
    [0, -1],
    [NaN, 0],
  ])
    assert.equal(interiorBlocked(x, z), true);
});

test('furniture slots toggle with ownership and locked function slots stay dim', () => {
  const room = makeInterior();
  for (const id of ['workbench', 'radio', 'medcab', 'plant', 'quilt', 'photos']) {
    assert.equal(room.modules[id].visible, false, `${id} starts hidden`);
    assert.equal(room.markers[id].visible, true, `${id} shows an empty marker`);
  }
  room.setFurniture(['workbench', 'plant']);
  assert.equal(room.modules.workbench.visible, true);
  assert.equal(room.modules.plant.visible, true);
  assert.equal(room.modules.radio.visible, false);
  assert.equal(room.markers.workbench.visible, false, 'installed slot hides its marker');
  assert.equal(room.markers.radio.visible, true);
  room.setSlots(2);
  assert.equal(room.markers.workbench.material.opacity, 0.6, 'first slot open');
  assert.equal(room.markers.radio.material.opacity, 0.6, 'second slot open');
  assert.equal(room.markers.medcab.material.opacity, 0.2, 'third function slot still locked');
  assert.equal(room.markers.plant.material.opacity, 0.65, 'decor markers are never locked');
  room.setFurniture([]);
  assert.equal(room.modules.workbench.visible, false);
  for (const id of ['workbench', 'radio', 'medcab']) {
    const slot = room.slots[id];
    assert.equal(interiorBlocked(slot.x, slot.z), true, `${id} sits outside the walkable aisle`);
    assert.ok(slot.z >= 1.55, `${id} clears the aisle boundary at 1.38`);
    assert.equal(room.modules[id].position.z, slot.z, `${id} model is placed on its slot`);
    assert.equal(room.modules[id].position.x, slot.x);
  }
  for (const id of ['plant', 'quilt', 'photos']) {
    assert.equal(room.modules[id].position.y, room.slots[id].y, `${id} hangs at its anchor height`);
  }
  for (const id of ['plant', 'quilt', 'photos']) assert.equal(room.slots[id].kind, 'decor');
});
