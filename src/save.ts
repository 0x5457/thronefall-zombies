// Campaign checkpoints (ARC-04). Owns the versioned JSON, storage slots and in-place restore.
// The save format is ours alone: XState internals, meshes, enemies and pause flags never enter it.
import {
  WAVES,
  WEAPONS,
  newGame,
  type Building,
  type FurnitureId,
  type GameState,
  type LogNode,
  type PerkId,
  type WeaponId,
} from './rules.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'pinefall.campaign.current';
export const SAVE_BACKUP_KEY = 'pinefall.campaign.backup';

const SCALAR_FIELDS: (keyof GameState)[] = [
  'day',
  'elapsed',
  'wood',
  'scrap',
  'health',
  'playerHp',
  'stamina',
  'staminaDelay',
  'medkits',
  'kills',
  'weapon',
  'unlocked',
  'perks',
  'expeditionDay',
  'flareCooldown',
  'rv',
  'weaponMod',
  'nextBuildId',
];
const ARRAY_FIELDS: (keyof GameState)[] = ['unlocked', 'perks', 'rv'];
const MIGRATIONS: Record<number, (save: CampaignSave) => CampaignSave> = {};

interface SavedState extends Record<string, unknown> {
  day: number;
  wood: number;
  scrap: number;
  health: number;
  playerHp: number;
  medkits: number;
  kills: number;
  weapon: WeaponId;
  unlocked: WeaponId[];
  perks: PerkId[];
  rv: FurnitureId[];
  buildings: Building[];
  logs: LogNode[];
}

export interface CampaignSave {
  version: number;
  savedAt: number;
  phase: string;
  state: SavedState;
}

export interface SaveSummary {
  day: number;
  health: number;
  perks: number;
  savedAt: number;
}

export type SaveOutcome = { ok: true } | { ok: false; reason: 'storage' | 'phase' | 'quota' };
export type ReadSaveResult =
  | { ok: true; save: CampaignSave; recovered: boolean }
  | { ok: false; reason: 'storage' | 'version' | 'corrupt' | 'missing' };

interface StoredSlot {
  corrupt?: boolean;
  version?: unknown;
  state?: unknown;
}

function storageOrNull(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function campaignPayload(state: GameState): CampaignSave {
  const data: Record<string, unknown> = {};
  for (const key of SCALAR_FIELDS) data[key] = state[key];
  data.buildings = state.buildings.map((b) => ({ ...b, invested: { ...b.invested } }));
  data.logs = state.logs.map((l) => ({ ...l }));
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    phase: state.phase,
    state: data as SavedState,
  };
}

export function isValidSave(save: unknown): save is CampaignSave {
  if (!save || typeof save !== 'object') return false;
  const doc = save as Partial<CampaignSave>;
  if (!Number.isInteger(doc.version)) return false;
  if (doc.phase !== 'day') return false;
  const s = doc.state;
  if (!s || typeof s !== 'object') return false;
  if (!Number.isFinite(s.day) || s.day < 1 || s.day > WAVES.length) return false;
  if (!Number.isFinite(s.wood) || !Number.isFinite(s.scrap) || !Number.isFinite(s.health))
    return false;
  if (!Number.isFinite(s.playerHp) || !Number.isFinite(s.medkits) || !Number.isFinite(s.kills))
    return false;
  if (!WEAPONS[s.weapon]) return false;
  for (const field of ARRAY_FIELDS) if (!Array.isArray(s[field])) return false;
  if (!Array.isArray(s.buildings) || !Array.isArray(s.logs)) return false;
  if (
    !s.buildings.every(
      (b: Building) =>
        b &&
        ['fence', 'tower', 'lantern'].includes(b.type) &&
        Number.isFinite(b.x) &&
        Number.isFinite(b.z) &&
        Number.isFinite(b.hp),
    )
  )
    return false;
  if (!s.logs.every((l: LogNode) => l && typeof l.id === 'string' && Number.isFinite(l.remaining)))
    return false;
  return true;
}

function migrate(save: CampaignSave): CampaignSave | null {
  let migrated = save;
  while (migrated.version < SAVE_VERSION) {
    const step = MIGRATIONS[migrated.version];
    if (!step) return null;
    migrated = step(migrated);
  }
  return migrated;
}

function parseSlot(raw: string | null): StoredSlot | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSlot;
  } catch {
    return { corrupt: true };
  }
}

export function readSave(storage: Storage | null = storageOrNull()): ReadSaveResult {
  if (!storage) return { ok: false, reason: 'storage' };
  let current: StoredSlot | null = null,
    backup: StoredSlot | null = null;
  try {
    current = parseSlot(storage.getItem(SAVE_KEY));
    backup = parseSlot(storage.getItem(SAVE_BACKUP_KEY));
  } catch {
    return { ok: false, reason: 'storage' };
  }
  const slots: [StoredSlot | null, boolean][] = [
    [current, false],
    [backup, true],
  ];
  for (const [slot, recovered] of slots) {
    if (!slot || slot.corrupt) continue;
    const stored = slot as CampaignSave;
    const candidate = stored.version === SAVE_VERSION ? stored : migrate(stored);
    if (!candidate) return { ok: false, reason: 'version' };
    if (candidate.version > SAVE_VERSION) return { ok: false, reason: 'version' };
    if (!isValidSave(candidate)) return { ok: false, reason: 'corrupt' };
    return { ok: true, save: candidate, recovered };
  }
  return { ok: false, reason: current || backup ? 'corrupt' : 'missing' };
}

export function writeSave(
  state: GameState,
  storage: Storage | null = storageOrNull(),
): SaveOutcome {
  if (!storage) return { ok: false, reason: 'storage' };
  if (state.over || state.phase !== 'day' || state.perkPending)
    return { ok: false, reason: 'phase' };
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous) storage.setItem(SAVE_BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, JSON.stringify(campaignPayload(state)));
    return { ok: true };
  } catch {
    return { ok: false, reason: 'quota' };
  }
}

// Reset in place so main.js keeps its references to the state, building and log arrays.
export function resetCampaign(state: GameState): GameState {
  const buildings = state.buildings,
    logs = state.logs;
  Object.assign(state, newGame());
  state.buildings = buildings;
  buildings.length = 0;
  state.logs = logs;
  state.paused = false;
  state.manualPause = false;
  return state;
}

export function applySave(state: GameState, save: CampaignSave): boolean {
  resetCampaign(state);
  const target = state as unknown as Record<string, unknown>;
  for (const key of SCALAR_FIELDS) if (key in save.state) target[key] = save.state[key];
  state.buildings.push(...save.state.buildings.map((b) => ({ ...b, invested: { ...b.invested } })));
  for (const log of state.logs) {
    const saved = save.state.logs.find((l) => l.id === log.id);
    if (saved) log.remaining = saved.remaining;
  }
  state.over = false;
  state.won = false;
  state.paused = false;
  state.manualPause = false;
  return true;
}

export function saveSummary(save: CampaignSave | null): SaveSummary | null {
  if (!save) return null;
  return {
    day: save.state.day,
    health: Math.ceil(save.state.health),
    perks: save.state.perks.length,
    savedAt: save.savedAt,
  };
}
