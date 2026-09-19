// RV interior panel: function/decor slots, nightly weapon mod, lamp and leave button.
// Three.js interior visuals stay in interior.ts; this is the DOM surface only.
import {
  RV_FURNITURE,
  WEAPON_MODS,
  furnitureReason,
  hasFurniture,
  rvSlots,
  weaponDamage,
  weaponRange,
} from '../rules.js';
import type { FurnitureId, FurnitureSpec } from '../rules.js';
import { cmd } from './store.js';
import { useUi } from './use-ui.js';

function RvCard({ id, furniture }: { id: FurnitureId; furniture: FurnitureSpec }) {
  const snap = useUi();
  const owned = hasFurniture(snap.state, id);
  const reason = owned ? '' : furnitureReason(snap.state, id);
  return (
    <div className={`rv-card${owned ? ' owned' : ''}`}>
      <div className="rv-card-head">
        <strong>{furniture.name}</strong>
        <span className="rv-tag">{furniture.tag}</span>
      </div>
      <p className="rv-card-text">{furniture.text}</p>
      <div className="rv-card-foot">
        <span className="rv-cost">
          {furniture.scrap ? `▰${furniture.wood} ⚙${furniture.scrap}` : `▰${furniture.wood}`}
        </span>
        {owned ? (
          <button className="rv-remove" data-rv-remove={id} onClick={() => cmd().rvDrop(id)}>
            拆除
          </button>
        ) : (
          <button
            className="rv-install"
            data-rv-install={id}
            disabled={!!reason}
            onClick={() => cmd().rvBuild(id)}
          >
            {reason ? '暂不可安装' : '安装'}
          </button>
        )}
      </div>
      {!owned && reason ? <p className="rv-reason">{reason}</p> : null}
    </div>
  );
}

export function RvPanel() {
  const snap = useUi();
  const state = snap.state;
  const entries = Object.entries(RV_FURNITURE) as [FurnitureId, FurnitureSpec][];
  const functions = entries.filter(([, furniture]) => furniture.kind === 'function');
  const decor = entries.filter(([, furniture]) => furniture.kind === 'decor');
  const usedSlots = state.rv.filter((id) => RV_FURNITURE[id].kind === 'function').length;
  return (
    <section id="interior-panel" hidden={!snap.inside} aria-label="房车内部">
      <span className="eyebrow">HOME BETWEEN THE PINES</span>
      <h2>松林里的小小居所</h2>
      <p id="rv-hint">
        白天准备时间已暂停 · WASD 在过道走动
        <br />
        沿切面安装功能模块，在台面与墙上摆放装饰。
      </p>
      <div id="rv-furniture" aria-label="房车布置">
        <p className="rv-section">
          功能槽 {usedSlots}/{rvSlots(state)} · 槽位随守夜解锁
        </p>
        {functions.map(([id, furniture]) => (
          <RvCard key={id} id={id} furniture={furniture} />
        ))}
        {hasFurniture(state, 'workbench') ? (
          <div className="rv-mod">
            <div className="rv-mod-head">
              <strong>今晚改装</strong>
              <span className="rv-tag">
                {weaponDamage(state, state.weapon)} 伤害 · {weaponRange(state, state.weapon)} 射程
              </span>
            </div>
            {(Object.entries(WEAPON_MODS) as [string, (typeof WEAPON_MODS)['power']][]).map(
              ([id, mod]) => (
                <button
                  key={id}
                  className={`rv-mod-option${state.weaponMod === id ? ' current' : ''}`}
                  data-rv-mod={id}
                  aria-pressed={state.weaponMod === id}
                  onClick={() => cmd().rvMod(id)}
                >
                  {mod.name} · {mod.text}
                </button>
              ),
            )}
            <p className="rv-mod-note">改装在黎明后重置，只影响角色武器。</p>
          </div>
        ) : null}
        <p className="rv-section">装饰 · 只改变房车的样子</p>
        {decor.map(([id, furniture]) => (
          <RvCard key={id} id={id} furniture={furniture} />
        ))}
      </div>
      <button id="rv-lamp" aria-pressed={snap.rvLampOn} onClick={() => cmd().toggleLamp()}>
        床头灯 · {snap.rvLampOn ? '已开启' : '已关闭'}
      </button>
      <button id="leave-rv" className="primary" onClick={() => cmd().leaveRv()}>
        离开房车 · E / Esc →
      </button>
    </section>
  );
}
