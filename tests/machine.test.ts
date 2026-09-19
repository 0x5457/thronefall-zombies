import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import {
  startCampaign,
  phaseValue,
  overlayValue,
  isInterior,
  assertPhaseSync,
  perkAvailable,
} from '../src/machine.js';
import { PERKS, WAVES, choosePerk, damageCamp, newGame } from '../src/rules.js';
import type { PerkId } from '../src/rules.js';

test('START_NIGHT enters night and resets the day clock through rules', () => {
  const s = newGame();
  const starts: { day: number; phase: string }[] = [];
  const actor = startCampaign({
    state: s,
    onNightStart: (state) => starts.push({ day: state.day, phase: state.phase }),
  });
  s.elapsed = 90;
  actor.send({ type: 'START_NIGHT' });
  const snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'night');
  assert.equal(s.phase, 'night');
  assert.equal(s.elapsed, 0, 'rules.advance owns the clock reset');
  assert.deepEqual(
    starts,
    [{ day: 1, phase: 'night' }],
    'scene hook runs after the rules mutation',
  );
  assertPhaseSync(snap);
  actor.stop();
});

test('clearing a night enters dawn, then CHOOSE_PERK advances the day through rules', () => {
  const s = newGame();
  const dawns: number[] = [],
    perks: [number, string][] = [];
  const actor = startCampaign({
    state: s,
    onDawn: (state) => dawns.push(state.day),
    onPerkChosen: (state, id) => perks.push([state.day, id]),
  });
  actor.send({ type: 'START_NIGHT' });
  actor.send({ type: 'CLEARED' });
  let snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'dawn');
  assert.equal(s.day, 2);
  assert.equal(s.perkPending, true);
  assert.equal(s.paused, true, 'dawn freezes the preparation clock');
  assert.deepEqual(dawns, [2]);
  assertPhaseSync(snap);

  actor.send({ type: 'CHOOSE_PERK', perkId: 'unknown' as PerkId });
  assert.equal(phaseValue(actor.getSnapshot()), 'dawn', 'unknown perk id is rejected');
  actor.send({ type: 'CHOOSE_PERK', perkId: 'marksman' });
  snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'day');
  assert.equal(isInterior(snap), false);
  assert.deepEqual(s.perks, ['marksman']);
  assert.equal(s.perkPending, false);
  assert.equal(s.paused, false, 'choosing the perk resumes preparation');
  assert.deepEqual(perks, [[2, 'marksman']]);
  assertPhaseSync(snap);

  actor.send({ type: 'CHOOSE_PERK', perkId: 'engineer' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day', 'perk cannot be chosen twice');
  actor.stop();
});

test('CLEARED stays in night until the injected scene state says the wave is empty', () => {
  let empty = false;
  const actor = startCampaign({ state: newGame(), canClear: () => empty });
  actor.send({ type: 'START_NIGHT' });
  actor.send({ type: 'CLEARED' });
  assert.equal(phaseValue(actor.getSnapshot()), 'night');
  empty = true;
  actor.send({ type: 'CLEARED' });
  assert.equal(phaseValue(actor.getSnapshot()), 'dawn');
  actor.stop();
});

test('clearing the fifth night ends in victory with won and over set', () => {
  const s = newGame();
  s.day = WAVES.length;
  const victories: boolean[] = [];
  const actor = startCampaign({ state: s, onVictory: (state) => victories.push(state.won) });
  actor.send({ type: 'START_NIGHT' });
  actor.send({ type: 'CLEARED' });
  const snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'victory');
  assert.equal(s.won, true);
  assert.equal(s.over, true);
  assert.deepEqual(victories, [true]);
  assertPhaseSync(snap);
  actor.stop();
});

