# PINEFALL · 状态机与存档架构设计（ARC）

> 状态：设计已确认（2026-09-19），实现未开始；进度以 `DEVELOPMENT.md` 与代码/测试证据为准。
> 规则数值仍以 `src/rules.js` 为运行时唯一来源；本文定义状态边界、流转与存档格式。
> 依赖决策：引入 `xstate@5.33.2`，理由与代价见本文 §2，决策记录见 `GAME_DESIGN.md` §10。

## 1. 背景与问题

现有权威数据已部分集中：`src/rules.js` 的 `newGame()` 是初始状态，`buy/advance/choosePerk/expedition/upgrade/...` 是带合法性校验的纯函数，等价于 reducer。真正的缺口：

1. **权威数据不完整**：建筑在 `src/main.js` 的 `place()` 建造流程里是「数据 + Three.js mesh」混合对象（`mesh/light/growth/hit`），采集节点 `world.logs` 不在状态里，存档无从序列化。
2. **阶段是隐式状态机**：`state.phase` + `inside` + `paused` + `over` + `perkPending` 多个标志拼出流程，非法组合只能靠各处 `if` 兜底，没有单一事实来源。
3. **无序列化与版本迁移**：T6（黎明检查点存档）仍是 TODO，设计文档 §9 已定好存档边界与格式意图。

目标：单一可序列化权威数据树 + 显式合法流转 + 版本化 JSON 存档；表现层永远不是存档权威。

## 2. 选型：XState

- 引入 `xstate@5.33.2`（锁版本），只使用 `setup/createMachine/createActor` 这些核心 API。
- 未选 Redux/Zustand：核心需求是**合法流转与可恢复检查点**，不是组件订阅；本项目 UI 是原生 DOM，每帧直接读快照即可。
- 未选 ECS：规则是少量全局数据加实体列表，换范式会重写现有规则与渲染，收益不成比例。
- 代价：新增运行时依赖、构建体积增大（实现后实测并记录，不预写数字）；现有 `state.phase/paused` 读取点需分批迁移，本轮采用「保留 `state` 引用、增量替换」策略。
- 实现约束：不使用 `assign` 重建 context，避免破坏 `rules.js` 依赖的 `state` 对象引用；machine actions 直接调用规则函数修改该对象。`machine.js` 只导入 `setup/createMachine/createActor`。

## 3. 状态图

```
campaign = parallel(phase, overlay)

phase
  day (initial)
    ├─ outdoor (initial) --ENTER_RV--> interior
    ├─ interior          --EXIT_RV---> outdoor
    └─ START_NIGHT ---------------------------------> night
  night --CLEARED--> dawn | victory
  dawn  --CHOOSE_PERK--> day (day+1)
  victory (final)
  defeat  (final)
  any --CAMP_DESTROYED--> defeat

overlay
  none (initial) ⇄ paused / help / manual
```

- `phase` 管战役流程；`overlay` 管模态与暂停，两个区域并行，互不吞状态。
- 暂停是真暂停：`paused/help/manual` 打开时冻结时间与输入（同步写入 `state.paused`，规则函数继续用 `active(s)` 校验）。`PAUSE` 进入 `paused` 并记录 `state.manualPause=true`；`OPEN_HELP/OPEN_MANUAL` 只是弹窗暂停，不改 `manualPause`；关闭弹窗时若 `manualPause` 仍为真回到 `paused`，否则回到 `none`（对应现有 `setPause` 语义）。
- `dawn` 只存在于夜间清场且未通关时，专长选择必选、不可 Esc；选完进入下一天 `day.outdoor`。
- `victory/defeat` 为 final；重开由外部 `location.reload()` 或新战役处理，不在状态图内自环。

### 事件表

| 事件 | 触发点 | guard | action（调用 rules.js 纯函数） |
|---|---|---|---|
| `START_NIGHT` | 白天计时到点（`elapsed >= DAY_LENGTH`）或玩家点「迎接夜晚」 | 不在洞内/过渡中、非 `perkPending` | `advance(s)` → `phase='night'`、`beginNight()` 生成队列 |
| `CLEARED` | 玩家点「等待黎明」或自动清场检查 | `spawnQueue` 空且场上无存活 | `advance(s, true)` → 通关或第 `day+1` 天并 `perkPending` |
| `CHOOSE_PERK` | 专长卡确认 | `choosePerk` 合法 | 关闭模态、toast |
| `ENTER_RV` / `EXIT_RV` | E / 门口按钮 | 白天、非过渡中 | 镜头过渡、冻结/恢复日间预算 |
| `PAUSE` / `RESUME` | P / 弹窗开关 | 非 `over` | `setPause` 语义 |
| `CAMP_DESTROYED` | 任意 `damageCamp` 后 `health <= 0` | 营地确实归零且未通关 | 结局判定、`endGame()` |

