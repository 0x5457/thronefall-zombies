import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  TRACKS,
  MUSIC_LAYERS,
  musicStep,
  musicScene,
  threatLevel,
  loadAudioSettings,
} from '../src/audio.js';
import type { AudioStorage, MusicScene, ScoreBus, Synth, SynthWave } from '../src/audio.js';

// Test double: the stubbed bus passes layer names where a real AudioNode would go.
type PlayArgs = [
  layer: string,
  wave: SynthWave,
  hz: number,
  at: number,
  duration: number,
  gain: number,
  endFrequency?: number,
  attack?: number,
  sustain?: boolean,
  detune?: number,
];

test('day/night arrangements contain seven finite, independently routed parts and staggered entries', () => {
  for (const phase of Object.keys(TRACKS) as MusicScene[]) {
    const events: PlayArgs[] = [],
      bus = Object.fromEntries(MUSIC_LAYERS.map((n) => [n, n])) as unknown as ScoreBus;
    const synth = { play: (...args: PlayArgs) => events.push(args) } as unknown as Synth;
    for (let step = 0; step < 256; step++)
      musicStep(synth, bus, phase, step, (step * 30) / TRACKS[phase].bpm);
    const byName = (a: string, b: string) => a.localeCompare(b);
    assert.deepEqual(
      [...new Set(events.map((e) => e[0]))].sort(byName),
      MUSIC_LAYERS.filter((n) => phase !== 'interior' || n !== 'drums').sort(byName),
    );
    for (const [, , hz, at, duration, gain] of events) {
      assert.ok([hz, at, duration, gain].every(Number.isFinite));
      assert.ok(hz > 0 && at >= 0 && duration > 0 && gain > 0 && gain < 0.2);
    }
    assert.ok(events.find((e) => e[0] === 'counter')![3] >= (16 * 30) / TRACKS[phase].bpm);
    assert.ok(events.filter((e) => e[0] === 'pad').every((e) => e[7] === 0.12 && e[8] === true));
    assert.equal(TRACKS[phase].melody.length, 16);
    assert.ok(TRACKS[phase].melody.every((row) => row.length === 8));
    assert.ok(
      events.some((e) => e[3] > (192 * 30) / TRACKS[phase].bpm),
      'full reprise scheduled',
    );
  }
});
test('nearby live enemies drive tension; high tension adds bounded musical layers', () => {
  const enemy = (x: number, alive = true) => ({ alive, mesh: { position: { x, z: 0 } } });
  assert.equal(threatLevel([enemy(30), enemy(0, false)], 0, 0), 0);
  assert.equal(
    threatLevel(
      Array.from({ length: 8 }, () => enemy(0)),
      0,
      0,
    ),
    1,
  );
  assert.equal(threatLevel([enemy(9)], 0, 0), 0.125);
  const render = (phase: MusicScene, tension: number) => {
    const events: PlayArgs[] = [];
    musicStep(
      { play: (...e: PlayArgs) => events.push(e) } as unknown as Synth,
      Object.fromEntries(MUSIC_LAYERS.map((n) => [n, n])) as unknown as ScoreBus,
      phase,
      0,
      0,
      tension,
    );
    return events;
  };
  assert.ok(render('night', 1).length > render('night', 0).length);
  assert.deepEqual(render('day', 1), render('day', 0));
});
test('entering and leaving a room selects music without changing campaign state', () => {
  const game = { phase: 'day' } as const;
  assert.equal(musicScene(game, true), 'interior');
  assert.equal(musicScene(game, false), 'day');
  assert.equal(musicScene({ phase: 'night' }, false), 'night');
  assert.equal(game.phase, 'day');
});
test('audio settings tolerate denied storage, corrupt data and invalid values', () => {
  assert.equal(
    loadAudioSettings({
      getItem() {
        throw Error();
      },
    } as unknown as AudioStorage).enabled,
    true,
  );
  assert.equal(
    loadAudioSettings({ getItem: () => '{broken' } as unknown as AudioStorage).master,
    0.65,
  );
  assert.deepEqual(
    loadAudioSettings({
      getItem: () => JSON.stringify({ enabled: false, master: 2, music: -1, sfx: 'loud' }),
    } as unknown as AudioStorage),
    { enabled: false, master: 1, music: 0, sfx: 0.8 },
  );
});
