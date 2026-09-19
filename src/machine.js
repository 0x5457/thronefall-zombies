// Campaign phase machine (ARC-01). Owns legal transitions between day/night/dawn/RV/pause.
// The rules state object from `rules.js` is the context: rules functions stay the only numbers
// source and the machine is the only writer of `state.phase` / `state.paused`. No Three.js here.
import { createActor, setup } from 'xstate';
import { PERKS, WAVES, active, advance, choosePerk, dayReady, newGame } from './rules.js';

const noop = () => {};

export function perkAvailable(s, id) {
  return (
    !s.over &&
    s.phase === 'day' &&
    s.perkPending &&
    Object.hasOwn(PERKS, id) &&
    !s.perks.includes(id)
  );
}

export function createCampaignMachine(options = {}) {
  const {
    state = newGame(),
    canClear = () => true,
    canEnterRV = () => true,
    onNightStart = noop,
    onDawn = noop,
    onVictory = noop,
    onDefeat = noop,
    onPerkChosen = noop,
  } = options;
  if (typeof state.manualPause !== 'boolean') state.manualPause = false;

  return setup({
    guards: {
      canStartNight: ({ context }) => active(context) && !context.perkPending,
      canClear: ({ context }) => active(context) && canClear(),
      isFinalDay: ({ context }) => context.day >= WAVES.length,
      canEnterRV: ({ context }) => dayReady(context) && !context.paused && canEnterRV(context),
      canExitRV: ({ context }) => !context.over,
      perkAvailable: ({ context, event }) => perkAvailable(context, event.perkId),
      campDestroyed: ({ context }) => !context.won && (context.over || context.health <= 0),
      manualPauseKept: ({ context }) => context.manualPause === true,
      notOver: ({ context }) => !context.over,
    },
    actions: {
      startNight: ({ context }) => {
        advance(context);
        onNightStart(context);
      },
      completeNight: ({ context }) => {
        advance(context, true);
        if (context.won) onVictory(context);
        else {
          context.paused = true;
          onDawn(context);
        }
      },
      takePerk: ({ context, event }) => {
        choosePerk(context, event.perkId);
        context.paused = false;
        onPerkChosen(context, event.perkId);
      },
      defeat: ({ context }) => onDefeat(context),
      pause: ({ context }) => {
        context.manualPause = true;
        context.paused = true;
      },
      resume: ({ context }) => {
        context.manualPause = false;
        context.paused = false;
      },
      openDialog: ({ context }) => {
        context.paused = true;
      },
      closeDialog: ({ context }) => {
        context.paused = false;
      },
      keepPaused: ({ context }) => {
        context.paused = true;
      },
    },
  }).createMachine({
    id: 'campaign',
    type: 'parallel',
    context: state,
    on: {
      CAMP_DESTROYED: { target: '.phase.defeat', guard: 'campDestroyed', actions: 'defeat' },
    },
    states: {
      phase: {
        initial: 'day',
        states: {
          day: {
            initial: 'outdoor',
            states: {
              outdoor: {
                on: {
                  ENTER_RV: { target: 'interior', guard: 'canEnterRV' },
                  START_NIGHT: {
                    target: '#campaign.phase.night',
                    guard: 'canStartNight',
                    actions: 'startNight',
                  },
                },
              },
              interior: {
                on: { EXIT_RV: { target: 'outdoor', guard: 'canExitRV' } },
              },
            },
          },
          night: {
            on: {
              CLEARED: [
                { target: 'victory', guard: 'isFinalDay', actions: 'completeNight' },
                { target: 'dawn', guard: 'canClear', actions: 'completeNight' },
              ],
            },
          },
          dawn: {
            on: { CHOOSE_PERK: { target: 'day', guard: 'perkAvailable', actions: 'takePerk' } },
          },
          victory: { type: 'final' },
          defeat: { type: 'final' },
        },
      },
      overlay: {
        initial: 'none',
        states: {
          none: {
            on: {
              PAUSE: { target: 'paused', guard: 'notOver', actions: 'pause' },
              OPEN_HELP: { target: 'help', guard: 'notOver', actions: 'openDialog' },
              OPEN_MANUAL: { target: 'manual', guard: 'notOver', actions: 'openDialog' },
            },
          },
          paused: {
            on: {
              RESUME: { target: 'none', actions: 'resume' },
              PAUSE: { target: 'none', actions: 'resume' },
              OPEN_HELP: { target: 'help', actions: 'openDialog' },
              OPEN_MANUAL: { target: 'manual', actions: 'openDialog' },
            },
          },
          help: {
            on: {
              CLOSE_HELP: [
                { target: 'paused', guard: 'manualPauseKept', actions: 'keepPaused' },
                { target: 'none', actions: 'closeDialog' },
              ],
            },
          },
          manual: {
            on: {
              CLOSE_MANUAL: [
                { target: 'paused', guard: 'manualPauseKept', actions: 'keepPaused' },
                { target: 'none', actions: 'closeDialog' },
              ],
            },
          },
        },
      },
    },
  });
}

export function startCampaign(options = {}) {
  const actor = createActor(createCampaignMachine(options));
  actor.start();
  assertPhaseSync(actor.getSnapshot());
  return actor;
}

export const phaseValue = (snapshot) => {
  const value = snapshot.value?.phase;
  if (!value) return null;
  return typeof value === 'object' ? Object.keys(value)[0] : value;
};

export const overlayValue = (snapshot) => snapshot.value?.overlay ?? 'none';

export const isInterior = (snapshot) => snapshot.value?.phase?.day === 'interior';

export const effectivelyPaused = (snapshot) =>
  overlayValue(snapshot) !== 'none' || phaseValue(snapshot) === 'dawn';

export function assertPhaseSync(snapshot) {
  const s = snapshot.context;
  const phase = phaseValue(snapshot);
  if (phase === 'day' || phase === 'dawn') {
    if (s.phase !== 'day') throw new Error(`machine ${phase} but state.phase=${s.phase}`);
    if (phase === 'dawn' && !s.perkPending)
      throw new Error('machine dawn but state has no pending perk');
    if (phase === 'dawn' && !s.paused)
      throw new Error('machine dawn but the day clock is not frozen');
    return;
  }
  if (phase === 'night') {
    if (s.phase !== 'night') throw new Error(`machine night but state.phase=${s.phase}`);
    return;
  }
  if (phase === 'victory' || phase === 'defeat') {
    if (!s.over) throw new Error(`machine ${phase} but state.over=false`);
    if (phase === 'victory' && !s.won) throw new Error('machine victory but state.won=false');
    return;
  }
  throw new Error(`unknown machine phase: ${phase}`);
}
