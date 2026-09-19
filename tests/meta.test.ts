import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { dawnRating } from '../src/rules.js';

test('a clean fast night earns the top grade', () => {
  const rating = dawnRating({ campLost: 0, downs: 0, buildingsLost: 0, nightSeconds: 40 });
  assert.equal(rating.grade, 'S');
  assert.equal(rating.score, 100, 'fast bonus is capped at a perfect score');
});

test('a clean but slow night still loses points', () => {
  const rating = dawnRating({ campLost: 0, downs: 0, buildingsLost: 0, nightSeconds: 150 });
  assert.equal(rating.grade, 'B');
  assert.ok(rating.score < 100 && rating.score >= 60);
});

test('leaks, downs and lost buildings each cost score', () => {
  const clean = dawnRating({ nightSeconds: 70 });
  const camp = dawnRating({ campLost: 20, nightSeconds: 70 });
  const down = dawnRating({ downs: 2, nightSeconds: 70 });
  const lost = dawnRating({ buildingsLost: 2, nightSeconds: 70 });
  assert.ok(camp.score < clean.score && down.score < clean.score && lost.score < clean.score);
  assert.equal(dawnRating({ campLost: 20, nightSeconds: 70 }).score, 70);
  assert.equal(down.score, 84);
  assert.equal(lost.score, 88);
});

test('a disaster night floors at zero instead of going negative', () => {
  const rating = dawnRating({ campLost: 100, downs: 9, buildingsLost: 6, nightSeconds: 300 });
  assert.equal(rating.score, 0);
  assert.equal(rating.grade, 'C');
  assert.ok(['S', 'A', 'B', 'C'].includes(dawnRating().grade), 'missing summary stays gradeable');
});
