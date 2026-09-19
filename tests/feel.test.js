import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrauma, createHitStop, easeOutBack, hitStopFor, killTraumaFor, clamp01 } from '../src/feel.js';

test('trauma decays back to rest and square response keeps small hits subtle', () => {
  const trauma = createTrauma({ decay: 2 });
  trauma.add(.1);
  const small = trauma.update(.01);
  trauma.add(1); trauma.add(1);
  assert.equal(trauma.value, 1, 'adds clamp at 1');
  const big = trauma.update(.001);
  assert.ok(Math.abs(big.x) > Math.abs(small.x) * 5, 'large hits move much more than small ones');
  trauma.update(.5);
  assert.equal(trauma.value, 0, 'decays to zero');
  const rest = trauma.update(.016);
  assert.ok([rest.x, rest.z, rest.zoom, rest.roll].every(value => Math.abs(value) < 1e-9), 'returns to rest offsets');
  assert.equal(trauma.frames, 2, 'only frames with shake count');
});

test('hit-stop always resumes using real time', () => {
  const stop = createHitStop(.1);
  assert.equal(stop.update(.016), 1);
  stop.trigger(.04);
  assert.equal(stop.active, true);
  let scale = 1, elapsed = 0;
  while (stop.active && elapsed < 1) { scale = stop.update(.02); elapsed += .02; }
  assert.equal(scale, .1);
  assert.equal(elapsed, .04, 'stop lasts its real-time duration');
  assert.equal(stop.update(.016), 1, 'resumes at normal speed');
  assert.equal(stop.count, 1);
});

test('hit-stop tiers scale with enemy weight', () => {
  assert.ok(hitStopFor(5) < hitStopFor(20));
  assert.ok(hitStopFor(20) < hitStopFor(130));
  assert.ok(killTraumaFor(130) > killTraumaFor(20));
  assert.ok(killTraumaFor(20) > killTraumaFor(5));
});

test('easeOutBack overshoots briefly then lands exactly on 1', () => {
  assert.ok(Math.abs(easeOutBack(0)) < 1e-9);
  assert.equal(easeOutBack(1), 1);
  let peak = 0;
  for (let x = 0; x <= 1; x += .01) peak = Math.max(peak, easeOutBack(x));
  assert.ok(peak > 1.05 && peak < 1.2, `overshoot peak was ${peak}`);
  assert.equal(clamp01(1.4), 1);
  assert.equal(clamp01(-.2), 0);
});
