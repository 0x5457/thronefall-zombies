import { test } from 'vite-plus/test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { getAdjacencyMap, serializeSnapshot, toDirectedGraph } from '@xstate/graph';
import type { DirectedGraphNode } from '@xstate/graph';
import { createCampaignMachine, isInterior, overlayValue, phaseValue } from '../src/machine.js';
import type { CampaignEvent, CampaignOptions } from '../src/machine.js';
import { WAVES, newGame } from '../src/rules.js';

type Sender = { send: (event: CampaignEvent) => void };
type CampaignSnapshot = SnapshotFrom<ReturnType<typeof createCampaignMachine>>;

interface Scenario {
  name: string;
  options: () => CampaignOptions;
  drive?: (actor: Sender) => void;
  expected: Record<string, string>;
}

const allEvents: CampaignEvent[] = [
  { type: 'ENTER_RV' },
  { type: 'EXIT_RV' },
  { type: 'START_NIGHT' },
  { type: 'CLEARED' },
  { type: 'CHOOSE_PERK', perkId: 'marksman' },
  { type: 'PAUSE' },
  { type: 'RESUME' },
  { type: 'OPEN_HELP' },
  { type: 'CLOSE_HELP' },
  { type: 'OPEN_MANUAL' },
  { type: 'CLOSE_MANUAL' },
  { type: 'OPEN_CONFIRM' },
  { type: 'CLOSE_CONFIRM' },
  { type: 'CONFIRM_NIGHT' },
  { type: 'CAMP_DESTROYED' },
];

