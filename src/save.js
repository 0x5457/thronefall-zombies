// Campaign checkpoints (ARC-04). Owns the versioned JSON, storage slots and in-place restore.
// The save format is ours alone: XState internals, meshes, enemies and pause flags never enter it.
import { WAVES, WEAPONS, newGame } from './rules.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'pinefall.campaign.current';
export const SAVE_BACKUP_KEY = 'pinefall.campaign.backup';

const SCALAR_FIELDS = [
  'day', 'elapsed', 'wood', 'scrap', 'health', 'playerHp', 'stamina', 'staminaDelay',
  'medkits', 'kills', 'weapon', 'unlocked', 'perks', 'expeditionDay', 'flareCooldown',
  'rv', 'weaponMod', 'nextBuildId',
];
const ARRAY_FIELDS = ['unlocked', 'perks', 'rv'];
const MIGRATIONS = {};

function storageOrNull() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function campaignPayload(state) {
  const data = {};
  for (const key of SCALAR_FIELDS) data[key] = state[key];
  data.buildings = state.buildings.map(b => ({ ...b, invested: { ...b.invested } }));
  data.logs = state.logs.map(l => ({ ...l }));
  return { version: SAVE_VERSION, savedAt: Date.now(), phase: state.phase, state: data };
}

export function isValidSave(save) {
  if (!save || typeof save !== 'object' || !Number.isInteger(save.version)) return false;
  if (save.phase !== 'day') return false;
  const s = save.state;
  if (!s || typeof s !== 'object') return false;
  if (!Number.isFinite(s.day) || s.day < 1 || s.day > WAVES.length) return false;
  if (!Number.isFinite(s.wood) || !Number.isFinite(s.scrap) || !Number.isFinite(s.health)) return false;
  if (!Number.isFinite(s.playerHp) || !Number.isFinite(s.medkits) || !Number.isFinite(s.kills)) return false;
  if (!WEAPONS[s.weapon]) return false;
  for (const field of ARRAY_FIELDS) if (!Array.isArray(s[field])) return false;
  if (!Array.isArray(s.buildings) || !Array.isArray(s.logs)) return false;
  if (!s.buildings.every(b => b && ['fence', 'tower', 'lantern'].includes(b.type) && Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.hp))) return false;
  if (!s.logs.every(l => l && typeof l.id === 'string' && Number.isFinite(l.remaining))) return false;
  return true;
}

function migrate(save) {
  let migrated = save;
  while (migrated.version < SAVE_VERSION) {
    const step = MIGRATIONS[migrated.version];
    if (!step) return null;
    migrated = step(migrated);
  }
  return migrated;
}

function parseSlot(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { corrupt: true }; }
}

export function readSave(storage = storageOrNull()) {
  if (!storage) return { ok: false, reason: 'storage' };
  let current = null, backup = null;
  try { current = parseSlot(storage.getItem(SAVE_KEY)); backup = parseSlot(storage.getItem(SAVE_BACKUP_KEY)); }
  catch { return { ok: false, reason: 'storage' }; }
  for (const [slot, recovered] of [[current, false], [backup, true]]) {
    if (!slot || slot.corrupt) continue;
    const candidate = slot.version === SAVE_VERSION ? slot : migrate(slot);
    if (!candidate) return { ok: false, reason: 'version' };
    if (candidate.version > SAVE_VERSION) return { ok: false, reason: 'version' };
    if (!isValidSave(candidate)) return { ok: false, reason: 'corrupt' };
    return { ok: true, save: candidate, recovered };
  }
  return { ok: false, reason: current || backup ? 'corrupt' : 'missing' };
}

export function writeSave(state, storage = storageOrNull()) {
  if (!storage) return { ok: false, reason: 'storage' };
  if (state.over || state.phase !== 'day' || state.perkPending) return { ok: false, reason: 'phase' };
  try {
    const previous = storage.getItem(SAVE_KEY);
    if (previous) storage.setItem(SAVE_BACKUP_KEY, previous);
    storage.setItem(SAVE_KEY, JSON.stringify(campaignPayload(state)));
    return { ok: true };
  } catch { return { ok: false, reason: 'quota' }; }
}

// Reset in place so main.js keeps its references to the state, building and log arrays.
export function resetCampaign(state) {
  const buildings = state.buildings, logs = state.logs;
  Object.assign(state, newGame());
  state.buildings = buildings; buildings.length = 0;
  state.logs = logs;
  state.paused = false;
  state.manualPause = false;
  return state;
}

export function applySave(state, save) {
  resetCampaign(state);
  for (const key of SCALAR_FIELDS) if (key in save.state) state[key] = save.state[key];
  state.buildings.push(...save.state.buildings.map(b => ({ ...b, invested: { ...(b.invested || {}) } })));
  for (const log of state.logs) {
    const saved = save.state.logs.find(l => l.id === log.id);
    if (saved) log.remaining = saved.remaining;
  }
  state.over = false; state.won = false; state.paused = false; state.manualPause = false;
  return true;
}

export function saveSummary(save) {
  if (!save) return null;
  return { day: save.state.day, health: Math.ceil(save.state.health), perks: save.state.perks.length, savedAt: save.savedAt };
}
