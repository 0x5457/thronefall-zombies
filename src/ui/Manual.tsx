// Camp manual: workshop (weapons), expeditions and pre-night intel. Content is computed
// from the rules state at render time; actions go through the command bridge.
import { useState } from 'react';
import {
  DAY_LENGTH,
  ENEMY_TYPES,
  EXPEDITIONS,
  LANES,
  WEAPONS,
  hasFurniture,
  maxHp,
  nightIntel,
  weaponDamage,
  weaponRange,
} from '../rules.js';
import type { WeaponId, WindDir, WindSpec, WindTier } from '../rules.js';
import { radioTimeline } from '../rv.js';
import { cmd } from './store.js';
import { useDialog } from './use-dialog.js';
import { useUi } from './use-ui.js';

type ManualTab = 'workshop' | 'expedition' | 'intel';
const TABS: [ManualTab, string][] = [
  ['workshop', '工坊'],
  ['expedition', '远征'],
  ['intel', '战前情报'],
];

// NGT-06 intel copy: the rules layer owns direction/tier/strength; only the labels live here.
const WIND_DIR_CN: Record<WindDir, string> = {
  N: '北',
  NE: '东北',
  E: '东',
  SE: '东南',
  S: '南',
  SW: '西南',
  W: '西',
  NW: '西北',
};
const WIND_TIER_CN: Record<WindTier, string> = { light: '弱', breeze: '中', strong: '强' };

interface ManualCardProps {
  title: string;
  tag: string;
  body?: string;
  stats?: string[];
  actionText?: string;
  disabled?: boolean;
  disabledText?: string;
  owned?: boolean;
  wind?: WindSpec;
  onAction?: () => void;
}

function ManualCard({
  title,
  tag,
  body,
  stats,
  actionText,
  disabled,
  disabledText,
  owned,
  wind,
  onAction,
}: ManualCardProps) {
  return (
    <section
      className={`manual-card${owned ? ' owned' : ''}`}
      data-wind={wind?.dir}
      data-wind-tier={wind?.tier}
    >
      <div className="card-head">
        <strong>{title}</strong>
        <span className="tag">{tag}</span>
      </div>
      {body !== undefined ? <p>{body}</p> : null}
      {stats ? (
        <div className="manual-stat-grid">
          {stats.map((stat) => (
            <span key={stat}>{stat}</span>
          ))}
        </div>
      ) : null}
      {actionText ? (
        <button className={onAction ? 'primary' : 'ghost'} disabled={!!disabled} onClick={onAction}>
          {actionText}
        </button>
      ) : null}
      {disabled && disabledText ? <p>{disabledText}</p> : null}
    </section>
  );
}

function WorkshopPage() {
  const snap = useUi();
  const state = snap.state;
  const bench = hasFurniture(state, 'workbench');
  return (
    <>
      {(Object.entries(WEAPONS) as [WeaponId, (typeof WEAPONS)[WeaponId]][]).map(([id, weapon]) => {
        const unlocked = state.unlocked.includes(id);
        const equipped = state.weapon === id;
        return (
          <ManualCard
            key={id}
            title={weapon.name}
            tag={equipped ? '使用中' : unlocked ? '已解锁' : '未解锁'}
            owned={equipped}
            body={weapon.text}
            stats={[
              `伤害 ${weaponDamage(state, id)}`,
              `射程 ${weaponRange(state, id)}`,
              `间隔 ${weapon.interval}s`,
            ]}
            actionText={equipped ? '已装备' : unlocked ? '装备' : '解锁并装备 · ⚙10'}
            disabled={
              equipped || (!unlocked && (!bench || state.scrap < 10 || state.phase !== 'day'))
            }
            disabledText={
              !unlocked && !bench
                ? '需要便携工作台：进入房车安装后才能解锁武器。'
                : !unlocked && state.phase !== 'day'
                  ? '只能在白天解锁武器。'
                  : !unlocked && state.scrap < 10
                    ? '零件不足（需要 ⚙10）· 远征可获得零件。'
                    : ''
            }
            onAction={() => (unlocked ? cmd().equipWeapon(id) : cmd().unlockWeapon(id))}
          />
        );
      })}
      {state.phase !== 'day' ? (
        <p className="empty">夜间无法在工坊解锁与更换武器，天亮后再来。</p>
      ) : null}
    </>
  );
}

