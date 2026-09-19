// RV interior gameplay: slot panel, nightly weapon mod, radio intel and window glow.
// Rendering stays in interior.js / world.js; this module owns the rules-to-DOM wiring.
import {
  RV_FURNITURE, furnitureReason, installFurniture, uninstallFurniture, hasFurniture,
  setWeaponMod, WEAPON_MODS, rvSlots, spawnTimeline, weaponDamage, weaponRange,
  ENEMY_TYPES, LANES,
} from './rules.js';

const $ = selector => document.querySelector(selector);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

export function createRv({ state, getInterior, audio, toast, syncUI }) {
  const list = $('#rv-furniture'), alert = $('#radio-alert');
  function refreshSuite() {
    const suite = getInterior?.();
    if (!suite) return;
    suite.setFurniture(state.rv);
    suite.setSlots(rvSlots(state));
  }
  function card(id, furniture) {
    const owned = hasFurniture(state, id);
    const node = el('div', `rv-card${owned ? ' owned' : ''}`);
    const head = el('div', 'rv-card-head');
    head.append(el('strong', null, furniture.name), el('span', 'rv-tag', furniture.tag));
    node.append(head, el('p', 'rv-card-text', furniture.text));
    const foot = el('div', 'rv-card-foot');
    foot.append(el('span', 'rv-cost', furniture.scrap ? `▰${furniture.wood} ⚙${furniture.scrap}` : `▰${furniture.wood}`));
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
  function modPanel() {
    const node = el('div', 'rv-mod');
    const head = el('div', 'rv-mod-head');
    head.append(el('strong', null, '今晚改装'), el('span', 'rv-tag', `${weaponDamage(state, state.weapon)} 伤害 · ${weaponRange(state, state.weapon)} 射程`));
    node.append(head,...Object.entries(WEAPON_MODS).map(([id, mod]) => {
      const button = el('button', `rv-mod-option${state.weaponMod === id ? ' current' : ''}`, `${mod.name} · ${mod.text}`);
      button.dataset.rvMod = id;
      button.setAttribute('aria-pressed', String(state.weaponMod === id));
      button.addEventListener('click', () => choose(id));
      return button;
    }));
    node.append(el('p', 'rv-mod-note', '改装在黎明后重置，只影响角色武器。'));
    return node;
  }
  function render() {
    if (!list) return;
    const functions = Object.entries(RV_FURNITURE).filter(([, furniture]) => furniture.kind === 'function');
    const decor = Object.entries(RV_FURNITURE).filter(([, furniture]) => furniture.kind === 'decor');
    const children = [
      el('p', 'rv-section', `功能槽 ${state.rv.filter(id => RV_FURNITURE[id].kind === 'function').length}/${rvSlots(state)} · 槽位随守夜解锁`),
      ...functions.map(([id, furniture]) => card(id, furniture)),
    ];
    if (hasFurniture(state, 'workbench')) children.push(modPanel());
    children.push(el('p', 'rv-section', '装饰 · 只改变房车的样子'), ...decor.map(([id, furniture]) => card(id, furniture)));
    list.replaceChildren(...children);
    refreshSuite();
  }
  function build(id) {
    if (!installFurniture(state, id)) { toast?.(`无法安装 · ${furnitureReason(state, id) || '未知原因'}`); return; }
    audio?.effect('build'); toast?.(`已安装 ${RV_FURNITURE[id].name}`);
    render(); syncUI?.();
  }
  function drop(id) {
    if (!uninstallFurniture(state, id)) { toast?.('只能在白天拆除家具。'); return; }
    const f = RV_FURNITURE[id];
    audio?.effect('destroy');
    toast?.(`已拆除 ${f.name} · 返还 ▰${Math.floor(f.wood * .6)}${f.scrap ? ` ⚙${Math.floor(f.scrap * .6)}` : ''}`);
    render(); syncUI?.();
  }
  function choose(id) {
    if (!setWeaponMod(state, state.weaponMod === id ? null : id)) { toast?.('需要先安装便携工作台。'); return; }
    toast?.(state.weaponMod ? `今晚改装 · ${WEAPON_MODS[state.weaponMod].name}` : '已取消改装');
    render(); syncUI?.();
  }
  // Night radio HUD: next spawn only exists while the wave queue is running.
  function updateAlert(queue, clock) {
    if (!alert) return;
    const next = hasFurniture(state, 'radio') && state.phase === 'night' && queue.length ? queue[0] : null;
    alert.hidden = !next;
    if (!next) return;
    const eta = Math.max(0, Math.ceil(next.at - clock));
    alert.textContent = `电台 · 下一路 ${LANES[next.lane]} · ${ENEMY_TYPES[next.type].name} · ${eta}s`;
  }
  // Radio timeline card for the intel page; returns [] without a radio.
  function timelineCards(day) {
    if (!hasFurniture(state, 'radio')) return [];
    const rows = spawnTimeline(day).map(row => `${Math.round(row.at)}s · ${LANES[row.lane]} · ${ENEMY_TYPES[row.type].name} ×${row.count}`);
    return [{ title: '短波电台 · 今晚时间轴', tag: '生成节奏', rows }];
  }
  return { render, build, drop, choose, updateAlert, timelineCards, refreshSuite, get alert() { return alert; } };
}

// Window glow: only at night, warm baseline plus one mark per installed module.
export function updateRvGlow(world, owned, daylight, lampOn, time) {
  const glow = world?.rvGlow;
  if (!glow) return;
  const night = 1 - daylight, lit = night > .03;
  for (const pane of glow.panes) {
    pane.visible = lit;
    if (lit) pane.material.opacity = night * (lampOn ? .72 : .13);
  }
  for (const [id, group] of Object.entries(glow.modules)) {
    const on = lit && owned.includes(id);
    group.visible = on;
    if (!on) continue;
    const pulse = .85 + Math.sin(time * 2.6 + id.length) * .15;
    group.children.forEach((child, index) => { child.material.opacity = night * pulse * (index === 0 ? .95 : .6); });
  }
}