test('CAMP_DESTROYED only ends the run when the camp is actually down', () => {
  const s = newGame();
  const defeats: number[] = [];
  const actor = startCampaign({ state: s, onDefeat: (state) => defeats.push(state.day) });
  actor.send({ type: 'CAMP_DESTROYED' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day', 'a healthy camp ignores the event');
  damageCamp(s, 100);
  actor.send({ type: 'CAMP_DESTROYED' });
  assert.equal(phaseValue(actor.getSnapshot()), 'defeat');
  assert.deepEqual(defeats, [1]);
  assertPhaseSync(actor.getSnapshot());
  actor.stop();
});

test('pause and dialogs restore the correct pause state', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  actor.send({ type: 'PAUSE' });
  assert.equal(overlayValue(actor.getSnapshot()), 'paused');
  assert.equal(s.paused, true);
  assert.equal(s.manualPause, true);
  actor.send({ type: 'PAUSE' });
  assert.equal(overlayValue(actor.getSnapshot()), 'none', 'P toggles a manual pause off');
  assert.equal(s.paused, false);

  actor.send({ type: 'OPEN_HELP' });
  assert.equal(overlayValue(actor.getSnapshot()), 'help');
  assert.equal(s.paused, true, 'a dialog freezes rules through state.paused');
  actor.send({ type: 'CLOSE_HELP' });
  assert.equal(overlayValue(actor.getSnapshot()), 'none');
  assert.equal(s.paused, false, 'closing help without a manual pause resumes play');

  actor.send({ type: 'PAUSE' });
  actor.send({ type: 'OPEN_HELP' });
  actor.send({ type: 'CLOSE_HELP' });
  assert.equal(overlayValue(actor.getSnapshot()), 'paused', 'closing help keeps a manual pause');
  assert.equal(s.paused, true);
  actor.send({ type: 'RESUME' });
  assert.equal(overlayValue(actor.getSnapshot()), 'none');
  assert.equal(s.paused, false);
  assert.equal(s.manualPause, false);
  actor.stop();
});

test('OPEN_CONFIRM opens the pre-night briefing and freezes the day', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  s.elapsed = 151;
  actor.send({ type: 'OPEN_CONFIRM' });
  const snap = actor.getSnapshot();
  assert.equal(overlayValue(snap), 'confirm');
  assert.equal(s.paused, true, 'the briefing freezes the preparation clock');
  assert.equal(s.phase, 'day', 'confirming does not commit the night yet');
  assert.equal(s.elapsed, 151, 'opening the briefing does not touch the clock');
  actor.stop();
});

test('CLOSE_CONFIRM returns to the day; CONFIRM_NIGHT is only legal inside the briefing', () => {
  const s = newGame();
  const starts: number[] = [];
  const actor = startCampaign({ state: s, onNightStart: (state) => starts.push(state.day) });
  s.elapsed = 151;
  actor.send({ type: 'CONFIRM_NIGHT' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day', 'no night without the confirm overlay');
  assert.equal(s.phase, 'day');

  actor.send({ type: 'OPEN_CONFIRM' });
  actor.send({ type: 'CLOSE_CONFIRM' });
  let snap = actor.getSnapshot();
  assert.equal(overlayValue(snap), 'none');
  assert.equal(s.paused, false, 'returning to day resumes time and input');
  assert.equal(s.elapsed, 151, 'the day keeps its progress after cancelling');
  assert.equal(s.phase, 'day');
  assert.deepEqual(starts, []);

  actor.send({ type: 'OPEN_CONFIRM' });
  actor.send({ type: 'CONFIRM_NIGHT' });
  snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'night');
  assert.equal(overlayValue(snap), 'none', 'confirming closes the overlay');
  assert.equal(s.phase, 'night');
  assert.equal(s.paused, false);
  assert.equal(s.elapsed, 0, 'rules.advance resets the clock');
  assert.deepEqual(starts, [1], 'the scene night hook runs exactly once');
  assertPhaseSync(snap);
  actor.stop();
});

test('OPEN_CONFIRM is rejected once the run is over', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  damageCamp(s, 100);
  actor.send({ type: 'CAMP_DESTROYED' });
  actor.send({ type: 'OPEN_CONFIRM' });
  assert.equal(overlayValue(actor.getSnapshot()), 'none');
  assert.equal(phaseValue(actor.getSnapshot()), 'defeat');
  actor.stop();
});

test('a full campaign runs five days and ends in victory with machine and rules in sync', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  const perkIds = Object.keys(PERKS) as PerkId[];
  for (let day = 1; day <= WAVES.length; day++) {
    assert.equal(s.day, day);
    actor.send({ type: 'START_NIGHT' });
    assertPhaseSync(actor.getSnapshot());
    actor.send({ type: 'CLEARED' });
    if (day < WAVES.length) {
      assertPhaseSync(actor.getSnapshot());
      assert.equal(phaseValue(actor.getSnapshot()), 'dawn');
      actor.send({ type: 'CHOOSE_PERK', perkId: perkIds[day - 1] });
      assertPhaseSync(actor.getSnapshot());
      assert.equal(phaseValue(actor.getSnapshot()), 'day');
    }
  }
  assert.equal(phaseValue(actor.getSnapshot()), 'victory');
  assert.equal(s.won, true);
  assert.equal(s.over, true);
  assert.equal(s.day, WAVES.length);
  assert.equal(s.perks.length, WAVES.length - 1);
  actor.stop();
});

test('perkAvailable agrees with rules.choosePerk for every perk and a bogus id', () => {
  const base = newGame();
  base.perkPending = true;
  const clone = () => ({ ...base, perks: [...base.perks] });
  for (const id of [...Object.keys(PERKS), 'nope']) {
    const machineView = clone(),
      rulesView = clone();
    assert.equal(perkAvailable(machineView, id), choosePerk(rulesView, id), `agreement for ${id}`);
  }
  base.perkPending = false;
  assert.equal(perkAvailable(base, 'marksman'), false, 'no perk choice without a pending dawn');
});