const scenarios: Scenario[] = [
  {
    name: 'new campaign',
    options: () => ({}),
    expected: {
      ENTER_RV: 'day.interior/none',
      EXIT_RV: 'day/none',
      START_NIGHT: 'night/none',
      CLEARED: 'day/none',
      CHOOSE_PERK: 'day/none',
      PAUSE: 'day/paused',
      RESUME: 'day/none',
      OPEN_HELP: 'day/help',
      CLOSE_HELP: 'day/none',
      OPEN_MANUAL: 'day/manual',
      CLOSE_MANUAL: 'day/none',
      OPEN_CONFIRM: 'day/confirm',
      CLOSE_CONFIRM: 'day/none',
      CONFIRM_NIGHT: 'day/none',
      CAMP_DESTROYED: 'day/none',
    },
  },
  {
    name: 'inside the RV',
    options: () => ({}),
    drive: (a) => a.send({ type: 'ENTER_RV' }),
    expected: {
      ENTER_RV: 'day.interior/none',
      EXIT_RV: 'day/none',
      START_NIGHT: 'day.interior/none',
      CLEARED: 'day.interior/none',
      CHOOSE_PERK: 'day.interior/none',
      PAUSE: 'day.interior/paused',
      RESUME: 'day.interior/none',
      OPEN_HELP: 'day.interior/help',
      CLOSE_HELP: 'day.interior/none',
      OPEN_MANUAL: 'day.interior/manual',
      CLOSE_MANUAL: 'day.interior/none',
      OPEN_CONFIRM: 'day.interior/none',
      CLOSE_CONFIRM: 'day.interior/none',
      CONFIRM_NIGHT: 'day.interior/none',
      CAMP_DESTROYED: 'day.interior/none',
    },
  },
  {
    name: 'manual pause',
    options: () => ({}),
    drive: (a) => a.send({ type: 'PAUSE' }),
    expected: {
      ENTER_RV: 'day/paused',
      EXIT_RV: 'day/paused',
      START_NIGHT: 'day/paused',
      CLEARED: 'day/paused',
      CHOOSE_PERK: 'day/paused',
      PAUSE: 'day/none',
      RESUME: 'day/none',
      OPEN_HELP: 'day/help',
      CLOSE_HELP: 'day/paused',
      OPEN_MANUAL: 'day/manual',
      CLOSE_MANUAL: 'day/paused',
      OPEN_CONFIRM: 'day/paused',
      CLOSE_CONFIRM: 'day/paused',
      CONFIRM_NIGHT: 'day/paused',
      CAMP_DESTROYED: 'day/paused',
    },
  },
  {
    name: 'night',
    options: () => ({}),
    drive: (a) => a.send({ type: 'START_NIGHT' }),
    expected: {
      ENTER_RV: 'night/none',
      EXIT_RV: 'night/none',
      START_NIGHT: 'night/none',
      CLEARED: 'dawn/none',
      CHOOSE_PERK: 'night/none',
      PAUSE: 'night/paused',
      RESUME: 'night/none',
      OPEN_HELP: 'night/help',
      CLOSE_HELP: 'night/none',
      OPEN_MANUAL: 'night/manual',
      CLOSE_MANUAL: 'night/none',
      OPEN_CONFIRM: 'night/none',
      CLOSE_CONFIRM: 'night/none',
      CONFIRM_NIGHT: 'night/none',
      CAMP_DESTROYED: 'night/none',
    },
  },
  {
    name: 'dawn',
    options: () => ({}),
    drive: (a) => {
      a.send({ type: 'START_NIGHT' });
      a.send({ type: 'CLEARED' });
    },
    expected: {
      ENTER_RV: 'dawn/none',
      EXIT_RV: 'dawn/none',
      START_NIGHT: 'dawn/none',
      CLEARED: 'dawn/none',
      CHOOSE_PERK: 'day/none',
      PAUSE: 'dawn/paused',
      RESUME: 'dawn/none',
      OPEN_HELP: 'dawn/help',
      CLOSE_HELP: 'dawn/none',
      OPEN_MANUAL: 'dawn/manual',
      CLOSE_MANUAL: 'dawn/none',
      OPEN_CONFIRM: 'dawn/none',
      CLOSE_CONFIRM: 'dawn/none',
      CONFIRM_NIGHT: 'dawn/none',
      CAMP_DESTROYED: 'dawn/none',
    },
  },
  {
    name: 'final day clear',
    options: () => {
      const state = newGame();
      state.day = WAVES.length;
      return { state };
    },
    drive: (a) => {
      a.send({ type: 'START_NIGHT' });
      a.send({ type: 'CLEARED' });
    },
    expected: {
      ENTER_RV: 'victory/none',
      EXIT_RV: 'victory/none',
      START_NIGHT: 'victory/none',
      CLEARED: 'victory/none',
      CHOOSE_PERK: 'victory/none',
      PAUSE: 'victory/none',
      RESUME: 'victory/none',
      OPEN_HELP: 'victory/none',
      CLOSE_HELP: 'victory/none',
      OPEN_MANUAL: 'victory/none',
      CLOSE_MANUAL: 'victory/none',
      OPEN_CONFIRM: 'victory/none',
      CLOSE_CONFIRM: 'victory/none',
      CONFIRM_NIGHT: 'victory/none',
      CAMP_DESTROYED: 'victory/none',
    },
  },
  {
    name: 'day with the camp down',
    options: () => {
      const state = newGame();
      state.health = 0;
      return { state };
    },
    expected: {
      ENTER_RV: 'day.interior/none',
      EXIT_RV: 'day/none',
      START_NIGHT: 'night/none',
      CLEARED: 'day/none',
      CHOOSE_PERK: 'day/none',
      PAUSE: 'day/paused',
      RESUME: 'day/none',
      OPEN_HELP: 'day/help',
      CLOSE_HELP: 'day/none',
      OPEN_MANUAL: 'day/manual',
      CLOSE_MANUAL: 'day/none',
      OPEN_CONFIRM: 'day/confirm',
      CLOSE_CONFIRM: 'day/none',
      CONFIRM_NIGHT: 'day/none',
      CAMP_DESTROYED: 'defeat/none',
    },
  },
  {
    name: 'night with the camp down',
    options: () => {
      const state = newGame();
      state.health = 0;
      return { state };
    },
    drive: (a) => a.send({ type: 'START_NIGHT' }),
    expected: {
      ENTER_RV: 'night/none',
      EXIT_RV: 'night/none',
      START_NIGHT: 'night/none',
      CLEARED: 'dawn/none',
      CHOOSE_PERK: 'night/none',
      PAUSE: 'night/paused',
      RESUME: 'night/none',
      OPEN_HELP: 'night/help',
      CLOSE_HELP: 'night/none',
      OPEN_MANUAL: 'night/manual',
      CLOSE_MANUAL: 'night/none',
      OPEN_CONFIRM: 'night/none',
      CLOSE_CONFIRM: 'night/none',
      CONFIRM_NIGHT: 'night/none',
      CAMP_DESTROYED: 'defeat/none',
    },
  },
  {
    name: 'day with a pending perk',
    options: () => {
      const state = newGame();
      state.perkPending = true;
      return { state };
    },
    expected: {
      ENTER_RV: 'day.interior/none',
      EXIT_RV: 'day/none',
      START_NIGHT: 'day/none',
      CLEARED: 'day/none',
      CHOOSE_PERK: 'day/none',
      PAUSE: 'day/paused',
      RESUME: 'day/none',
      OPEN_HELP: 'day/help',
      CLOSE_HELP: 'day/none',
      OPEN_MANUAL: 'day/manual',
      CLOSE_MANUAL: 'day/none',
      OPEN_CONFIRM: 'day/none',
      CLOSE_CONFIRM: 'day/none',
      CONFIRM_NIGHT: 'day/none',
      CAMP_DESTROYED: 'day/none',
    },
  },
  {
    name: 'night confirmation',
    options: () => ({}),
    drive: (a) => a.send({ type: 'OPEN_CONFIRM' }),
    expected: {
      ENTER_RV: 'day/confirm',
      EXIT_RV: 'day/confirm',
      START_NIGHT: 'day/confirm',
      CLEARED: 'day/confirm',
      CHOOSE_PERK: 'day/confirm',
      PAUSE: 'day/confirm',
      RESUME: 'day/confirm',
      OPEN_HELP: 'day/confirm',
      CLOSE_HELP: 'day/confirm',
      OPEN_MANUAL: 'day/confirm',
      CLOSE_MANUAL: 'day/confirm',
      OPEN_CONFIRM: 'day/confirm',
      CLOSE_CONFIRM: 'day/none',
      CONFIRM_NIGHT: 'night/none',
      CAMP_DESTROYED: 'day/confirm',
    },
  },
];