说明：`elapsed` 仍由 rAF 每帧累加，到点后发送一次 `START_NIGHT`；不在每帧发送事件。设计文档 §2 的「战前确认界面」尚未实现，当前时间到点直接入夜；状态图通过独立 `START_NIGHT` 事件预留该界面，不在本轮预建 UI。读取存档不需要 `RESTORE` 事件：检查点只落在 day，直接用存档数据构造 context 后从 `day.outdoor` 启动（见 §6）。

## 4. 集成原则

1. **context 复用现有 `state` 对象**：`rules.js` 的函数签名与数值一行不改，作为 guards/actions 被 machine 调用；避免大规模重写与规则回归。
2. **单一写入者**：`state.phase` 只允许由 machine action 修改（经由 `advance` 等函数）；machine 的状态值与 `state.phase` 必须一致。`machine.js` 导出 `assertPhaseSync(snapshot)`，`startCampaign()` 启动时即校验，单测在全流程每步校验。
3. **每帧只读**：`actor.getSnapshot().matches(...)` 替换 `state.phase === ...`/`state.paused` 判断；只在离散操作与到点条件时 `send()`。
4. **订阅集中化**：`actor.subscribe` + 现有 `syncUI()` 驱动 UI/音频/镜头，替代散落的标志判断。
5. **场景副作用用 hook 注入**：`createCampaignMachine({ state, canClear, canEnterRV, onNightStart, onDawn, onVictory, onDefeat, onPerkChosen })`；machine 只负责合法流转与规则调用，不 import 场景代码，保证 Node 单测无 WebGL 依赖。
6. **表现与会话数据不入 context**：`enemies/shots/particles/keys/camera/zoom/ghost/rvTransition/interior 动画/音频实例/粒子池/夜生成队列与计时器` 都不放进状态；守卫所需的会话数据（如 `spawnQueue`）通过依赖注入或闭包供 machine 读取。仅 `paused/manualPause` 这类影响规则校验的会话标记留在 context 且存档时剔除（见 §5）。

## 5. 权威数据模型（存档 schema v1）

```
state = {
  ...newGame() 字段,
  buildings: [{ id, type, x, z, angle, level, hp, maxHp, invested }],
  logs:      [{ id, remaining }],
  nextBuildId: number,
  flags: { ...必要的进度标志 },
}
```

- `buildings` 是纯数据；场景层改为 `Map<id, { mesh, light }>` 注册表，渲染由数据驱动（建造/升级/拆除/读档重建）。mesh/材质/动画不属于状态。
- `logs` 由 `world.logs` 迁入状态；黎明恢复数量仍由规则决定。
- 专长、解锁、远征标记、资源、生命等沿用 `newGame()` 现有字段，不重复存。
- 明确非权威：Three.js 对象、敌人实例、粒子、输入、相机、音频、UI 开关（已持久化的设置项除外）。
- 会写入 context 但不进存档的会话字段：`paused`、`manualPause`（读档后一律重置为未暂停）；存档器负责剔除，规则函数仍可读它们。

## 6. 存档设计

- 格式（自有版本化 JSON，不使用 XState 内部结构）：

```json
{
  "version": 1,
  "savedAt": 1758300000000,
  "phase": "day",
  "state": { "...": "§5 的权威数据树" }
}
```

