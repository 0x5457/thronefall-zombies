import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  FOOTPRINTS,
  pointInFootprint,
  distanceToFootprint,
  circleTouchesFootprint,
  footprintsOverlap,
  canReach,
} from '../src/rules.js';

// BLD-04/BLD-05: rotated blocking shapes shared by preview, collision and passability.
const fence = FOOTPRINTS.fence,
  lantern = FOOTPRINTS.lantern;
const near = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

test('BLD-04: fence point test follows the rotated model', () => {
  assert.equal(pointInFootprint(fence, 0, 0, 0, 1.5, 0), true);
  assert.equal(pointInFootprint(fence, 0, 0, 0, 0, 0.5), false);
  assert.equal(pointInFootprint(fence, Math.PI / 2, 0, 0, 1.5, 0), false);
  assert.equal(pointInFootprint(fence, Math.PI / 2, 0, 0, 0, 1.5), true);
  // 45° maps the long axis to (1,-1); the perpendicular diagonal stays outside.
  assert.equal(pointInFootprint(fence, Math.PI / 4, 0, 0, 1, -1), true);
  assert.equal(pointInFootprint(fence, Math.PI / 4, 0, 0, 1, 1), false);
  assert.equal(pointInFootprint(fence, 0, 5, -3, 6.5, -3), true);
});

test('BLD-04: circle-vs-footprint changes when the fence rotates 90°', () => {
  assert.equal(circleTouchesFootprint(fence, 0, 0, 0, 2.1, 0, 0.5), true);
  assert.equal(circleTouchesFootprint(fence, Math.PI / 2, 0, 0, 2.1, 0, 0.5), false);
  assert.equal(circleTouchesFootprint(fence, Math.PI / 2, 0, 0, 0, 2.1, 0.5), true);
  assert.equal(circleTouchesFootprint(fence, 0, 0, 0, 0, 2.1, 0.5), false);
});

test('BLD-04: distance to a rotated box is zero inside and exact outside', () => {
  assert.equal(distanceToFootprint(fence, 0, 0, 0, 0, 0), 0);
  assert.ok(near(distanceToFootprint(fence, 0, 0, 0, 3, 0), 1.3));
  assert.ok(near(distanceToFootprint(fence, 0, 0, 0, 0, 1), 0.8));
  assert.ok(near(distanceToFootprint(fence, Math.PI / 2, 0, 0, 3, 0), 2.8));
  assert.ok(near(distanceToFootprint(fence, Math.PI / 2, 0, 0, 0, 3), 1.3));
  // Diagonal corner measure: (hx+3, hz+4) is exactly 5 away.
  assert.ok(near(distanceToFootprint(fence, 0, 0, 0, 4.7, 4.2), 5));
  assert.ok(near(distanceToFootprint(lantern, 0, 4, 4, 4, 7), 2.6));
});

test('BLD-04: footprint overlap covers box-box, box-circle and circles', () => {
  assert.equal(footprintsOverlap(fence, 0, 0, 0, fence, 0, 0, 0.3), true);
  assert.equal(footprintsOverlap(fence, 0, 0, 0, fence, 0, 0, 0.5), false);
  // Crossing fences intersect at the center, not once the vertical one slides 2m away.
  assert.equal(footprintsOverlap(fence, 0, 0, 0, fence, Math.PI / 2, 0, 0), true);
  assert.equal(footprintsOverlap(fence, 0, 0, 0, fence, Math.PI / 2, 0, 2), false);
  // Box-circle: a lantern 2.05 east overlaps the long fence but not its 90° turn.
  assert.equal(footprintsOverlap(fence, 0, 0, 0, lantern, 0, 2.05, 0), true);
  assert.equal(footprintsOverlap(fence, Math.PI / 2, 0, 0, lantern, 0, 2.05, 0), false);
  assert.equal(footprintsOverlap(lantern, 0, 0, 0, fence, 0, 0, 0.55), true);
  assert.equal(footprintsOverlap(lantern, 0, 0, 0, fence, 0, 0, 0.7), false);
  assert.equal(footprintsOverlap(lantern, 0, 0, 0, lantern, 0, 0.75, 0), true);
  assert.equal(footprintsOverlap(lantern, 0, 0, 0, lantern, 0, 0.85, 0), false);
});

const fenceAt =
  (walls: { x: number; z: number; angle: number }[]) =>
  (x: number, z: number): boolean =>
    walls.some((w) => circleTouchesFootprint(fence, w.angle, w.x, w.z, x, z, 0.22));

test('BLD-05: a closed fence ring around the player is detected', () => {
  const ring = [
    { x: -2.2, z: 0, angle: Math.PI / 2 },
    { x: 2.2, z: 0, angle: Math.PI / 2 },
    { x: 0, z: -2.2, angle: 0 },
    { x: 0, z: 2.2, angle: 0 },
  ];
  const area = { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
  assert.equal(canReach({ x: 0, z: 0 }, { x: 0, z: 3.6 }, area, fenceAt(ring)), false);
  // Removing one wall opens the pocket again.
  assert.equal(canReach({ x: 0, z: 0 }, { x: 0, z: 3.6 }, area, fenceAt(ring.slice(1))), true);
  // A single wall never seals the player in.
  assert.equal(canReach({ x: 0, z: 0 }, { x: 0, z: 3.6 }, area, fenceAt([ring[3]])), true);
});

test('BLD-05: rotating one wall changes which lane stays open', () => {
  const area = { minX: -1.9, maxX: 1.9, minZ: -1.9, maxZ: 4.9 };
  const wall = { x: 0, z: 2.5, angle: 0 };
  assert.equal(canReach({ x: 0, z: 0 }, { x: 0, z: 4.2 }, area, fenceAt([wall])), false);
  assert.equal(
    canReach({ x: 0, z: 0 }, { x: 0, z: 4.2 }, area, fenceAt([{ ...wall, angle: Math.PI / 2 }])),
    true,
  );
});

test('BLD-05: a large tower footprint seals a gap that a lantern walks through', () => {
  // The side walls reach the area edge, so the only opening is the middle.
  const area = { minX: -1.9, maxX: 1.9, minZ: -1.9, maxZ: 1.9 };
  const gap = (footprint: (typeof FOOTPRINTS)[keyof typeof FOOTPRINTS], radius: number) => {
    const blocked = (x: number, z: number): boolean => {
      // Two side walls leave a gap in the middle; the candidate fills it.
      if (circleTouchesFootprint(fence, Math.PI / 2, -1.6, 0, x, z, 0.22)) return true;
      if (circleTouchesFootprint(fence, Math.PI / 2, 1.6, 0, x, z, 0.22)) return true;
      return circleTouchesFootprint(footprint, 0, 0, 0, x, z, radius);
    };
    return canReach({ x: 0, z: -2.4 }, { x: 0, z: 2.4 }, area, blocked);
  };
  assert.equal(gap(FOOTPRINTS.tower, 0.22), false, 'tower blocks the gap');
  assert.equal(gap(FOOTPRINTS.lantern, 0.22), true, 'lantern leaves the gap walkable');
});
