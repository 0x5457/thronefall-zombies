// RV interior gameplay: slot panel, nightly weapon mod, radio intel and window glow.
// Rendering stays in interior.js / world.js; this module owns the rules-to-DOM wiring.
import {
  RV_FURNITURE,
  furnitureReason,
  installFurniture,
  uninstallFurniture,
  hasFurniture,
  setWeaponMod,
  WEAPON_MODS,
  rvSlots,
  spawnTimeline,
  weaponDamage,
  weaponRange,
  ENEMY_TYPES,
  LANES,
} from './rules.js';
import type { FurnitureId, FurnitureSpec, GameState, SpawnEntry } from './rules.js';
import type { Interior } from './interior.js';

// Minimal structural view of the audio bus; audio.ts owns the full type.
export interface RvAudio {
  effect(name: string): void;
}

export interface RvOptions {
  state: GameState;
  getInterior?: () => Interior | null | undefined;
  audio?: RvAudio;
  toast?: (message: string) => void;
  syncUI?: () => void;
}

export interface TimelineCard {
  title: string;
  tag: string;
  rows: string[];
}

const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string | null,
  text?: string | number | null,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

export function createRv({ state, getInterior, audio, toast, syncUI }: RvOptions) {
  const list = $('#rv-furniture'),
    alert = $('#radio-alert');
  function refreshSuite(): void {
    const suite = getInterior?.();
    if (!suite) return;
    suite.setFurniture(state.rv);
    suite.setSlots(rvSlots(state));
  }
  function card(id: FurnitureId, furniture: FurnitureSpec): HTMLElement {
    const owned = hasFurniture(state, id);
    const node = el('div', `rv-card${owned ? ' owned' : ''}`);
    const head = el('div', 'rv-card-head');
    head.append(el('strong', null, furniture.name), el('span', 'rv-tag', furniture.tag));
    node.append(head, el('p', 'rv-card-text', furniture.text));
    const foot = el('div', 'rv-card-foot');
    foot.append(
      el(
        'span',
        'rv-cost',
        furniture.scrap ? `▰${furniture.wood} ⚙${furniture.scrap}` : `▰${furniture.wood}`,
      ),
    );
    if (owned) {
      const remove = el('button', 'rv-remove', '拆除');
      remove.dataset.rvRemove = id;
      remove.addEventListener('click', () => drop(id));
      foot.append(remove);
    } else {
      const reason = furnitureReason(state, id);
      const install = el('button', 'rv-install', reason ? '暂不可安装' : '安装');
      install.dataset.rvInstall = id;
      install.disabled = !!reason;
      install.addEventListener('click', () => build(id));
      foot.append(install);
      node.append(foot);
      if (reason) node.append(el('p', 'rv-reason', reason));
      return node;
    }
    node.append(foot);
    return node;
  }
  function modPanel(): HTMLElement {
    const node = el('div', 'rv-mod');
    const head = el('div', 'rv-mod-head');
    head.append(
      el('strong', null, '今晚改装'),
      el(
        'span',
        'rv-tag',
        `${weaponDamage(state, state.weapon)} 伤害 · ${weaponRange(state, state.weapon)} 射程`,
      ),
    );
    node.append(
      head,
      ...Object.entries(WEAPON_MODS).map(([id, mod]) => {
        const button = el(
          'button',
          `rv-mod-option${state.weaponMod === id ? ' current' : ''}`,
          `${mod.name} · ${mod.text}`,
        );
        button.dataset.rvMod = id;
        button.setAttribute('aria-pressed', String(state.weaponMod === id));
        button.addEventListener('click', () => choose(id));
        return button;
      }),
    );
    node.append(el('p', 'rv-mod-note', '改装在黎明后重置，只影响角色武器。'));
    return node;
  }
  function render(): void {
    if (!list) return;
    const entries = Object.entries(RV_FURNITURE) as [FurnitureId, FurnitureSpec][];
    const functions = entries.filter(([, furniture]) => furniture.kind === 'function');
    const decor = entries.filter(([, furniture]) => furniture.kind === 'decor');
    const children = [
      el(
        'p',
        'rv-section',
        `功能槽 ${state.rv.filter((id) => RV_FURNITURE[id].kind === 'function').length}/${rvSlots(state)} · 槽位随守夜解锁`,
      ),
      ...functions.map(([id, furniture]) => card(id, furniture)),
    ];
    if (hasFurniture(state, 'workbench')) children.push(modPanel());
    children.push(
      el('p', 'rv-section', '装饰 · 只改变房车的样子'),
      ...decor.map(([id, furniture]) => card(id, furniture)),
    );
    list.replaceChildren(...children);
    refreshSuite();
  }
  function build(id: FurnitureId): void {
    if (!installFurniture(state, id)) {
      toast?.(`无法安装 · ${furnitureReason(state, id) || '未知原因'}`);
      return;
    }
    audio?.effect('build');
    toast?.(`已安装 ${RV_FURNITURE[id].name}`);
    render();
    syncUI?.();
  }
  function drop(id: FurnitureId): void {
    if (!uninstallFurniture(state, id)) {
      toast?.('只能在白天拆除家具。');
      return;
    }
    const f = RV_FURNITURE[id];
    audio?.effect('destroy');
    toast?.(
      `已拆除 ${f.name} · 返还 ▰${Math.floor(f.wood * 0.6)}${f.scrap ? ` ⚙${Math.floor(f.scrap * 0.6)}` : ''}`,
    );
    render();
    syncUI?.();
  }
  function choose(id: string): void {
    if (!setWeaponMod(state, state.weaponMod === id ? null : id)) {
      toast?.('需要先安装便携工作台。');
      return;
    }
    toast?.(state.weaponMod ? `今晚改装 · ${WEAPON_MODS[state.weaponMod].name}` : '已取消改装');
    render();
    syncUI?.();
  }
  // Night radio HUD: next spawn only exists while the wave queue is running.
  function updateAlert(queue: SpawnEntry[], clock: number): void {
    if (!alert) return;
    const next =
      hasFurniture(state, 'radio') && state.phase === 'night' && queue.length ? queue[0] : null;
    alert.hidden = !next;
    if (!next) return;
    const eta = Math.max(0, Math.ceil(next.at - clock));
    alert.textContent = `电台 · 下一路 ${LANES[next.lane]} · ${ENEMY_TYPES[next.type].name} · ${eta}s`;
  }
  // Radio timeline card for the intel page; returns [] without a radio.
  function timelineCards(day: number): TimelineCard[] {
    if (!hasFurniture(state, 'radio')) return [];
    const rows = spawnTimeline(day).map(
      (row) =>
        `${Math.round(row.at)}s · ${LANES[row.lane]} · ${ENEMY_TYPES[row.type].name} ×${row.count}`,
    );
    return [{ title: '短波电台 · 今晚时间轴', tag: '生成节奏', rows }];
  }
  return {
    render,
    build,
    drop,
    choose,
    updateAlert,
    timelineCards,
    refreshSuite,
    get alert(): HTMLElement | null {
      return alert;
    },
  };
}

