// RV gameplay helpers: scene-suite refresh plus pure radio intel formatting.
// DOM rendering lives in the React UI (src/ui/RvPanel.tsx, src/ui/Manual.tsx).
import { ENEMY_TYPES, LANES, hasFurniture, rvSlots, spawnTimeline } from './rules.js';
import type { GameState, SpawnEntry } from './rules.js';
import type { Interior } from './interior.js';

export interface TimelineCard {
  title: string;
  tag: string;
  rows: string[];
}

// Sync the Three.js interior suite with authoritative furniture/slot state.
export function refreshInterior(interior: Interior | null | undefined, state: GameState): void {
  if (!interior) return;
  interior.setFurniture(state.rv);
  interior.setSlots(rvSlots(state));
}

// Collapsed spawn timeline for the intel page; empty without a radio.
export function radioTimeline(state: GameState): TimelineCard[] {
  if (!hasFurniture(state, 'radio')) return [];
  const rows = spawnTimeline(state.day).map(
    (row) =>
      `${Math.round(row.at)}s · ${LANES[row.lane]} · ${ENEMY_TYPES[row.type].name} ×${row.count}`,
  );
  return [{ title: '短波电台 · 今晚时间轴', tag: '生成节奏', rows }];
}

// Night HUD alert: next lane and countdown while the spawn queue is running.
export function radioAlert(state: GameState, queue: SpawnEntry[], clock: number): string | null {
  if (!hasFurniture(state, 'radio') || state.phase !== 'night' || !queue.length) return null;
  const next = queue[0];
  return `电台 · 下一路 ${LANES[next.lane]} · ${ENEMY_TYPES[next.type].name} · ${Math.max(0, Math.ceil(next.at - clock))}s`;
}
