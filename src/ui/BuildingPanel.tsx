// Selected-building actions: upgrade / repair / dismantle with costs and disabled reasons.
import {
  MAX_LEVEL,
  NAMES,
  REPAIR_WOOD,
  lanternRadius,
  refundValue,
  towerStats,
  upgradeCost,
} from '../rules.js';
import { cmd } from './store.js';
import { useUi } from './use-ui.js';

export function BuildingPanel() {
  const snap = useUi();
  const building = snap.selectedBuilding;
  if (!building) return null;
  const day = snap.state.phase === 'day';
  const cost = upgradeCost(building);
  const refund = refundValue(building);
  const stats =
    building.type === 'tower'
      ? `伤害 ${towerStats(building.level).damage} · 射程 ${towerStats(building.level).range}`
      : building.type === 'lantern'
        ? `减速半径 ${lanternRadius(building.level).toFixed(1)}`
        : '阻挡单路 · 为火力争取时间';
  return (
    <aside id="building-panel" aria-label="建筑操作">
      <button
        className="close"
        id="building-close"
        aria-label="关闭"
        onClick={() => cmd().closeBuildingPanel()}
      >
        ×
      </button>
      <span className="eyebrow" id="building-kind">
        CAMP STRUCTURE
      </span>
      <h3>
        <span id="building-name">{NAMES[building.type]}</span>
        <small id="building-level">Lv.{building.level}</small>
      </h3>
      <div className="health-track">
        <i
          id="building-hp"
          style={{ width: `${Math.max(0, (building.hp / building.maxHp) * 100)}%` }}
        />
      </div>
      <p id="building-stats">
        {stats} · 耐久 {Math.ceil(building.hp)} / {building.maxHp}
      </p>
      <div className="building-actions">
        <button
          id="building-upgrade"
          disabled={
            building.level >= MAX_LEVEL ||
            !day ||
            snap.state.wood < cost.wood ||
            snap.state.scrap < cost.scrap
          }
          onClick={() => cmd().upgradeBuilding()}
        >
          {building.level >= MAX_LEVEL
            ? '已满级'
            : `升级 Lv.${building.level + 1} · ▰${cost.wood} ⚙${cost.scrap}`}
        </button>
        <button
          id="building-repair"
          disabled={!day || building.hp >= building.maxHp || snap.state.wood < REPAIR_WOOD}
          onClick={() => cmd().repairBuilding()}
        >
          维修 · ▰{REPAIR_WOOD}
        </button>
        <button
          id="building-dismantle"
          className="danger"
          disabled={!day}
          onClick={() => cmd().dismantleBuilding()}
        >
          拆除 · 返还 ▰{refund.wood} ⚙{refund.scrap}
        </button>
      </div>
      <p className="building-note" id="building-note">
        {day ? '' : '夜间无法施工、维修或拆除。'}
      </p>
    </aside>
  );
}
