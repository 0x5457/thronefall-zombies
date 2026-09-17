export const COSTS = { fence: 15, tower: 35, lantern: 10 };
export const NAMES = { fence: '木栅栏', tower: '瞭望塔', lantern: '营地灯' };
export function newGame() { return { day: 1, phase: 'day', elapsed: 0, wood: 80, health: 100, kills: 0, paused: false, over: false }; }
export function canBuild(state, type) { return type in COSTS && !state.over && !state.paused && state.phase === 'day' && state.wood >= COSTS[type]; }
export function buy(state, type) { if (!canBuild(state, type)) return false; state.wood -= COSTS[type]; return true; }
export function advance(state) {
  if (state.over) return;
  state.elapsed = 0;
  if (state.phase === 'day') state.phase = 'night';
  else { state.phase = 'day'; state.day++; state.wood += 35; state.health = Math.min(100, state.health + 18); }
}
export function damageCamp(state, damage) { state.health = Math.max(0, state.health - damage); if (!state.health) state.over = true; }
export const waveSize = day => 9 + day * 4;
export function overlaps(x, z, objects, radius = 1) { return objects.some(o => Math.hypot(x - o.x, z - o.z) < radius + o.r); }