// Window glow world view: world.js builds these as Three.js meshes/groups.
export interface RvGlowPane {
  visible: boolean;
  material: { opacity: number };
}

export interface RvGlowGroup {
  visible: boolean;
  children: Array<{ material: { opacity: number } }>;
}

export interface RvGlowHost {
  rvGlow?: {
    panes: RvGlowPane[];
    modules: Record<string, RvGlowGroup>;
  } | null;
}

// Window glow: only at night, warm baseline plus one mark per installed module.
export function updateRvGlow(
  world: RvGlowHost | null | undefined,
  owned: readonly string[],
  daylight: number,
  lampOn: boolean,
  time: number,
): void {
  const glow = world?.rvGlow;
  if (!glow) return;
  const night = 1 - daylight,
    lit = night > 0.03;
  for (const pane of glow.panes) {
    pane.visible = lit;
    if (lit) pane.material.opacity = night * (lampOn ? 0.72 : 0.13);
  }
  for (const [id, group] of Object.entries(glow.modules)) {
    const on = lit && owned.includes(id);
    group.visible = on;
    if (!on) continue;
    const pulse = 0.85 + Math.sin(time * 2.6 + id.length) * 0.15;
    group.children.forEach((child, index) => {
      child.material.opacity = night * pulse * (index === 0 ? 0.95 : 0.6);
    });
  }
}