function runScenario(scenario: Scenario) {
  const machine = createCampaignMachine(scenario.options());
  const actor = createActor(machine);
  actor.start();
  scenario.drive?.(actor);
  return { machine, actor };
}

function describe(snapshot: CampaignSnapshot): string {
  return `${phaseValue(snapshot)}${isInterior(snapshot) ? '.interior' : ''}/${overlayValue(snapshot)}`;
}

function edgeSummary(node: DirectedGraphNode): string[] {
  return node.edges.map((edge) => `${edge.label.text} -> ${edge.target.id}`);
}

test('toDirectedGraph keeps the phase/overlay structure of the campaign explicit', () => {
  const graph = toDirectedGraph(createCampaignMachine({ state: newGame() }));
  const tree = new Map<string, string[]>();
  const walk = (node: DirectedGraphNode): void => {
    tree.set(node.id, edgeSummary(node));
    node.children.forEach(walk);
  };
  walk(graph);

  assert.deepEqual(
    [...tree.keys()],
    [
      'campaign',
      'campaign.phase',
      'campaign.phase.day',
      'campaign.phase.day.outdoor',
      'campaign.phase.day.interior',
      'campaign.phase.night',
      'campaign.phase.dawn',
      'campaign.phase.victory',
      'campaign.phase.defeat',
      'campaign.overlay',
      'campaign.overlay.none',
      'campaign.overlay.paused',
      'campaign.overlay.help',
      'campaign.overlay.manual',
      'campaign.overlay.confirm',
    ],
    'every phase and overlay state stays part of the graph',
  );
  assert.deepEqual(tree.get('campaign'), ['CAMP_DESTROYED -> campaign.phase.defeat']);
  assert.deepEqual(tree.get('campaign.phase.day.outdoor'), [
    'ENTER_RV -> campaign.phase.day.interior',
    'START_NIGHT -> campaign.phase.night',
    'OPEN_CONFIRM -> campaign.overlay.confirm',
  ]);
  assert.deepEqual(tree.get('campaign.phase.day.interior'), [
    'EXIT_RV -> campaign.phase.day.outdoor',
  ]);
  assert.deepEqual(tree.get('campaign.phase.night'), [
    'CLEARED -> campaign.phase.victory',
    'CLEARED -> campaign.phase.dawn',
  ]);
  assert.deepEqual(tree.get('campaign.phase.dawn'), ['CHOOSE_PERK -> campaign.phase.day']);
  assert.deepEqual(tree.get('campaign.overlay.help'), [
    'CLOSE_HELP -> campaign.overlay.paused',
    'CLOSE_HELP -> campaign.overlay.none',
  ]);
  assert.deepEqual(tree.get('campaign.overlay.confirm'), [
    'CLOSE_CONFIRM -> campaign.overlay.paused',
    'CLOSE_CONFIRM -> campaign.overlay.none',
    'CONFIRM_NIGHT -> campaign.phase.night',
  ]);
  assert.deepEqual(tree.get('campaign.phase.victory'), []);
  assert.deepEqual(tree.get('campaign.phase.defeat'), []);
});

test('every event from every scenario state lands where the graph model says', () => {
  for (const scenario of scenarios) {
    const { machine, actor } = runScenario(scenario);
    const snapshot = actor.getSnapshot();
    const entry = getAdjacencyMap(machine, { fromState: snapshot, events: allEvents })[
      serializeSnapshot(snapshot)
    ];
    assert.ok(entry, `${scenario.name}: adjacency contains the starting snapshot`);

    const actual = Object.fromEntries(
      Object.values(entry.transitions).map(({ event, state: predicted }) => [
        event.type,
        describe(predicted),
      ]),
    );
    assert.deepEqual(actual, scenario.expected, `${scenario.name}: ${describe(snapshot)}`);

    for (const { event } of Object.values(entry.transitions)) {
      const replay = runScenario(scenario);
      replay.actor.send(event);
      assert.equal(
        describe(replay.actor.getSnapshot()),
        actual[event.type],
        `${scenario.name}: ${event.type} must also land there at runtime`,
      );
      replay.actor.stop();
    }
    actor.stop();
  }
});