- **存档点**：仅在「新战役开始」与「黎明选择专长完成后的 day 状态」写入（对应设计文档 §9 边界）；战斗中退出回到本日黎明，不承诺原地续玩。
- **读取**：校验 `version` 与字段类型 → 逐版本迁移 → 用存档数据构造 context → `actor` 从 `day.outdoor` 启动 → 场景按数据重建。因为存档点永远在 day，**不需要恢复任意 XState 快照**，`phase` 字段只作校验；不兼容则走新战役流程。字段校验由 `src/save.ts` 的 `saveSchema`（zod v4）完成，版本迁移与双槽回退逻辑独立于 schema。
- **存储**：`localStorage` 双槽 `pinefall.campaign.current` / `pinefall.campaign.backup`，先写 backup 再写 current；容量不足或禁用时提示且不影响当前局。
- **异常**：current 损坏 → 尝试 backup；两者都失败 → 开新战役但**不覆写**损坏数据；`version` 高于当前版本 → 拒绝加载并提示，同样不覆写。
- **入口**：启动加载完成后进入首页（`src/home.js`）：开始新游戏 / 继续游戏（显示第 N 天 · 营地 % · 专长数）；已有存档时开始新游戏需二次点击确认覆盖。首页背景使用真实营地的标题镜头（黄昏、环绕、点击篝火溅火星），webdriver 自动化默认跳过首页，`?home=1` 强制显示以便测试。
- 桌面版原子文件替换与 Steam Cloud 冲突处理不在本轮范围。

## 7. 任务拆分

| ID | 任务 | 验收 |
|---|---|---|
| ARC-01 | `src/machine.js` + `tests/machine.test.js`：状态图、事件、guards/actions 骨架 | 合法/非法转移、与 `rules.js` 的 phase 同步均有 Node 单测；不接 `main.js`、不改行为 |
| ARC-02 | `main.js` 接入 actor：布尔标志迁移到 `snapshot.matches` | 现有 campaign/combat/interior/nights 浏览器回归全过，行为不变 |
| ARC-03 | 权威数据化：buildings/logs/进度进入 `state`，场景改 id→mesh 注册表 | 状态 JSON 往返一致；建造/升级/拆除/读档重建浏览器验证 |
| ARC-04 | `src/save.js` + 黎明检查点 + 继续入口 | 守到黎明→写入→刷新→继续，日数/资源/专长/建筑/倒木一致；坏档回退、高版本拒绝且不覆写 |

ARC-01..04 均已实现并标 `VERIFY`（待用户实机验收后转 `DONE`），T6 随 ARC-04 落地：

- ARC-01：`src/machine.js` + `tests/machine.test.js` 12 项；`startCampaign()` 启动即 `assertPhaseSync`。
- ARC-02：`main.js` 事件化（`START_NIGHT/CLEARED/CHOOSE_PERK/ENTER_RV/EXIT_RV/PAUSE/RESUME/OPEN_*/CLOSE_*/CAMP_DESTROYED`），`state.phase/paused` 由 machine 单一写入；campaign/combat/nights/nights-siege/feel/interior/rv 浏览器回归全过。
- ARC-03：`state.buildings`（纯数据 + id）与 `state.logs`（稳定 id），场景 `Map<id,{mesh,light}>`；save 往返与读档重建由 `tests/save.*` 验证。
- ARC-04：`src/save.js`（双槽、损坏回退、容量/版本处理）+ `tests/save.test.js` 6 项 + `tests/save.browser.js`（真实黎明写入、首页续玩、坏档回退、高版本拒绝）+ `tests/home.browser.js`（首页锁定输入、覆盖确认、移动端）。

## 8. 测试计划

- 规则/状态（Node 内置测试）：全部合法转移；非法转移被拒绝（夜间建造、洞内入夜、未清场入夜、非 dawn 选专长）；`elapsed` 到点、清场、营地归零三个触发；machine 状态与 `state.phase` 同步；存档 JSON 往返、迁移、损坏数据、高版本拒绝。
- 浏览器：更新 `tests/campaign.browser.js` 走完整 day→night→dawn 并以 machine 状态断言；新增 `tests/save.browser.js`（黎明写入、刷新续玩、坏档回退）；其余 `tests/*.browser.js` 作为回归。
- 不测真实 GPU 帧率；不把 headless 结果写成性能达标。

## 9. 风险与未决

- 体积：xstate 进入应用 bundle 后由构建产物记录增量；现有 >500 kB 警告不得被掩盖。
- 双写 phase：靠「单一写入者」规则与 ARC-01 同步断言控制；`advance()` 未拆分，职责仍由 rules.js 承担。
- 首页入口已定为标题页（用户要求），替代原「启动提示」待议项；首页观感待用户验收。
- XState 升级：锁 5.33.2；存档不依赖其内部结构，升级风险限于 API 而非旧档。