function ExpeditionPage() {
  const snap = useUi();
  const state = snap.state;
  if (state.phase !== 'day')
    return <p className="empty">远征只能在白天出发。夜晚必须留在营地防守。</p>;
  return (
    <>
      {EXPEDITIONS.map((trip) => {
        const done = state.expeditionDay === state.day;
        const noTime = state.elapsed + trip.time >= DAY_LENGTH;
        const hurt = state.playerHp <= trip.injury;
        const reason = done
          ? '今天已经出发过一次，明天再来。'
          : noTime
            ? '剩余白天时间不足，无法完成这次行动。'
            : hurt
              ? '生命不足，先恢复再出发。'
              : '';
        return (
          <ManualCard
            key={trip.id}
            title={trip.name}
            tag={trip.tag}
            body={trip.text.replace(`耗时 ${trip.time} 秒`, `白天时间 −${trip.time} 秒`)}
            actionText={done ? '今日已完成' : '出发'}
            disabled={!!reason}
            disabledText={reason}
            onAction={() => cmd().runExpedition(trip.id)}
          />
        );
      })}
    </>
  );
}

function IntelPage() {
  const snap = useUi();
  const state = snap.state;
  const intel = nightIntel(state.day);
  const when = state.phase === 'day' ? '今晚' : '当前';
  return (
    <>
      <ManualCard
        title={`第 ${state.day} 夜 · ${intel.name}`}
        tag={when}
        body={intel.lesson}
        stats={[
          `木材 ▰${state.wood}`,
          `零件 ⚙${state.scrap}`,
          `营地 ${Math.ceil(state.health)}%`,
          `生命 ${Math.ceil(state.playerHp)}/${maxHp(state)}`,
          `瞭望塔 ${state.buildings.filter((b) => b.type === 'tower').length}`,
          `医疗包 ✚${state.medkits}`,
        ]}
      />
      <ManualCard
        title={`今晚风：${WIND_DIR_CN[intel.wind.dir]}风 · ${WIND_TIER_CN[intel.wind.tier]}`}
        tag="风向"
        body={intel.wind.note}
        wind={intel.wind}
      />
      {intel.fog ? (
        <ManualCard
          title={`浓雾 · 能见度 ${Math.round((1 - intel.fog) * 100)}%`}
          tag="环境"
          body="灯光与信号弹的照亮范围缩小；潜行者在灯外几乎不可见，腐吐者借雾远程腐蚀建筑。"
        />
      ) : null}
      <ManualCard title="应对建议" tag="战术" body={intel.advice} />
      {intel.groups.map(([type, count, lane, , intent], index) => {
        const def = ENEMY_TYPES[type];
        return (
          <ManualCard
            key={`${type}-${lane}-${index}`}
            title={`${def.name} ×${count}`}
            tag={`${LANES[lane]} · ${intent || '来袭'}`}
            body={`${def.note} · 生命 ${def.hp} · 速度 ${def.speed}${def.armor ? ` · 护甲 ${def.armor}` : ''}`}
          />
        );
      })}
      {hasFurniture(state, 'radio') ? (
        radioTimeline(state).map((card) => (
          <ManualCard key={card.title} title={card.title} tag={card.tag} stats={card.rows} />
        ))
      ) : (
        <ManualCard
          title="短波电台"
          tag="房车 · 未安装"
          body="安装短波电台后，这里会显示今晚的生成时间轴，并在夜战 HUD 标出下一路来敌与倒计时。"
        />
      )}
    </>
  );
}

export function ManualDialog({ open }: { open: boolean }) {
  const ref = useDialog(open);
  const [tab, setTab] = useState<ManualTab>('workshop');
  return (
    <dialog
      id="manual-dialog"
      ref={ref}
      aria-labelledby="manual-title"
      onCancel={(event) => {
        event.preventDefault();
        cmd().closeManual();
      }}
      onClose={() => {
        if (open) cmd().closeManual();
      }}
    >
      <button
        className="close"
        id="manual-close"
        aria-label="关闭"
        onClick={() => cmd().closeManual()}
      >
        ×
      </button>
      <span className="eyebrow">CAMP MANUAL · 白天的准备</span>
      <h2 id="manual-title">营地手册</h2>
      <div className="manual-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            data-manual-tab={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="manual-page" id="manual-page" role="tabpanel">
        {tab === 'workshop' ? (
          <WorkshopPage />
        ) : tab === 'expedition' ? (
          <ExpeditionPage />
        ) : (
          <IntelPage />
        )}
      </div>
      <p className="manual-foot">
        打开手册不会消耗准备时间 · <kbd>Tab</kbd> 或 <kbd>Esc</kbd> 关闭
      </p>
    </dialog>
  );
}
