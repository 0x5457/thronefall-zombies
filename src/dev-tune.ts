// Dev-only live balance panel (Tweakpane). Mounted only with `?tune=1`.
// main.ts imports this behind `import.meta.env.DEV`, so production builds drop it entirely.
import {
  BUILDING_STATS,
  COSTS,
  DASH,
  ENEMY_TYPES,
  FLARE,
  LANTERN,
  TOWER,
  WEAPONS,
} from './rules.js';
import type { EnemyId } from './rules.js';

export async function mountDevTuner(): Promise<void> {
  if (!new URLSearchParams(location.search).has('tune')) return;
  const { Pane } = await import('tweakpane');
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:8px;right:8px;z-index:60;width:280px;';
  // Keep game hotkeys from firing while typing in the panel.
  container.addEventListener('keydown', (event) => event.stopPropagation(), true);
  container.addEventListener('keyup', (event) => event.stopPropagation(), true);
  document.body.append(container);

  const pane = new Pane({ title: 'PINEFALL · 调参（dev）', container });
  const economy = pane.addFolder({ title: '建筑 / 经济' });
  for (const type of ['fence', 'tower', 'lantern'] as const) {
    const folder = economy.addFolder({ title: type });
    folder.addBinding(COSTS, type, { min: 0, max: 100, step: 5, label: '造价' });
    folder.addBinding(BUILDING_STATS[type], 'hp', { min: 20, max: 600, step: 10, label: '耐久' });
    folder.addBinding(BUILDING_STATS[type], 'r', { min: 0.2, max: 3, step: 0.05, label: '占地' });
  }

  const defense = pane.addFolder({ title: '塔 / 灯成长' });
  defense.addBinding(TOWER, 'damage', { min: 0, max: 20, step: 0.5, label: '塔伤害' });
  defense.addBinding(TOWER, 'range', { min: 2, max: 30, step: 0.5, label: '塔射程' });
  defense.addBinding(TOWER, 'cooldown', { min: 0.1, max: 3, step: 0.05, label: '塔间隔' });
  defense.addBinding(LANTERN, 'radius', { min: 1, max: 20, step: 0.5, label: '灯半径' });
  defense.addBinding(LANTERN, 'slow', { min: 0.1, max: 1, step: 0.01, label: '灯减速' });

  const abilities = pane.addFolder({ title: '角色能力' });
  abilities.addBinding(DASH, 'cost', { min: 0, max: 100, step: 5, label: '冲刺体力' });
  abilities.addBinding(DASH, 'speed', { min: 1, max: 40, step: 1, label: '冲刺速度' });
  abilities.addBinding(FLARE, 'radius', { min: 1, max: 20, step: 0.5, label: '信号弹半径' });
  abilities.addBinding(FLARE, 'cooldown', { min: 0, max: 90, step: 5, label: '信号弹冷却' });

  const guns = pane.addFolder({ title: '武器' });
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    const folder = guns.addFolder({ title: weapon.name || id });
    folder.addBinding(weapon, 'damage', { min: 0, max: 30, step: 0.5, label: '伤害' });
    folder.addBinding(weapon, 'range', { min: 1, max: 30, step: 0.5, label: '射程' });
    folder.addBinding(weapon, 'interval', { min: 0.05, max: 3, step: 0.05, label: '间隔' });
  }

  const foes = pane.addFolder({ title: '敌人' });
  for (const [id, def] of Object.entries(ENEMY_TYPES) as [
    EnemyId,
    (typeof ENEMY_TYPES)[EnemyId],
  ][]) {
    const folder = foes.addFolder({ title: `${def.name}（${id}）` });
    folder.addBinding(def, 'hp', { min: 1, max: 300, step: 1, label: '生命' });
    folder.addBinding(def, 'speed', { min: 0.1, max: 5, step: 0.05, label: '速度' });
    folder.addBinding(def, 'damage', { min: 0, max: 50, step: 1, label: '伤害' });
    folder.addBinding(def, 'armor', { min: 0, max: 1, step: 0.05, label: '护甲' });
    folder.addBinding(def, 'wallDamage', { min: 0, max: 6, step: 0.1, label: '拆墙' });
  }
}
