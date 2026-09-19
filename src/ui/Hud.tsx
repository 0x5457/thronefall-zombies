// In-game HUD: resources, day/night, tools, vitals, build bar, hints and status chips.
// Frame-projected chips (world label / gather prompt / level dots / RV door) are rendered
// empty here and positioned imperatively by main.ts to avoid 60fps React renders.
import { COSTS, DAY_LENGTH, GUIDANCE, NAMES, PERKS, canBuild, guidanceProgress } from '../rules.js';
import type { BuildingType } from '../rules.js';
import { cmd } from './store.js';
import { useUi } from './use-ui.js';

const BUILD_ORDER: BuildingType[] = ['fence', 'tower', 'lantern'];
const BUILD_KEY: Record<BuildingType, string> = { fence: '1', tower: '2', lantern: '3' };

function BuildCard({
  type,
  state,
  inside,
  selected,
}: {
  type: BuildingType;
  state: ReturnType<typeof useUi>['state'];
  inside: boolean;
  selected: BuildingType | null;
}) {
  const cost = COSTS[type];
  const disabled = inside || !canBuild(state, type);
  return (
    <button
      className={`build-card${selected === type ? ' selected' : ''}`}
      data-build={type}
      title={`${NAMES[type]}：消耗 ${cost} 木材`}
      disabled={disabled}
      onClick={() => cmd().selectBuild(type)}
    >
      <kbd>{BUILD_KEY[type]}</kbd>
      {type === 'fence' ? (
        <svg viewBox="0 0 64 48">
          <path d="M9 15h46v6H9zm0 14h46v6H9z" fill="#9e7953" />
          <path d="m13 9 4-5 4 5v34h-8zm15 0 4-5 4 5v34h-8zm15 0 4-5 4 5v34h-8z" fill="#c2a16e" />
        </svg>
      ) : type === 'tower' ? (
        <svg viewBox="0 0 64 48">
          <path d="M18 19h5l-3 25h-5zm23 0h5l3 25h-5zM20 27l24 12-2 3-24-12z" fill="#b89967" />
          <path d="M12 13h40v8H12zm4-9h3v13h-3zm29 0h3v13h-3zM16 7h32v3H16z" fill="#d7b77b" />
          <path d="M30 2h5v11h-5z" fill="#b66a45" />
        </svg>
      ) : (
        <svg viewBox="0 0 64 48">
          <path d="M23 43h17v3H23zm7-36h4v37h-4zm2-3h15v3H32zm12 1h2v9h-2z" fill="#b89967" />
          <path d="M40 14h10v13H40z" fill="#efd48d" />
          <path d="M39 12h12v3H39zm0 15h12v3H39z" fill="#665a42" />
        </svg>
      )}
      <strong>{NAMES[type]}</strong>
      <span>▰ {cost}</span>
    </button>
  );
}

