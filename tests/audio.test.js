import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, MUSIC_LAYERS, musicStep, musicScene, threatLevel, loadAudioSettings } from '../src/audio.js';

test('day/night arrangements contain seven finite, independently routed parts and staggered entries', () => {
  for (const phase of Object.keys(TRACKS)) {
    const events = [], bus = Object.fromEntries(MUSIC_LAYERS.map(n => [n,n]));
    const synth = { play: (...args) => events.push(args) };
    for (let step = 0; step < 256; step++) musicStep(synth, bus, phase, step, step * 30 / TRACKS[phase].bpm);
    const byName = (a, b) => a.localeCompare(b);
    assert.deepEqual([...new Set(events.map(e => e[0]))].sort(byName), MUSIC_LAYERS.filter(n => phase !== 'interior' || n !== 'drums').sort(byName));
    for (const [, , hz, at, duration, gain] of events) {
      assert.ok([hz,at,duration,gain].every(Number.isFinite));
      assert.ok(hz > 0 && at >= 0 && duration > 0 && gain > 0 && gain < .2);
    }
    assert.ok(events.find(e => e[0] === 'counter')[3] >= 16 * 30 / TRACKS[phase].bpm);
    assert.ok(events.filter(e => e[0] === 'pad').every(e => e[7] === .12 && e[8] === true));
    assert.equal(TRACKS[phase].melody.length, 16);
    assert.ok(TRACKS[phase].melody.every(row => row.length === 8));
    assert.ok(events.some(e => e[3] > 192 * 30 / TRACKS[phase].bpm), 'full reprise scheduled');
  }
});
test('nearby live enemies drive tension; high tension adds bounded musical layers', () => {
  const enemy = (x, alive = true) => ({ alive, mesh: { position: { x, z: 0 } } });
  assert.equal(threatLevel([enemy(30), enemy(0, false)], 0, 0), 0);
  assert.equal(threatLevel(Array.from({ length: 8 }, () => enemy(0)), 0, 0), 1);
  assert.equal(threatLevel([enemy(9)], 0, 0), .125);
  const render = (phase, tension) => {
    const events = []; musicStep({ play: (...e) => events.push(e) }, Object.fromEntries(MUSIC_LAYERS.map(n => [n,n])), phase, 0, 0, tension); return events;
  };
  assert.ok(render('night', 1).length > render('night', 0).length);
  assert.deepEqual(render('day', 1), render('day', 0));
});
test('entering and leaving a room selects music without changing campaign state', () => {
  const game = { phase: 'day' };
  assert.equal(musicScene(game, true), 'interior');
  assert.equal(musicScene(game, false), 'day');
  assert.equal(musicScene({ phase: 'night' }, false), 'night');
  assert.equal(game.phase, 'day');
});
test('audio settings tolerate denied storage, corrupt data and invalid values', () => {
  assert.equal(loadAudioSettings({ getItem() { throw Error(); } }).enabled, true);
  assert.equal(loadAudioSettings({ getItem: () => '{broken' }).master, .65);
  assert.deepEqual(loadAudioSettings({ getItem: () => JSON.stringify({ enabled:false, master:2, music:-1, sfx:'loud' }) }), { enabled:false, master:1, music:0, sfx:.8 });
});
