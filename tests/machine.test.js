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

test('campaign starts in day.outdoor with machine and rules in sync', () => {
  const actor = startCampaign();
  const snap = actor.getSnapshot();
  assert.equal(phaseValue(snap), 'day');
  assert.equal(isInterior(snap), false);
  assert.equal(overlayValue(snap), 'none');
  assert.equal(snap.context.phase, 'day');
  assertPhaseSync(snap);
  actor.stop();
});

test('START_NIGHT enters night and resets the day clock through rules', () => {
  const s = newGame();
  const starts = [];
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

test('START_NIGHT is rejected inside the RV, while paused, with a pending perk, or after the run ended', () => {
  let actor = startCampaign();
  actor.send({ type: 'ENTER_RV' });
  assert.equal(isInterior(actor.getSnapshot()), true);
  actor.send({ type: 'START_NIGHT' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day');
  assert.equal(actor.getSnapshot().context.phase, 'day');
  actor.stop();

  actor = startCampaign();
  actor.send({ type: 'PAUSE' });
  actor.send({ type: 'START_NIGHT' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day');
  assert.equal(
    actor.getSnapshot().context.phase,
    'day',
    'rules phase untouched when the transition is rejected',
  );
  actor.stop();

  actor = startCampaign();
  actor.getSnapshot().context.perkPending = true;
  actor.send({ type: 'START_NIGHT' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day');
  actor.stop();

  actor = startCampaign();
  damageCamp(actor.getSnapshot().context, 100);
  actor.send({ type: 'START_NIGHT' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day');
  assert.equal(actor.getSnapshot().context.over, true);
  actor.stop();
});

test('clearing a night enters dawn, then CHOOSE_PERK advances the day through rules', () => {
  const s = newGame();
  const dawns = [],
    perks = [];
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

  actor.send({ type: 'CHOOSE_PERK', perkId: 'unknown' });
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
  const victories = [];
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
  const defeats = [];
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

test('defeat also works mid-night', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  actor.send({ type: 'START_NIGHT' });
  damageCamp(s, 100);
  actor.send({ type: 'CAMP_DESTROYED' });
  assert.equal(phaseValue(actor.getSnapshot()), 'defeat');
  assertPhaseSync(actor.getSnapshot());
  actor.stop();
});

test('the RV opens only during a running day and exits back outside', () => {
  const actor = startCampaign({ state: newGame() });
  actor.send({ type: 'ENTER_RV' });
  assert.equal(isInterior(actor.getSnapshot()), true);
  assert.equal(actor.getSnapshot().context.phase, 'day');
  actor.send({ type: 'EXIT_RV' });
  assert.equal(isInterior(actor.getSnapshot()), false);

  actor.send({ type: 'START_NIGHT' });
  actor.send({ type: 'ENTER_RV' });
  assert.equal(phaseValue(actor.getSnapshot()), 'night', 'night blocks the RV');

  actor.send({ type: 'CLEARED' });
  actor.send({ type: 'CHOOSE_PERK', perkId: 'marksman' });
  actor.send({ type: 'PAUSE' });
  actor.send({ type: 'ENTER_RV' });
  assert.equal(phaseValue(actor.getSnapshot()), 'day', 'pause blocks the RV');
  assert.equal(isInterior(actor.getSnapshot()), false);
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

test('a full campaign runs five days and ends in victory with machine and rules in sync', () => {
  const s = newGame();
  const actor = startCampaign({ state: s });
  const perkIds = Object.keys(PERKS);
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