export function Hud() {
  const snap = useUi();
  const { state, player, guidance } = snap;
  const audioEnabled = snap.audio.enabled && !snap.audio.locked;
  const progress = Math.min(100, (state.elapsed / DAY_LENGTH) * 100);
  const guide = guidance.skipped ? { step: 'done' as const, wood: 0 } : guidanceProgress(state);
  const guideStep = guide.step;
  const noteNumber =
    guideStep === 'done'
      ? String(state.day).padStart(2, '0')
      : String(guideStep === 'gather' ? 1 : guideStep === 'build' ? 2 : 3).padStart(2, '0');
  const noteTitle =
    guideStep === 'done'
      ? state.phase === 'day'
        ? '天黑之前，先安个家。'
        : '别让最后一束光熄灭。'
      : GUIDANCE[guideStep].title;
  const noteBody =
    guideStep === 'done'
      ? state.phase === 'day'
        ? '在空地建起防线。按 Tab 打开营地手册：工坊、远征与战前情报。'
        : `第 ${state.day} 夜 · 自动射击已就绪，守住房车直到黎明。`
      : guide.wood
        ? `${GUIDANCE[guideStep].body} · 可采木材 ▰${guide.wood}`
        : GUIDANCE[guideStep].body;

  const percent = (value: number): string => `${Math.round(value * 100)}%`;
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 40 44" aria-hidden="true">
            <path d="M20 2 8 20h7L4 35h13v7h6v-7h13L25 20h7Z" />
          </svg>
          <div className="brand-text">
            <h1>PINEFALL</h1>
            <p>松林余烬 · CAMPSITE 07</p>
          </div>
        </div>
        <div className="day-panel">
          <span id="phase-icon" aria-hidden="true">
            {state.phase === 'day' ? '☀' : '☾'}
          </span>
          <div className="day-copy">
            <strong id="day-label">
              {state.phase === 'day' ? 'DAY' : 'NIGHT'} {String(state.day).padStart(2, '0')}
            </strong>
            <span id="phase-label">
              {state.paused
                ? '时光暂停'
                : state.phase === 'day'
                  ? '午后 · 营地建设'
                  : `守夜 · 剩余敌人 ${snap.remaining + snap.enemiesAlive}`}
            </span>
          </div>
          <div className="day-track">
            <i
              id="day-progress"
              style={{ width: `${progress}%`, opacity: state.phase === 'day' ? 1 : 0 }}
            />
          </div>
        </div>
        <div className="tools">
          <button
            id="sound"
            title={audioEnabled ? '静音 · 音量在旁边设置' : '点击开启 8-bit 音乐与音效'}
            aria-label={audioEnabled ? '静音' : '开启音乐与音效'}
            aria-pressed={audioEnabled}
            onClick={() => cmd().toggleSound()}
          >
            ♫
          </button>
          <details className="audio-settings">
            <summary aria-label="音量设置" title="音量设置">
              ☷
            </summary>
            <div className="audio-panel">
              <strong>
                松林电台 <small>8-BIT</small>
              </strong>
              <label htmlFor="audio-master">
                总音量 <output id="audio-master-value">{percent(snap.audio.master)}</output>
              </label>
              <input
                id="audio-master"
                type="range"
                min={0}
                max={100}
                value={Math.round(snap.audio.master * 100)}
                onChange={(event) => cmd().setAudio('master', Number(event.target.value) / 100)}
              />
              <label htmlFor="audio-music">
                背景音乐 <output id="audio-music-value">{percent(snap.audio.music)}</output>
              </label>
              <input
                id="audio-music"
                type="range"
                min={0}
                max={100}
                value={Math.round(snap.audio.music * 100)}
                onChange={(event) => cmd().setAudio('music', Number(event.target.value) / 100)}
              />
              <label htmlFor="audio-sfx">
                动作音效 <output id="audio-sfx-value">{percent(snap.audio.sfx)}</output>
              </label>
              <input
                id="audio-sfx"
                type="range"
                min={0}
                max={100}
                value={Math.round(snap.audio.sfx * 100)}
                onChange={(event) => cmd().setAudio('sfx', Number(event.target.value) / 100)}
              />
              <p id="audio-status">
                {!snap.audio.enabled
                  ? '已静音'
                  : snap.audio.locked
                    ? '点击或按键后播放 · 设置自动保存'
                    : '8-bit 原创配乐 · 设置自动保存'}
              </p>
            </div>
          </details>
          <button
            id="photo"
            title="隐藏界面 · H"
            aria-label="隐藏界面"
            onClick={() => cmd().togglePhoto()}
          >
            ⌗
          </button>
          <button
            id="shake"
            title={snap.shakeEnabled ? '打击反馈 · 镜头震动已开启' : '打击反馈 · 镜头震动已关闭'}
            aria-label="镜头震动开关"
            aria-pressed={snap.shakeEnabled}
            onClick={() => cmd().toggleShake()}
          >
            ≈
          </button>
          <button
            id="pause"
            title="暂停 · P"
            aria-label="暂停"
            aria-pressed={state.paused}
            onClick={() => cmd().togglePause()}
          >
            {state.paused ? '▷' : 'Ⅱ'}
          </button>
          <button id="help" title="操作说明" aria-label="操作说明" onClick={() => cmd().openHelp()}>
            ?
          </button>
        </div>
      </header>

      <aside className="camp-status" aria-label="营地资源">
        <div className="resources">
          <span className="res" title="木材 · 建造与升级">
            <svg className="res-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 14.6h18v4.2H3z" fill="#8a5f38" />
              <path d="M3 9.2h18v4.2H3z" fill="#a97a48" />
              <ellipse cx="7.6" cy="11.3" rx="3.5" ry="3.3" fill="#d8b47c" />
              <ellipse cx="7.6" cy="11.3" rx="1.4" ry="1.3" fill="#a97a48" />
              <ellipse cx="7.6" cy="16.7" rx="3.5" ry="3.3" fill="#c9a06a" />
              <ellipse cx="7.6" cy="16.7" rx="1.4" ry="1.3" fill="#8a5f38" />
            </svg>
            <b id="wood">{state.wood}</b>
            <small>木材</small>
          </span>
          <span className="res" title="零件 · 工坊与高级升级">
            <svg className="res-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#b9c2a4"
                d="M13.9 2h-3.8l-.6 2.5a7.6 7.6 0 0 0-1.7 1L5.4 4.6 3.7 7.5l1.9 1.7a7.7 7.7 0 0 0 0 2L3.7 13l1.7 2.9 2.4-.9c.5.4 1.1.7 1.7 1l.6 2.5h3.8l.6-2.5c.6-.3 1.2-.6 1.7-1l2.4.9 1.7-2.9-1.9-1.7a7.7 7.7 0 0 0 0-2l1.9-1.7-1.7-2.9-2.4.9a7.6 7.6 0 0 0-1.7-1z"
              />
              <circle cx="12" cy="10.5" r="2.7" fill="#22372b" />
            </svg>
            <b id="scrap">{state.scrap}</b>
            <small>零件</small>
          </span>
          <span className="res" title="营地耐久 · 归零即失败">
            <svg className="res-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#e8b37a" d="M12 2 4 5v6.5c0 4.8 3.3 8.3 8 9.5 4.7-1.2 8-4.7 8-9.5V5z" />
              <path fill="#7a4a2c" d="M12 6.4 7.2 14h9.6z" />
              <path fill="#7a4a2c" d="M10.8 14h2.4v3.4h-2.4z" />
            </svg>
            <b id="health">{Math.ceil(state.health)}</b>
            <small>营地</small>
          </span>
          <span className="res" title="累计击退">
            <svg className="res-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#cfd3ba"
                d="M12 2C7.6 2 4.5 5.2 4.5 9.4v2.9c0 1.6.8 2.6 2 3.2v2.6c0 .9.7 1.6 1.6 1.6h.6v-2h2.4v2h1.8v-2h2.4v2h.6c.9 0 1.6-.7 1.6-1.6v-2.6c1.2-.6 2-1.6 2-3.2V9.4C19.5 5.2 16.4 2 12 2z"
              />
              <circle cx="8.9" cy="10.2" r="1.7" fill="#22372b" />
              <circle cx="15.1" cy="10.2" r="1.7" fill="#22372b" />
              <path fill="#22372b" d="M10.9 13.3h2.2l-1.1 2.1z" />
            </svg>
            <b id="kills">{state.kills}</b>
            <small>击退</small>
          </span>
        </div>
        <div className="health-track" title="营地耐久">
          <i id="health-bar" style={{ width: `${state.health}%` }} />
        </div>
        <p id="owned-perks" aria-live="polite">
          {state.perks.length
            ? `专长 · ${state.perks.map((id) => PERKS[id].name).join(' / ')}`
            : '专长 · 守过首夜后选择'}
        </p>
      </aside>

      <div id="toast" role="status" aria-live="polite" className={snap.toast.visible ? 'show' : ''}>
        {snap.toast.text}
      </div>
      <div id="hurt-flash" aria-hidden="true" />
      <div id="boss-bar" hidden={!snap.boss}>
        <strong id="boss-name">林中巨影</strong>
        <div className="boss-track">
          <i
            id="boss-hp"
            style={{
              width: snap.boss ? `${Math.max(0, (snap.boss.hp / snap.boss.maxHp) * 100)}%` : '0%',
            }}
          />
        </div>
      </div>
      <div id="radio-alert" hidden={!snap.radioAlert} aria-live="polite">
        {snap.radioAlert}
      </div>

      <div id="vitals" aria-label="角色状态">
        <span className="vital-portrait" title="巡林人" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path fill="#a9c076" d="M4.8 20.8c.7-3.2 3.5-5.1 7.2-5.1s6.5 1.9 7.2 5.1z" />
            <path
              fill="#f2c96b"
              d="M12 4.4a4.4 4.4 0 0 0-4.4 4.4v1.7a4.4 4.4 0 0 0 8.8 0V8.8A4.4 4.4 0 0 0 12 4.4z"
            />
            <path fill="#4a3421" d="M12 1.2 4.6 5.8l1.6 2.3L12 4.6l5.8 3.5 1.6-2.3z" />
            <path
              fill="#22372b"
              d="M10.3 8.6a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1zm3.4 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1z"
            />
          </svg>
        </span>
        <div className="vital-bars">
          <div className="vital-track hp" title="角色生命">
            <i id="player-hp" style={{ width: `${(player.hp / player.maxHp) * 100}%` }} />
            <b id="player-hp-text">{player.hp}</b>
          </div>
          <div className="vital-track stamina" title="体力 · Shift 冲刺">
            <i id="player-stamina" style={{ width: `${player.stamina}%` }} />
          </div>
        </div>
        <div className="vital-chips">
          <span id="weapon-chip" title="打开营地手册（Tab）切换武器">
            {player.weaponName}
          </span>
          <span id="medkit-chip" title="F 使用医疗包">
            ✚ {player.medkits}/{player.maxMedkits}
          </span>
          <span
            id="flare-chip"
            title="Q 信号弹减速敌人"
            className={player.flareReady ? 'ready' : 'cooling'}
          >
            {player.flareReady ? '✦ 就绪' : `✦ ${player.flareSeconds}s`}
          </span>
        </div>
      </div>

      <div id="world-label" className="world-label" />
      <div id="gather-prompt" hidden aria-live="polite" />
      <div id="building-level-dots" hidden aria-hidden="true" />
      <button id="rv-door" hidden aria-label="房车侧门交互" onClick={() => cmd().enterRv()} />

      <section className="bottom-ui">
        <div className="field-note">
          <span className="eyebrow">
            FIELD NOTES — <b id="note-number">{noteNumber}</b>
          </span>
          <h3 id="note-title">{noteTitle}</h3>
          <p id="note-body">{noteBody}</p>
          <button
            id="skip-guidance"
            hidden={guideStep === 'done'}
            type="button"
            onClick={() => cmd().skipGuidance()}
          >
            跳过引导
          </button>
          <button id="next-phase" onClick={() => cmd().nextPhase()}>
            {state.phase === 'day' ? '迎接夜晚' : '等待黎明'} <span>→</span>
          </button>
        </div>
        <div className="build-wrap">
          <div className="build-heading">
            <span>营 地 建 设</span>
            <small id="build-hint">
              {state.phase === 'night'
                ? '夜间无法建造 · 守住营地'
                : snap.selectedBuild
                  ? 'R 旋转 · Esc 取消'
                  : '选择建筑 · 点击空地放置'}
            </small>
          </div>
          <div className="build-bar">
            {BUILD_ORDER.map((type) => (
              <BuildCard
                key={type}
                type={type}
                state={state}
                inside={snap.inside}
                selected={snap.selectedBuild}
              />
            ))}
          </div>
        </div>
        <div className="controls-hint" aria-label="操作提示">
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </span>
            <span className="hint-label">移动 · 自动射击</span>
          </div>
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>E</kbd>
            </span>
            <span className="hint-label">采集 / 进入房车</span>
          </div>
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>Shift</kbd>
              <kbd>Q</kbd>
              <kbd>F</kbd>
            </span>
            <span className="hint-label">冲刺 / 信号弹 / 医疗包</span>
          </div>
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>Tab</kbd>
              <kbd>X</kbd>
            </span>
            <span className="hint-label">营地手册 / 换武器</span>
          </div>
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>N</kbd>
              <kbd>P</kbd>
              <kbd>H</kbd>
            </span>
            <span className="hint-label">昼夜 / 暂停 / 隐藏界面</span>
          </div>
          <div className="hint-row">
            <span className="hint-keys">
              <kbd>滚轮</kbd>
            </span>
            <span className="hint-label">拉近 / 拉远镜头</span>
          </div>
        </div>
      </section>
      <div id="photo-hint" hidden={!snap.photoMode}>
        H 恢复界面 · N 切换昼夜
      </div>
    </>
  );
}
