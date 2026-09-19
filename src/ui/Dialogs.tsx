// Help / pre-night confirmation / dawn reward / end-of-campaign dialogs. Dialog open state is
// React-controlled; the campaign machine stays the authority for overlays (help/manual/confirm).
import { ENEMY_TYPES, LANES, PERKS, hasFurniture, nightIntel } from '../rules.js';
import { radioTimeline } from '../rv.js';
import { cmd } from './store.js';
import { useDialog } from './use-dialog.js';
import { useUi } from './use-ui.js';

export function HelpDialog({ open }: { open: boolean }) {
  const ref = useDialog(open);
  return (
    <dialog
      id="help-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        cmd().closeHelp();
      }}
      onClose={() => {
        if (open) cmd().closeHelp();
      }}
    >
      <button className="close" aria-label="关闭" onClick={() => cmd().closeHelp()}>
        ×
      </button>
      <span className="eyebrow">WELCOME TO THE WOODS</span>
      <h2>守住这一点温暖。</h2>
      <p>
        白天探索松林、收集木材，沿营地外围建造防御。入夜后，抵挡从小径涌来的不速之客，保护房车。
      </p>
      <dl>
        <dt>WASD / 方向键</dt>
        <dd>移动角色，靠近敌人自动射击</dd>
        <dt>Shift / Q / F</dt>
        <dd>冲刺（消耗体力）/ 信号弹（减速）/ 医疗包</dd>
        <dt>Tab / X</dt>
        <dd>营地手册（工坊 · 远征 · 情报）/ 快速切换武器</dd>
        <dt>E</dt>
        <dd>收集木材 / 白天在房车侧门进入；室内 E 或 Esc 离开</dd>
        <dt>1 / 2 / 3</dt>
        <dd>选择建筑，点击空地建造；点击已建建筑可升级 / 维修 / 拆除</dd>
        <dt>R / Esc</dt>
        <dd>旋转建筑 / 取消选择</dd>
        <dt>N / P / H</dt>
        <dd>切换昼夜 / 暂停 / 隐藏界面</dd>
        <dt>鼠标滚轮</dt>
        <dd>拉近或拉远镜头</dd>
        <dt>♫ / ☷</dt>
        <dd>静音开关 / 音量设置；首次操作后播放昼夜配乐</dd>
      </dl>
      <button id="help-start" className="primary" onClick={() => cmd().closeHelp()}>
        回到营火旁 →
      </button>
    </dialog>
  );
}

export function PerkDialog() {
  const snap = useUi();
  const ref = useDialog(snap.perk.open);
  return (
    <dialog
      id="perk-dialog"
      ref={ref}
      aria-labelledby="perk-title"
      aria-describedby="perk-summary"
      onCancel={(event) => event.preventDefault()}
    >
      <span className="eyebrow">DAWN REWARDS · A LITTLE STRONGER</span>
      <h2 id="perk-title">又守住了一束光。</h2>
      <p id="perk-summary">{snap.perk.summary}</p>
      <div id="perk-options">
        {snap.perk.options.map((perk) => (
          <button key={perk.id} data-perk={perk.id} onClick={() => cmd().choosePerk(perk.id)}>
            <strong>{perk.name}</strong>
            <span>{perk.text}</span>
          </button>
        ))}
      </div>
      <p className="perk-footnote">
        选择一项永久专长，随后开始新一天的准备。已拥有的专长不会重复出现。
      </p>
    </dialog>
  );
}

export function EndDialog() {
  const snap = useUi();
  const ref = useDialog(snap.end.open);
  return (
    <dialog id="end-dialog" ref={ref} aria-labelledby="end-title">
      <span className="eyebrow">{snap.end.eyebrow}</span>
      <h2 id="end-title">{snap.end.title}</h2>
      <p id="end-text">{snap.end.text}</p>
      <button id="restart" className="primary" onClick={() => cmd().restart()}>
        重新扎营 →
      </button>
    </dialog>
  );
}

// NGT-05: the day timer expiring opens this briefing instead of starting the night.
// Enter or the primary button commits; Escape or the ghost button returns to the day.
export function NightConfirmDialog({ open }: { open: boolean }) {
  const ref = useDialog(open);
  const snap = useUi();
  const state = snap.state;
  const intel = nightIntel(state.day);
  const timeline = radioTimeline(state);
  const towers = state.buildings.filter((b) => b.type === 'tower').length;
  const fences = state.buildings.filter((b) => b.type === 'fence').length;
  const lanterns = state.buildings.filter((b) => b.type === 'lantern').length;
  return (
    <dialog
      id="confirm-dialog"
      ref={ref}
      data-day={state.day}
      data-night={intel.name}
      data-wind={intel.wind.dir}
      data-wind-tier={intel.wind.tier}
      data-fog={intel.fog ?? 0}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-lesson"
      onCancel={(event) => {
        event.preventDefault();
        cmd().cancelNight();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          cmd().confirmNight();
        }
      }}
      onClose={() => {
        if (open) cmd().cancelNight();
      }}
    >
      <span className="eyebrow">FINAL CALL · 第 {state.day} 夜</span>
      <h2 id="confirm-title">{intel.name}</h2>
      <p id="confirm-lesson">{intel.lesson}</p>
      <div className="confirm-grid">
        <section id="confirm-intel">
          <h3>今晚情报</h3>
          {intel.fog ? (
            <p className="confirm-fog">浓雾 · 能见度 {Math.round((1 - intel.fog) * 100)}%</p>
          ) : null}
          <ul className="confirm-groups">
            {intel.groups.map(([type, count, lane, , intent], index) => (
              <li
                key={`${type}-${lane}-${index}`}
                data-enemy={type}
                data-count={count}
                data-lane={lane}
                data-intent={intent || '来袭'}
              >
                <strong>
                  {ENEMY_TYPES[type].name} ×{count}
                </strong>
                <span>
                  {LANES[lane]} · {intent || '来袭'} · {ENEMY_TYPES[type].note}
                </span>
              </li>
            ))}
          </ul>
          <p id="confirm-wind">{intel.wind.note}</p>
          <p id="confirm-advice">{intel.advice}</p>
          {timeline.length ? (
            <div id="confirm-timeline">
              {timeline.map((card) => (
                <p key={card.title}>
                  <strong>{card.title}</strong>
                  <span>{card.rows.join(' · ')}</span>
                </p>
              ))}
            </div>
          ) : null}
        </section>
        <section id="confirm-prep">
          <h3>当前准备</h3>
          <dl className="confirm-stats">
            <dt>木材</dt>
            <dd id="confirm-wood">{state.wood}</dd>
            <dt>零件</dt>
            <dd id="confirm-scrap">{state.scrap}</dd>
            <dt>营地耐久</dt>
            <dd id="confirm-health">{Math.ceil(state.health)}%</dd>
            <dt>瞭望塔 / 栅栏 / 营地灯</dt>
            <dd id="confirm-defenses">
              {towers} / {fences} / {lanterns}
            </dd>
            <dt>已选专长</dt>
            <dd id="confirm-perks">
              {state.perks.length ? state.perks.map((id) => PERKS[id].name).join(' / ') : '暂无'}
            </dd>
          </dl>
          {hasFurniture(state, 'radio') ? null : (
            <p className="confirm-hint">安装短波电台后，这里会附带今晚的生成时间轴。</p>
          )}
        </section>
      </div>
      <div className="confirm-actions">
        <button id="confirm-cancel" onClick={() => cmd().cancelNight()}>
          返回白天
        </button>
        <button id="confirm-start" className="primary" onClick={() => cmd().confirmNight()}>
          确认开战 →
        </button>
      </div>
      <p className="confirm-foot">
        返回白天后仍可继续建设与采集；按 <kbd>Enter</kbd> 开战 · <kbd>Esc</kbd> 返回。
      </p>
    </dialog>
  );
}
