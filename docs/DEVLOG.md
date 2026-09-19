# PINEFALL 开发日志

## 2026-09-19 · 上手冲刺批 1 落地（WLD-03、FBK-01/02、WLD-02）+ ECO-01
**变更**
- WLD-03a：`rules.ts` 新增 `GuidanceStep`/`GUIDANCE`/`guidanceStep`/`guidanceProgress`，引导状态只从 `state.logs`/`state.buildings`/`phase` 派生（不新增存档字段）；`WAVES[0].hint` 被引导文案消费（FIX-02 部分）。
- WLD-03b/c：目标卡按三步（采木→建塔→迎战）显示文案与剩余可采木材、最近倒木高亮 + `E 采集木材 · 剩余 n`、跳过引导；首夜提示“站到北径路口”。
- FBK-01：`GATHER = { reach: 3, swing: 0.45, hitAt: 0.28, cooldown: 0.35, perSwing: 10 }`；`collectLog` 原子结算；0.45s 砍伐动作（锁移动/防重复）、0.28s 结算、0.35s 冷却、木质粒子、`chop` 砍击音效、倒木逐次缩短/采空树桩/黎明恢复（`setLogState`）。
- FBK-02：暂停/模态/房车过渡冻结动作与冷却；reduced-motion 下动效降幅但结算不吞。
- WLD-02：`world.ts` 塔/灯/栅栏三级剪影级差异（塔 5.55→6.50→7.92 高、双旗/发光信标；灯 3.16→3.68→5.72；栅栏 1.62→1.82→2.40）；选中建筑世界内显示 1–3 等级点。
- ECO-01：`START_SUPPLIES` 25 木/6 零件、`DAWN_SUPPLIES` +25/+5（拾荒 +10/+3）、`LOG_SWINGS = 3`；`tests/economy.test.ts` 冻结“开局买不起塔、一处倒木凑不齐塔+灯+栅栏”的约束。
- 诊断：`window.__pinefall.stats` 新增 `guidance`/`collecting`/`collectCooldown`/`logsRemaining`/`levelDots`。

**集成修复（本会话直接修，非 agent 产物）**
- `src/world.ts`：倒木初值 `remaining: 4` → `freshLogSwings()`，`setLogState` 比例分母改用 `freshLogSwings()`（否则 3 次采完仍不推进引导）。
- `src/building-view.ts`：`refit` 补回 `mesh.userData.building = b`（升级后点选失效的真实缺陷）。
- 测试同步：`campaign`/`victory` 改为真实 UI 采集+远征筹资（不注入）；`audio` 建造用例改用 10 木营地灯；`victory` 第 5 夜前用真实收入升级首塔（原策略在 ECO-01 后第 5 夜营地归零）。

**验证（实际执行）**
- `vp check`：71 文件格式、61 文件 0 lint/类型错误；`vp test`：14 文件 72/72（新增 `guidance.test.ts`、`economy.test.ts`）；`vp build` 通过（1066.69 kB / gzip 310.32 kB，含并行 React UI 迁移）。
- 浏览器：`scripts/browser-tests.ts` 对 4173 预览 16/16 PASS；`audio`/`occlusion` 按既有约定对 5173 dev 单独 PASS；`death`（T14，并行会话）单独 PASS（protection 2.40s）。
- `tests/gather.browser.ts`（新增）：真实按键断言动作锁移动、一次 +10、冷却拒绝、暂停冻结、引导三步推进、等级点 L1→L3 昼夜显隐。
- `tests/victory.browser.ts`：五夜真实通关 PASS（第 5 夜 health 56–100、kills 102）。
- 截图：`artifacts/gather-prompt-day.png`、`gather-swing.png`、`wld02-levels-l1/l2/l3.png`、`wld03-guidance-day/night.png`；已查看 L1/L3 对比与目标卡，剪影差异与提示可读。

**未完成 / 下一步**
- 待用户实机验收“前 3 分钟是否知道做什么、采集与升级是否有反馈”；`chop` 音效未做人耳试听；真实 GPU 帧率未测。
- ECO-01 第 5 夜余量（health 56）偏薄，待用户实机后决定是否微调；`MEDKIT_CAP` 仍未消费（FIX-02 剩余）。
- 并行会话的 React UI 迁移与本轮改动已在同一构建中共存并通过全套浏览器回归。

## 2026-09-19 · 全量 UI React 化
**变更**
- 新增 `src/ui/`：`store.ts`（`UiSnapshot` + `createUiStore` + `installCommands`/`cmd` 命令桥）、`App.tsx`（`UiApp`/`mountUi`，用 `@xstate/react` 的 `useSelector` 订阅 help/manual overlay）、`Hud.tsx`（顶栏/昼夜/工具/音效设置/资源/角色条/建造栏/操作提示/Toast/Boss/电台/引导笔记/投影元素空壳）、`BuildingPanel.tsx`、`Manual.tsx`（工坊/远征/情报）、`RvPanel.tsx`（功能/装饰槽、改装、床头灯、离开）、`Dialogs.tsx`（帮助/专长/结局）、`use-ui.ts`、`use-dialog.ts`。
- `main.ts`：删除 `hud` 与全部面板/对话框的 DOM 渲染（`renderBuildingPanel`、`manualCard`/`renderManual`、`openPerks` DOM、`endGame` DOM、`syncAudioUI`、`#building-*`/`#manual-*`/`#help-*`/`#next-phase`/`#photo`/`#pause`/`#sound`/`#shake`/`#restart` 监听），改为 `uiStore.set(...)` 推送快照 + `installCommands({...})` 提供动作；投影元素（world-label/gather-prompt/building-level-dots/rv-door）保留逐帧样式写入并做 null 保护。
- `src/rv.ts` 重写为纯 helper：`refreshInterior`（Three 套件同步）、`radioTimeline`、`radioAlert`；`src/hud.ts` 删除。`index.html` 仅保留 canvas/vignette/rv-fade/loading/script（删除 ~13.5 KB 静态 UI）。
- `ui-fx.ts` 的 MutationObserver 在 React 文本更新下仍生效（characterData 变更）。

**验证（实际执行）**
- `vp check` 61 文件格式/lint/类型全绿；`vp test` 14 文件 72/72；`vp build` 通过：1066.69 kB / gzip 310.32 kB。
- 浏览器 PASS（dev 5175，`TEST_CONCURRENCY=1`）：home、combat、rv、interior、ambience、nights、nights-siege、save、feel、expanded-map、occlusion。
- 一次性脚本验证黎明→专长→入夜：`perkPending=true` → 点击 `[data-perk]` → `#perk-dialog` 关闭、`paused=false` → 按 N 后 `phase=night`。
- 失败且不归因本轮：`campaign`/`audio`（开局木材改为 25，塔 35 无法购买；并行 ECO-01 与旧测试期望不一致）、`victory`/`gather`/`death`（并行会话正在迭代的新测试，文件时间戳在迁移期间持续变化）；未修改其代码与测试。
- 截图：测试刷新 `home-title.png`、`combat-building-panel.png`、`combat-manual-workshop.png`、`rv-slots-day.png` 等；已查看建筑面板、手册、首页，React 输出与旧 DOM 版一致。

**未完成 / 下一步**
- `rules.ts` 显示文案（NAMES/WAVES/PERKS/RV_FURNITURE/EXPEDITIONS 等）改为 id + locale，浏览器测试中文断言同步改 key。
- 加载遮罩保留静态 HTML（先于 JS 显示，避免白屏），如需 React 化需先设计 SSR/内联首屏方案。
- 并行经济改动落地后，由对应会话同步 campaign/audio/victory/gather/death 测试；本轮不代改。

## 2026-09-19 · 浏览器测试提速：硬件渲染 + 时间缩放 + 并行
**背景**
- 用户反馈「运行测试很慢」：单测 `vp test` 仅约 0.4s、`vp check` 约 2s，慢的是 `tests/*.browser.ts`（全量 >10 分钟；`home` 37s、`combat` 94s、`victory` 约 13 分钟）。实测根因：Playwright 启动的 `/usr/bin/chromium` 走 SwiftShader 软件渲染，游戏仅 7–13fps，所有实时等待与键盘走动被拖慢 4–8 倍。

**变更**
- 渲染：全部 `tests/*.browser.ts` 的 `chromium.launch` args 增加 `--use-angle=vulkan --enable-features=Vulkan`。本机实测 `WEBGL_debug_renderer_info` 从 SwiftShader 变为 `ANGLE (NVIDIA GeForce RTX 4060 Ti)`，FPS 13.3 → 60.6；无 Vulkan 环境由 ANGLE 回退软件渲染，CI 只跑 check/test/build，不受影响。
- 时间缩放：`src/main.ts` 新增诊断用 `simSpeed`（`window.__pinefall.setSpeed(n)`，0.1–20，返回实际值；`src/global.d.ts` 同步类型）。主循环把 `dt×倍率` 拆成每片 ≤0.05s 的子步调用原模拟代码，低帧率/高倍率下碰撞与 AI 步长仍与单帧上限一致；`playerInvuln` 随时长同步衰减。倍率只影响运行时，不进存档、不改规则；1 为发行速度。
- 夜间用例接入：`campaign`/`save`/`nights` 20x、`feel`/`nights-siege` 10x、`victory` 8x（`death.browser.ts` 由并行会话自行使用 20x）。`campaign` 在断言第二夜 `remaining===16` 前恢复 1x：20x 下刷怪表会在读数前消耗 2 个名额。
- `scripts/browser-tests.ts`：顺序执行改为并发 worker 池，默认 3（`TEST_CONCURRENCY` 覆盖）；filter 支持逗号分隔列表；每文件输出缓冲后按完成顺序打印，PASS/FAIL 带单测耗时；汇总保留退出码。

**验证（实际执行）**
- `vp check` 62 文件全绿；`vp test` 14 文件 72/72（并行会话继续改测试期间取样）。
- 硬件渲染后单测耗时：`expanded-map` 178→26s、`home` 37→12s、`nights` →12s、`feel` →14s、`interior` →28s、`occlusion` →18s、`rv` →15s、`victory` 13min→105s、`campaign` 约 4–5min→25s、`save` 约 5min→23s、`combat` →43s。
- 全量 `node scripts/browser-tests.ts`（并发 3、15 个文件）2m19s；10/15 PASS。5 个失败均来自并行会话当前 WIP 工作树（构建预览与 dev 同一构建：塔建造按钮 `disabled`、`audio` 模块迁移、`death` 新用例 120s 超时），非本轮改动；本轮基础设施在 17:53 稳定快照上逐项跑过：campaign/save/nights/nights-siege/feel/victory/expanded-map 全 PASS。
- 冲突提示：同一工作树并行改 `src/` 时，dev server 的 Vite HMR 会在测试中途整页重载（既有记录），全量建议对 `vp preview` 稳定构建运行；`audio`/`occlusion` 仍需 5173 dev 的源码模块导入。

**未完成 / 下一步**
- 并行会话 WIP 稳定后复跑全量并归因 5 个失败用例；`death.browser.ts` 尚未纳入全面 PASS 记录。
- 走动用例仍为实时键盘驱动（GPU 下 `expanded-map` 26s 已可接受）；若继续压缩，可考虑统一 walk 助手或在页面内快进模拟。

## 2026-09-19 · 组件解耦重构 + React/i18next/Tweakpane 引入
**变更**
- 组件解耦（行为不变重构）：新增 `src/gfx.ts`（mat/mesh/box/beam 与共享几何，world/interior/main 平级依赖）、`src/dom.ts`（`$`/`maybe`/`el`，替换 main/rv/home 三套手写 helper）、`src/rng.ts`（`seeded` 从 world 移出共享）、`src/building-view.ts`（`BuildingViews` 统一建筑 mesh/灯/生长/受击动画，消除 `place`/`refitBuilding`/`syncBuildingScene` 三份重复）、`src/hud.ts`（资源/昼夜/建造栏/暂停/角色条/声音/Boss 条渲染；`syncUI` 退化为聚合视图数据并调用）。`updateRvGlow` 从 `rv.ts` 移到 `world.ts`，删除 `world as unknown as RvGlowHost` 强转与 rv.ts 里重复的 glow 结构类型。`index.html` 移除第二个入口 `<script src="/src/ui-fx.js">`，改为 main.ts 导入 `ui-fx.js`。
- 规则数值回迁 `rules.ts`（AGENTS：数值唯一来源）：新增 `BUILDING_STATS`（占地 r / 放置半径 placeRadius / 基础耐久 hp）、`TOWER`、`LANTERN` 与 `towerStats(level)`/`lanternRadius(level)`/`lanternSlow(level)`；`LANE_SPAWNS` 移到 `map.ts`；`main.ts` 删除这些公式与硬编码。新增单测：塔/灯成长单调且封顶、`LANE_SPAWNS` 全部可走且与 `LANES` 等长。
- 依赖引入（用户确认三项选型）：运行时 `react@19.3.0`、`react-dom@19.3.0`、`i18next@26.4.2`、`react-i18next@17.0.14`；开发期 `@vitejs/plugin-react@6.1.1`、`tweakpane@4.0.5`、`@tweakpane/core@2.0.5`（提供 tweakpane 类型，tweakpane 包自身未声明该依赖）。`tsconfig` 增加 `jsx: react-jsx`，`vite.config.ts` 挂 `react()`。`@xstate/react` 已选型、待 HUD React 化时安装；`react-router` 明确不引入。
- React 首页：`src/home.tsx` 用 React 岛重写（`useSyncExternalStore` 小 store + `createHome` 命令式 API 不变、CSS 类名与 `#home` 结构不变、双确认/覆盖/隐藏逻辑保持），删除 `src/home.ts`；`main.ts` 导入 `./home.js` 由 Vite/TS 解析到 `.tsx`，构建与测试通过。
- i18n：`src/i18n.ts` + `src/locales/zh.json`/`en.json`，i18next 资源静态打包（满足离线发行），默认 zh、fallback zh；首页全部文案已迁移（`home.*`），规则/HUD 文案待对应 React 化时按 id + locale 迁移。
- Tweakpane：`src/dev-tune.ts` 仅在 DEV 且 `?tune=1` 时挂载，绑定建筑造价/耐久/占地、塔灯成长、冲刺/信号弹、三种武器、六种敌人；监听 keydown/keyup 阻止游戏热键；main.ts 用 `if (import.meta.env.DEV) void import('./dev-tune.js')` 守卫。

**验证（实际执行）**
- `vp check` 新增/修改文件级全绿（10 文件格式、8 文件 lint/类型）；仓库全量 check 为红，来自并行会话未完成的引导/采集改动（`main.ts` 未使用的 `setLogState` 导入、`PinefallStats` 缺 `guidance/collecting/collectCooldown/logsRemaining/levelDots`），本轮未代改。
- `vp test` 13 文件 67/67（含并行新增）。
- `vp build` 通过：1045.95 kB / gzip 304.29 kB（引入 React+i18next 前 772.94 / 218.09；+273.0 kB raw / +86.2 kB gzip）；`rg` 验证 `dist/assets/*.js` 不含 `tweakpane` 字符串。
- 浏览器：`home.browser.ts` PASS（React 首页行为一致，含无存档禁用/覆盖二次确认/移动端），`combat.browser.ts` PASS；中途一次 home 失败经复跑 PASS，归因并行写文件触发的 Vite 重载（与 DEVELOPMENT 既有记录一致）。
- 调参面板实机验证：Chromium 打开 `?tune=1`，面板挂载、六个分组可见、无页面错误；截图 `artifacts/dev-tune-panel.png`（已查看）。

**未完成 / 下一步**
- HUD/建筑面板/手册/专长/结算 React 化并接入 `@xstate/react`；随后迁移 `rules.ts` 显示文案（NAMES/WAVES/PERKS/RV_FURNITURE/EXPEDITIONS）为 id + locale，并同步 `nights.browser.ts` 等中文断言。
- React+i18next 已使主包 +86 kB gzip；T12 性能基线前评估按屏懒加载，或对首页/游戏 UI 分 chunk。
- 尚未解的耦合：环境动画仍在 main.ts 直接访问 world 内部（lightWire/pendants/flames/halo/waterMat），角色/敌人模型动画仍走 `mesh.userData`；按组件独立目标，后续抽 `environment`/`enemy-view` 模块。
- 本轮为行为不变重构 + 首页迁移，无游戏画面改动，未保存新游戏截图（首页截图由测试更新）。

## 2026-09-19 · 上手冲刺规划（文档轮，代码未动）
**背景**
- 用户反馈：升级防御塔外观没变化；采集粗糙（按 E 无动画无音效）；核心问题是“塔防感觉不好玩、第一时间没有上手欲望”。
- 代码核对：升级模型确有变化但默认镜头不可辨（`world.ts:517` 只加横梁/第二旗/金星顶）；采集音效存在（`audio.ts:474` `collect` 轻琶音）但 `collect()`（`main.ts:957`）为瞬时结算，无角色动作、倒木无状态变化；首日引导 WLD-03 与 ECO-01/02/03 均为 TODO，`WAVES[].hint` 无消费者。

**变更（仅文档）**
- `GAME_DESIGN.md`：§4 升级外观改为剪影级差异 + 世界内 1–3 等级点，T8 现状交由 WLD-02 修正；§4/§5 写入 ECO-01 初始数值（新局 25 木 / 6 零件、黎明 +25/+5、倒木 3×10）；§5 新增采集闭环（`GATHER`：0.45s 动作、0.28s 结算、0.35s 冷却、倒木逐次缩短/黎明恢复）；§8 首日引导改为三步（采木→建塔→迎战）与派生状态、跳过方式；§8 采集音效验收口径；§7 手感引用采集闭环。
- `ROADMAP.md`：§1 诊断表补入“开局没有目标 / 采集太弱 / 升级不可辨 / 回归入口”四行；Phase 2 ECO-01 写明初始值；Phase 6 拆出 WLD-03a/b/c，WLD-02 重定义为升级外观可读性；Phase 8 FIX-02 注明 `hint` 由 WLD-03a 消费；新增 Phase 9（FBK-01/02 采集反馈、TST-01 浏览器测试入口）；M1 纳入 Phase 9。
- `DEVELOPMENT.md`：新增“上手冲刺计划”小节（两批、执行顺序、完成门槛）；T11 改指向 WLD-03a/b/c；T8 备注外观差异过小；任务表更新 WLD-01/02/03a-c、FBK-01/02、TST-01；下一步重排为批 1 → 批 2；已知缺口补第 7 条。

**验证（实际执行）**
- 本轮仅文档变更，未改代码、未运行测试；所有引用均来自对 `src/`、`tests/`、`index.html` 的静态核对（升级模型 `world.ts:475-547`、采集 `main.ts:957-981`、音效表 `audio.ts:454-522`、波次 `rules.ts:351-405`、新局资源 `rules.ts:495-524`）。

**未完成 / 下一步**
- 按顺序执行：WLD-03a → WLD-03b → WLD-03c → FBK-01 → FBK-02 → WLD-02 → TST-01 → ECO-01；每项遵守“规则单测 + 浏览器验证 + 截图 + 文档”闭环。
- 批 1 完成后请用户实机验收“前 3 分钟是否知道做什么、采集与升级是否有反馈”，再决定是否进入 NGT-05 战前确认。

## 2026-09-19 · ARC-01 图模型测试（@xstate/graph）与旧测试清理
**变更**
- 依赖：新增 `@xstate/graph@3.0.4`（devDependency，peer `xstate ^5.19.4`，与 5.33.2 兼容）；仅测试期使用，不进应用 bundle。
- 新增 `tests/machine-graph.test.ts`：① `toDirectedGraph` 冻结 campaign phase/overlay 全部节点与边；② 9 个真实场景快照（新局 / RV 内 / 手动暂停 / 夜间 / 黎明 / 第五夜通关 / 营地归零的昼与夜 / 待选专长）× 12 个事件的 `getAdjacencyMap` 落点矩阵（含拒绝），并逐事件在真机 actor 上复验运行时结果一致。
- 发现并绕开：machine 的 context 是可变的 `rules` state，guards 依赖 action 副作用；XState 路径模拟不执行这些 action，`getShortestPaths`/`TestModel` 会生成真机拒绝的路径（实测有 `PAUSE → START_NIGHT`），故不使用路径回放，只做结构与单步邻接。
- 删除 `tests/machine.test.ts` 中已被图矩阵覆盖的 4 项：初始状态、START_NIGHT 四类拒绝、夜间败北、RV 开关回归；保留 rules 副作用/hooks、`canClear` 注入、整局五夜、暂停语义、`perkAvailable` 一致性共 8 项。

**验证（实际执行）**
- `vp test` 12 文件 56/56（machine.test.ts 8 + machine-graph.test.ts 2）。
- `vp check` 全绿（53 文件格式、45 文件 lint/类型 0 错误）。
- `vp build` 通过：772.94 kB / gzip 218.09 kB（与上一条记录 772.71 / 218.00 的差异来自并行源码改动，未拆分归因；`@xstate/graph` 不在 bundle 内）。

**未完成 / 下一步**
- 只冻结单步转移；多步路径若要模型化，需先解决可变 context 与路径模拟的冲突（改成 `assign` 不可变 context 属架构级改动，本轮未做）。
- rules 副作用与 hooks 仍由手写 actor 测试覆盖；本轮只动测试与文档，未跑浏览器回归、无画面改动。

## 2026-09-19 · ARC-02/03/04 完成 + 首页（开始/继续）
**变更**
- ARC-02：`src/main.js` 接入 `startCampaign` actor。入夜/清场/黎明/选专长/胜利/失败/RV/暂停全部走事件；`onNightStart` 生成队列、`onDawn` 冻结准备时间并开专长、`onVictory/onDefeat` 结算、`onPerkChosen` 写检查点；删除了 `setPause/manualPause` 直写，`state.phase/paused` 由 machine 单一写入。
- ARC-03：建筑移入 `state.buildings`（纯数据：id/type/x/z/angle/r/level/hp/maxHp/invested），场景改为 `Map<id,{mesh,light,growth,cooldown,hit}>` 视图；倒木 `state.logs` 带稳定 id；`newGame()` 增加 `buildings/logs/nextBuildId`，mesh 永不出现在状态里。
- ARC-04：新增 `src/save.js`（版本化 JSON、current/backup 双槽、损坏回退、容量/禁用/高版本拒绝且不覆写、原地恢复保持数组引用）；检查点写在新战役开始与黎明选完专长后。
- 首页 `src/home.js` + `home.css`：真实营地黄昏环绕标题镜头、巨大 PINEFALL logo、开始新游戏 / 继续游戏（第 N 天 · 营地 % · 专长数）、已有存档时开始新游戏二次确认、点击画面在篝火溅火星；首页锁定游戏输入，HUD 隐藏。
- 自动化钩子：webdriver 默认跳过首页，`?home=1` 强制显示；`window.__pinefall` 增加 `machine/home/startNew/continueSave` 诊断。

**验证（实际执行）**
- `npm test` 55/55（含 `tests/machine.test.js` 12 项、`tests/save.test.js` 6 项）。
- 稳定预览（`npm run build` + `preview --port 5190`）浏览器回归全 PASS：campaign、combat、nights、nights-siege、feel、interior、rv、ambience、expanded-map、occlusion；`audio.browser.js` 按既有约定在 5173 开发服务 PASS。
- 新增 `tests/home.browser.js` PASS：首页锁定输入（N 无效）、开始写入第 1 天检查点、覆盖二次确认不改旧档、移动端 640×780 可操作。
- 新增 `tests/save.browser.js` PASS：真实首夜黎明写入 day 2 检查点（建筑/id 序列化、无 mesh）、首页继续回到 day 2 且建筑重建、current 损坏回退 day 1 backup、version 99 拒绝加载且原档未被覆写。
- 构建 682.87 kB / gzip 194.55 kB（ARC-02 前基线 631.22 / 176.09；增量含 xstate 与并行 RV 会话改动，未拆分归因）；`git diff --check` 通过。
- 截图：`artifacts/home-title.png`、`home-spark.png`、`home-continue.png`、`home-mobile.png`、`save-home-day2.png`、`save-home-refused.png`；已查看 title/mobile，房车在 logo 后方且构图完整。

**未完成 / 下一步**
- 首页观感、标题镜头与存档边界待用户实机验收；通过后 ARC-01..04 与 T6 转 DONE。
- 五夜胜败全程实战与真实倒地仍未做；未测真实 GPU 帧时，不宣称帧率达标。
- 存档按设计只落黎明/新战役；当日建设退出后回到本日黎明。

## 2026-09-19 · RV-GAMEPLAY 房车布置闭环
**变更**
- 产品文档 `docs/RV_INTERIOR_PRODUCT.md`：房车=长期投资/信息/情感锚点，功能槽与防线争资源，每件家具必须当晚可见效果；明确暂不做室内战斗与自由家具编辑器。
- 规则 `src/rules.js`：RV 家具数据（工作台/电台/医疗柜 + 3 件装饰）、槽位按天解锁、安装/拆除 60% 返还、医疗包上限 `maxMedkits`、每晚武器改装 `WEAPON_MODS`、电台时间轴 `spawnTimeline`；`unlockWeapon` 需要工作台；`advance` 黎明清改装并补给医疗柜。
- 场景 `src/interior.js`：6 件家具模型 + 槽位标记，功能模块沿切面 z=1.6，装饰锚定台面/床/北墙，过道保持可通行；`setFurniture/setSlots` 供 UI 切换。`src/world.js`：`rvGlow` 朝营地双窗的夜光、模块色标与剪影，白天不发光。
- UI `src/rv.js` + `index.html`：房车面板（功能/装饰分区、成本、禁用原因、安装/拆除、改装二选一）、情报页时间轴、夜战 `#radio-alert`（下一路 + 倒计时）、photo 模式隐藏角色/首领/建筑条；玻璃样式由并行 UI-01 会话重写为木牌体系，结构与文案保留。
- 经济链：首日买工作台会挤掉一座塔；工作台+步枪需要跑一次山脊中继站（−20 生命），形成"风险换火力"的取舍。

**验证（实际执行）**
- `npm test` 55/55（新增 `tests/rv.test.js` 6 项；`tests/interior.test.js` 增加家具显隐/标记/槽位位置；`tests/combat.test.js` 武器解锁测试适配工作台门禁）。
- `node tests/rv.browser.js` PASS：真实走到门口进车 → 装工作台 → 选射程改装（`playerRange 10`）→ 第二功能槽被拒 → 拆除返还 ▰15 ⚙2 → 装电台 → 情报页出现时间轴 → 入夜 `#radio-alert` 显示"下一路 北径"、`windowGlow > .2`。
- `node tests/combat.browser.js` 改走"先装工作台再解锁步枪"的真实链路并通过；campaign/feel/nights/ambience/expanded-map/audio/interior/occlusion 回归全部 PASS；`npm run build`、`git diff --check` 通过。
- 截图：`artifacts/rv-slots-day.png`、`rv-workbench-installed.png`、`rv-radio-installed.png`、`rv-intel-radio.png`、`rv-night-radio.png`、`rv-night-windows.png`；已查看，工作台/改装高亮/窗外暖光均可读。
- 测试自身修复：`combat.browser.js` 远征耗时改为断言增量；`rv.browser.js` 无电台断言避开提示文案中的"时间轴"字样。

**未完成**
- 第 2/3 功能槽的真实跨夜浏览器验证、医疗柜跨夜补给、完整倒地、五夜实战与胜利结算仍未浏览器验收；存档 T6 未实现，布置目前只在单局内保留；窗外模块色标在默认视角不够显眼，待用户确认强度后再加码。

## 2026-09-19 · UI-01 木牌营地 HUD 重构
**变更**
- 需求“现在的 UI 像网页 app”。移除毛玻璃、圆角胶囊和大段叙事侧栏，改为不透明木牌语言：2px 描边、硬投影、切角、铜钉、刻度条、低对比点阵底纹；中文标题用 ZCOOL QingKe HuangYou，数字/键位用 Silkscreen，正文回退 DM Sans/系统字体（Google Fonts）；常驻 HUD 只保留决策信息。
- `index.html`：品牌名plate、资源牌内联 SVG 图标（木材/零件/营地/击退）、角色头像与带键位角标的武器/医疗包/信号弹槽、操作提示改键位列；新增 `src/ui-fx.js`（资源数值变化弹跳，尊重 reduced-motion）。
- `src/style.css` / `src/ui-polish.css` 全量重写为同一令牌体系，覆盖顶栏、昼夜面板、工具栏、资源牌、目标卡、建造栏、角色状态、建筑面板、手册、专长、结局、加载画幕、房车布置与电台 HUD。替换了并行会话留在 ui-polish.css 的玻璃样式 RV 规则，保留其结构与排版意图。
- 修复 `#interior-panel[hidden]`/`#radio-alert[hidden]` 被 `display:flex` 覆盖导致常驻显示的回归。
- 未触碰 `rules.js` 数值、碰撞与存档；未改并行会话的 `main.js` 战斗/路线图代码。

**验证（实际执行）**
- `npm test` 44/44、`npm run build` 通过（CSS 35.06 kB；JS 仍 >500 kB 警告）、`git diff --check` 通过。
- 浏览器回归 PASS：`combat`、`feel`、`nights`、`rv`、`interior`、`campaign`、`ambience`、`expanded-map`、`occlusion`、`audio`（audio 需开发服务器；构建预览下其 `script[src*="main.js"]` 选择器为空，属测试自身限制）。
- 截图：`artifacts/ui-hud-day.png` / `ui-hud-night.png`（同机位 1440×1000）、`ui-hud-720.png`、`ui-hud-mobile.png`、`ui-hud-help.png`、`ui-hud-manual.png`、`ui-hud-building.png`；跑测试时刷新了 `rv-*`、`campaign-dawn*`、`combat-*`、`nights-intel.png` 实机截图。
- 此前 `interior.browser.js` 的 “Execution context destroyed” 定位为 Vite HMR 在并行写文件时整页重载；对构建预览执行时稳定复现不了该问题。

**未完成**
- 字体仍依赖 Google Fonts CDN，自托管与许可证审计未做；未做参考视频逐帧比较，不宣称“优于参考”；真实 GPU 帧率未测；观感强度（描边厚度、点阵密度、资源跳动幅度）待用户确认后再迭代。

## 2026-09-19 · ARC-01 状态机与规则集成骨架
**变更**
- 新增 `src/machine.js`：XState 5.33.2 `setup` 状态图，`phase`（day.outdoor/interior/night/dawn/victory/defeat）× `overlay`（none/paused/help/manual）并行区域；context 直接复用 `rules.js` 的 `state` 对象，不使用 `assign` 以保持引用稳定；纯函数 `advance/choosePerk` 作为 actions，场景副作用（`onNightStart/onDawn/onVictory/onDefeat/onPerkChosen/canClear/canEnterRV`）以 hook 注入。导出 `startCampaign/phaseValue/overlayValue/isInterior/effectivePaused/assertPhaseSync`。
- 暂停语义接入：`PAUSE` 记录 `state.manualPause`，弹窗（help/manual）只临时暂停，关闭时按 `manualPause` 回到 `paused` 或 `none`，并同步 `state.paused` 供 `rules.js` 的 `active()` 继续校验。
- 新增 `tests/machine.test.js` 12 项：初始同步、入夜/清场/黎明/选专长/第五夜胜利/营地归零失败、RV 与暂停对流转的隔离、清场 hook 注入、整局五夜循环、`perkAvailable` 与 `choosePerk` 行为一致。
- 依赖：`xstate@5.33.2`（精确锁定）加入 `package.json`；未接 `main.js`，游戏行为不变，xstate 尚未进入应用 bundle。

**验证（实际执行）**
- `node --test tests/machine.test.js` 12/12 通过；`npm test` 44/44 通过（并行 RV 工作已同步修复旧 combat 断言，本轮未改其代码）。
- `npm run build` 通过（631.22 kB / gzip 176.09 kB）；`git diff --check` 通过。

**未完成 / 下一步**
- ARC-02：`main.js` 接入 actor，`state.phase/paused` 判断迁移到 snapshot，跑 campaign/combat/interior/nights 浏览器回归确认行为不变。
- 继续游戏入口 UI（启动提示 vs 标题页）待用户确认；ARC-03/04 未开始。

## 2026-09-19 · ARC 状态机与存档架构设计（文档轮）
**变更**
- `AGENTS.md` 技术边界改为「成熟、维护活跃的依赖优先，避免自己造轮子」；每新增依赖必须说明用途与替代方案并记录到 `GAME_DESIGN.md` §10。技术边界指向新设计文档。
- 新增 `docs/STATE_MACHINE_DESIGN.md`：XState 5.33.2 管理 `phase`（day/night/dawn/interior/victory/defeat）与 `overlay`（pause/help/manual）并行状态；context 复用 `rules.js` 的 `state`，纯函数作为 guards/actions；权威数据模型（buildings/logs 数据化）与自有版本化 JSON 存档 schema v1；存档点仅为新战役与黎明选完专长；ARC-01..04 任务与验收。
- `GAME_DESIGN.md` §9 增加状态机/存档设计引用，§10 记录依赖策略修订与 XState 决策；`DEVELOPMENT.md` 增加 ARC 小节、T6 改为由 ARC-04 落地、下一步指向 ARC-01；`ROADMAP.md` 新增 Phase 0（ARC）并把 META-04 标注为 ARC-04 落地。

**验证（实际执行）**
- `npm run build` 通过（index.js 630.56 kB / gzip 175.82 kB，沿用现有 >500 kB 警告）；`git diff --check` 通过。本轮仅文档变更，未改代码。
- `npm test` 25/26：`tests/combat.test.js`「weapon unlock costs scrap…」失败（第 44 行 `unlockWeapon` 返回 false）。
- 失败原因：工作区存在并行进行中的 RV-04 家具实现（`src/rv.js`、`src/ui-fx.js`，`rules.js` 于 12:08 后给 `unlockWeapon` 增加 `rv.includes('workbench')` 前置），而 `tests/combat.test.js` 仍是旧断言。非本轮文档改动引入；未修改对方代码，避免覆盖并行工作。

**未完成 / 下一步**
- ARC-01 状态图与 Node 单测（`src/machine.js` + `tests/machine.test.js`）尚未开始；`xstate` 依赖未安装。
- 待并行 RV-04 工作稳定后修复 `combat.test.js`（工作台前置）并跑全量测试与浏览器回归，再进入 ARC-02。
- 继续游戏入口 UI 形式（启动提示 vs 标题页）待与用户确认。

## 2026-09-19 · CMP-01 战斗深度、营地经营与画面补充
**变更**
- 敌人（T2）：`world.js` 新增四种独立模型（游荡者/疾行者/破阵者/林中巨影：护甲板、鹿角、发光双目），身体合并为单网格 + 双腿；`main.js` 按 `wavePlan` 的路线/间隔生成，接入种族生命/速度/伤害/护甲/赏金、护甲减伤、拆墙倍率、巨影血条与出场提示。
- 武器（T3）：Tab 营地手册工坊，10 零件解锁并装备，`X` 快速切换；霰弹枪最多 3 目标，步枪高穿甲，HUD 显示当前武器。
- 能力（T4）：`Shift` 冲刺（体力 30 / 0.22s / 短暂无敌）、`Q` 信号弹（半径 5 / 5s / 冷却 25s）、`F` 医疗包（60）；角色生命/体力/医疗包独立 HUD，敌人贴近会攻击角色，倒下扣营地 15 并半血复活（2.5s 保护）。
- 建筑（T8）：点击建筑打开面板，升级（上限 3 级）重建模型并提升塔/灯/栅栏效果，维修 10 木材，拆除返还 60% 并在按钮明示。
- 远征与情报（T9/T5）：手册远征页白天一次、扣白天预算；情报页显示波次组成、路线与危险。
- 画面：门口挂灯与暖光、踏步石、劈柴堆、独轮车、蘑菇、独木舟、三条小径木路牌、夜间月光与角色提灯；photo 模式隐藏角色条/首领条/建筑面板。音频补充 dash/flare/heal 三种原创音效。
- 并行完成的打击反馈（`src/feel.js`：枪口闪光、受击闪白、击退、后坐、hit-stop、镜头震动及开关）保留并与其测试共存。

**验证（实际执行）**
- `npm test` 20/20（新增 `tests/combat.test.js`）、`npm run build`、`git diff --check` 通过。
- `node tests/combat.browser.js` PASS：真实手册远征（白天 −50s、−20 生命）→ 工坊解锁并装备步枪 → 冲刺耗体力 → 信号弹进冷却 → 医疗包边界 → 放置/选中/升级/拆除栅栏（返还 21 木材 + 2 零件）→ 首夜按北径刷出游荡者；无页面错误。
- 生产预览回归：campaign、feel、ambience、expanded-map PASS；开发服务上 audio（含离线 WAV 渲染）、interior、occlusion PASS。接触伤害冒烟：站上北径出生点，`playerHp 100→96` 且营地 100。
- 测试自身修复：`combat.browser.js` 关闭手册后改为等待 `paused` 复位；native dialog 的 close 事件是异步任务，原断言在事件派发前读取会偶发失败（非游戏逻辑缺陷）。
- 截图：`artifacts/enriched-day.png`、`enriched-night.png`（1404×1080 无 HUD）、`enriched-hud-1280.png`、`enriched-manual-intel.png`、`enriched-manual-mobile.png`、`combat-manual-workshop.png`、`combat-building-panel.png`、`combat-night-typed.png`；已查看布局与可读性。
- 未完成：第五夜巨影/破阵者实战与胜利结算未全程浏览器跑；完整倒地未实战；存档 T6、首日引导 T11、真实 GPU 帧时未做。不把目标帧率写成实测。

## 2026-09-18 · RV-ART-01 室内细节与床头灯交互
**变更**
- `src/interior.js`：床铺/餐区/厨房/门边补足生活陈设（坐垫毯、床尾毯、书本内页、座下储物篮、搪瓷水壶、砧板面包、擦手巾、香料罐、悬挂勺具、旅行地图、马克杯、地板条、相片绳、挂钩包），不侵入过道；室内面板新增「床头灯」开关。
- 开关同步灯罩发光/哑光切换、真实点光源与摆杆角度；会话内状态，不产生资源收益。`src/main.js` 修复空格吞按钮激活；暂停时拒绝灯开关；诊断接口暴露 `lampOn`，浏览器测试直接断言场景灯光状态。
- 测试修复：`tests/interior.browser.js` 行走助手按键时长按剩余距离缩放；原固定 70ms 步长在门旁障碍处来回振荡（诊断记录 5.59↔6.20 循环）导致偶发超时，属测试自身缺陷。

**验证（实际执行）**
- `npm test` 9/9（新增 `tests/interior.test.js`）、`npm run build`、`node tests/interior.browser.js`（含场景灯状态断言、暂停拒绝、退出重进保留、1280×720）、ambience/expanded-map/occlusion/audio 浏览器回归、`git diff --check` 全部通过。
- 截图：`artifacts/rv-details-light-on.png` / `rv-details-light-off.png` / `rv-details-720.png`，同机位对照已查看：关灯后暖光区消失、灯罩转暗、过道可辨。
- 未完成：家具网格布置（RV-03）、三件功能家具（RV-04）、窗光反馈（RV-05）、存档；不宣称完整房车玩法。

## T1 · 黎明专长与结算接线（VERIFY）
- 收敛到阻塞战役的奖励选择闭环，不顺带接工坊/远征/波次。新增原生专长模态、已选专长 HUD，冻结选择时间/输入，拒绝重复及非法阶段领取；诊断返回数组副本，不再允许通过诊断数据改专长。
- 玩家/塔实际攻击调用规则加成，采集使用规则收益。现阶段无作用的角色生存、维修、零件用途在卡片明确标注，不伪称完成。第五夜接胜利结算，Esc 不关闭结局。
- 实测 `npm test` 8/8、build、audio.browser、campaign.browser 通过；真实 UI 建塔并守过首夜，10 击退/营地 100%，模态冻结、键盘确认后第二夜启动，无状态注入。五夜胜败仅规则单测覆盖，实战全程尚未验证。
- interior.browser 首次 execution context destroyed；重跑 PASS，导航中断根因未确认。git diff --check 通过。截图 campaign-dawn / campaign-dawn-mobile 已查看，准备/夜战同机位截图已保存。
- 下一步：五夜实战与胜败结算验收，然后 T2 类型/波次接入；美术、真实 GPU 帧时与商业发行质量均未宣称达标。

## AUD-01 · 原创芯片配乐、室内变奏与自适应混音
- 新增 `src/audio.js`：三套独立旋律/和声、32 小节主题/对答/间奏/再现，七声部立体声合成；室内低速无鼓。进出房车/昼夜在小节边界渐变；11 个音效事件；总/音乐/音效滑杆及静音保存。
- 根据“不够丰富”反馈重写谱面，不再仅叠相同旋律；`v3-adaptive` 增加双振荡微失谐、旋律轨卷积混响、附近敌人驱动的平滑心跳/紧张衬底。保留并行修改的加载预热与房车镜头过渡。
- 参考：完整阅读 `game-feel`、社区 `audio-design` 及 adaptive-music 参考（临时克隆目录 `/tmp/pinefall-audio-reference`，未安装到项目）；搜索显示 3.2K installs，GitHub 星数因 API 限流未核实。
- 验证实际执行：`npm test` 6/6、`node tests/audio.browser.js`、`node tests/interior.browser.js`、`npm run build`、`git diff --check` 通过。浏览器覆盖手势解锁、静音/音量保存、暂停恢复、建造/入夜提示、室内曲切入/室外恢复；敌情加层为单测与离线演示，未宣称实战验收。射击等待曾超时，保留为待验证项。
- WAV：`artifacts/pinefall-{day,night,interior,sfx}.wav`，22.05kHz 双声道，约 76/62/103/16 秒；夜曲后半固定高紧张演示。当前峰值约 0.101/0.112/0.104/0.085，声部回收后 voices=0；证明信号存在和离线幅值余量，不代表响度或听感达标。
- 已查看同机位 `artifacts/audio-day.png` / `audio-night.png`；无美术优于参考视频的结论。构建仍有 >500kB 警告。
- 状态 VERIFY：尚未耳机/扬声器听测，不称“最好”或商业音频已完成。下一步用户试听后针对音色/旋律调整，并验证真实夜战音效遮蔽、场景切换尾音、循环边界与后台恢复。

## 2026-09-18 · 首页资源加载进度与 HUD 视觉整理
**变更**
- `index.html` 的启动遮罩新增真实进度条、阶段文案和 `progressbar` 语义；加载完成前不进入场景。
- `src/main.js` 按程序化营地/环境、Web Audio 图表、字体和 Three.js shader 预热推进进度；`src/audio.js` 新增静音安全的 `prepare()`，先创建音频图表，用户手势后再解锁播放。
- 资源当前没有外部音频、模型或纹理文件，不引入额外加载库；地形/材质/声音均由现有运行时代码生成。同步完成 HUD 与加载画面的视觉整理。

**验证（实际执行）**
- `npm test` 5/5、`npm run build` 通过。
- Chromium 检查首屏初始进度 `0%`，完成状态为 `100%` 后遮罩淡出；音频初始 `locked`，点击声音按钮后 `running`、调度步数正常。
- `tests/ambience.browser.js`、`tests/expanded-map.browser.js` 顺序执行 PASS，无页面错误；截图 `artifacts/loading-progress.png`、`home-polished-day.png`、`home-polished-night.png`、`home-polished-mobile.png`。

## RV-02 · 进出房车镜头过渡
- 进入/退出改为 0.9 秒过渡：室外镜头推向侧门并放大，半程淡入（`#rv-fade` 遮罩），室内轻微推近后落定；退出反向。不再直接跳切。
- 过渡期间输入全部锁定（移动/点击/滚轮/建造/E/N），预算与敌人状态冻结；结束恢复原 zoom。系统 reduced-motion 直接切换。
- `tests/interior.browser.js` 扩展：过渡触发时连按 E/N/2 均被忽略、zoom 归位；全量回归（5 单测 + 3 浏览器）通过，截图已查看。

## RV-02 · 可进入的房车首版
- 修正“仅有提案、没有门交互”的缺口：新增 `src/interior.js` 独立切面，床铺/厨房/餐桌/窗帘/壁灯；复用现有角色和渲染器。
- 白天靠近朝篝火的侧门 E/按钮进入；WASD 在过道移动；E/Esc/按钮返回原门外位置。室内预算冻结、禁止室外建造/入夜、夜间拒绝进入，建造预留门外通道。
- `node tests/interior.browser.js` 真实键盘闭环通过；覆盖暂停、远程拒绝、家具碰撞、输入隔离、再次进入、窄屏退出及夜间拒绝。`npm test`、`npm run build`、环境动画浏览器回归、`git diff --check` 通过。
- 截图：`artifacts/rv-interior.png`、`rv-interior-mobile.png`（已查看），`rv-door-day.png`、`rv-door-night.png`。
- 未完成：家具布置/功能效果/存档/镜头过渡；当前直接切换、固定陈设，不能算完整房车玩法。窄屏全景较小，观感待用户确认。未改战役数值，未覆盖并行音频/UI 工作。

## 2026-09-18 · 首屏白屏过渡修复
**变更**
- 在 `index.html` 头部加入关键启动样式；运行时 `style.css` 注入前即显示深色背景和全屏加载遮罩。
- 不改 Three.js 场景、加载完成条件或游戏逻辑，完整样式接管后仍按原逻辑淡出遮罩。

**验证（实际执行）**
- `npm test` 2/2 通过；`npm run build` 通过。
- Chromium 首个提交阶段检查到 `html/body` 为 `rgb(24, 44, 37)`，`#loading` 为固定全屏 `rgb(28, 48, 41)` 遮罩。
- `tests/ambience.browser.js`、`tests/expanded-map.browser.js` 均 PASS，无页面错误。

## ENV-01 · 环境呼吸感
- 需求：画面平淡，增加有呼吸感的动画；本轮不修改战役规则。
- `src/world.js`：植被独立合批、GPU 风场变形与阴影同步；灯串保留可动挂件。
- `src/main.js`：慢速火光呼吸、灯串轻晃、错相浮尘/萤火虫、风向烟雾；独立环境时钟，支持暂停及系统 reduced-motion 动态切换。
- 验证：`npm test` 2/2、`npm run build`、`node tests/ambience.browser.js`、`node tests/expanded-map.browser.js`、`git diff --check` 均通过。浏览器同时检查 JS 和 shader 错误，结果为空。
- 证据：`artifacts/breathing-day-a.png` / `breathing-day-b.png` / `breathing-night.png`，已查看昼夜及跨时间截图。测试覆盖灯串变化、暂停/恢复、减少动态效果开关；地图移动回归通过。
- 状态 `VERIFY`：观感待用户确认；夜间远林仍偏暗，真实 GPU 性能未测。构建仍有 >500 kB 提示。

## 2026-09-18 · 房车内部提案（文档轮）
- 新增 `docs/RV_INTERIOR_PROPOSAL.md`；确认：白天才能进入，夜间必须在外防守。
- 本轮未改 `src/`；RV 系列任务保持 TODO/PARTIAL，等待三项决策（切面渲染/功能家具/资源共用）。

## 2026-09-18 · 地图扩展 + 夜间进度修复
**变更**
- 地形 100→180 米，可行走 ±34→±64；外围补齐森林、地表、道路与湖岸纹理；镜头离开营地后平滑跟随（新增 `src/map.js` 的 `cameraFocus`，含边界钳制）。
- 修复夜晚可跳过战斗：`advance(state, cleared)` 强制夜间清场才能进入白天；日间 150 秒自动入夜仅在白天生效。
- B2 修复：移除夜间“65 秒自动黎明”进度条；改为“守夜 · 剩余敌人 N”（含未生成），进度条仅白天显示。

**验证（实际执行）**
- `npm test` 2/2 通过；`npm run build` 通过（chunk 562KB，后续可分割）。
- `tests/expanded-map.browser.js` PASS：真实键盘移动到 (-55.7, -5.7)（越过旧边界 -50），镜头跟随到 x=-47.9，无页面错误。
- 夜间 UI 冒烟：进入夜晚后 `#day-progress` opacity=0，文案“剩余敌人 10”与场上敌人一致；截图 `artifacts/night-counter-ui.png`。
- 夜战冒烟：敌人分批出现、击退 +2 正常，无错误。

**遗留**
- 外围暂无新交互（资源/地标待 T9/T11）。
- 房车内部提案等待用户确认剩余三点（见 RV 提案 §12）。

## VIS-01 · 角色遮挡半透明剪影
- 先确认原因：角色在 `(1,0,-3.805)` 且仍可见、不透明、在镜头内；相机方向射线先命中房车车顶，是正常几何遮挡而非角色消失。
- 新增 `src/occlusion.js`，`src/main.js` 开启 stencil 并只对玩家接入。复用身体几何、子节点同步腿部/转身动作，GreaterDepth 仅画被挡部分；stencil 排除可见玩家像素并限制每像素混合一次，避免自遮挡和肢体叠色。无新依赖、不修改模型/碰撞/数值，也不覆盖并行音频/UI 工作。
- `node tests/occlusion.browser.js` PASS：实际按键走到房车背面、昼夜同机位截图；离屏像素对比完全遮挡 1986 像素、半遮挡只改左侧 997 像素，无遮挡/遮挡物在身后/移开后均 0 差异，重叠肢体仅一种混合色；无页面或 shader 错误。
- 测试修正：到车边的阈值原先超出碰撞边界导致等待超时；动态导入改为读取运行中 Vite 的实际模块路径；禁用/启用效果通过同一路由切换，避免复用禁用版本。修正后重跑并覆盖截图。
- `npm test` 6/6、`npm run build` 通过。`tests/interior.browser.js` 与 `tests/ambience.browser.js` 将 URL 替换为构建预览服务 5174 后执行并 PASS；开发服务室内回归曾因执行上下文销毁中断，未确定原因。
- 收尾复跑 `npm test` 8/8（含并行新增规则测试）、`npm run build`、`git diff --check` 通过；室内/环境浏览器通过记录对应此前构建。
- 已对照查看 `artifacts/occlusion-before-day.png` / `occlusion-day.png` / `occlusion-night.png`；剪影昼夜均出现，白天浅色车顶的对比更弱。状态 VERIFY，下一步用户确认强度；未比较参考视频、未测真实 GPU 帧率。构建保留 >500kB 警告。

## FEEL-01 · 打击感（本轮）
- 问题：自动射击命中缺少视听反馈，敌人瞬间消失，无后坐/击退/停顿/镜头反馈。
- `src/feel.js`（新增）：镜头创伤（累加、trauma² 输出位移/缩放/侧倾、自动归零）、hit-stop（真实时间计时）、easeOutBack、按敌人血量的停顿/创伤档位。
- `src/main.js`：枪口实体闪光池 + 短点光；命中闪白/后仰/击退（Boss 免疫位移、破阵者减半）；击杀 0.5 秒倒地 + 碎裂粒子 + hit-stop + 镜头震动；营地/角色受击红晕、建筑木屑抖动；建造弹出；玩家枪械后坐。震动画可在 HUD「≈」关闭并本地保存，`prefers-reduced-motion` 默认关闭。仅表现层，不改 `rules.js` 数值、碰撞、存档；粒子/闪光固定池回收。
- 并行战斗重构已包含的闪白/倒地/停顿/震动实现予以保留，本轮只补击退、枪口实体闪光、后坐力、建造弹出，并清理重复的 `#hurt-flash` 元素与样式。
- 验证：`npm test` 20/20（含 `tests/feel.test.js` 4 项）；`npm run build` 通过；`node tests/feel.browser.js` PASS（真实首夜战斗：枪口闪光 12、闪白 8、击退 8、后坐 12、击杀 4、hit-stop 4、震动帧 8；开关持久化与 reduced-motion 默认关闭）；`campaign`/`interior`/`ambience`/`expanded-map`/`occlusion` 浏览器回归全部 PASS；无页面错误。
- 截图：`artifacts/feel-day.png`、`feel-night-kill.png`、`feel-night-combat.png`（同机位昼夜，已查看；夜间命中亮斑可见）。
- 遗留：打击强度/震感需用户试玩确认；未测真实 GPU 帧率；构建仍有 >500 kB 警告。

## NGT-01/02/03/04 · 夜间有题（本轮）
- 目标：把"看塔打怪"改成"每晚一道可预判、需要构筑解答的题"。数据与行为全部由 `src/rules.js` 驱动。
- `rules.js`：五夜课题化（单路教学/双路取舍/攻城/迷雾/综合），每组带意图标签；新增 `spitter` 腐吐者（射程 14，超远程腐蚀建筑，逼玩家离开塔防区）与 `stalker` 潜行者（迷雾中仅灯/信号弹/近距离显形）；新增纯判定 `siegeGoal`/`rangedGoal`/`revealed`。夜 1/2 组队保持不变以兼容既有战役测试。
- `world.js`：两种新敌人独立体块模型（酸囊+发光喷口 / 低伏四足+发光双目）。
- `main.js`：破阵者直扑最近塔；腐吐者停在射程外抛射可躲避的酸液弹，命中建筑或角色；潜行者未照亮时不可被自动射击与塔锁定；迷雾降低月光/提灯/营地灯强度与半径；情报页显示课题、环境、建议与意图标签。
- 验证：`npm test` 26/26（新增 `tests/nights.test.js` 6 项）；`node tests/nights.browser.js` PASS；`node tests/nights-siege.browser.js` 真实推进到第 3 夜 PASS（`sieging>0`、`spits>0`，截图 `artifacts/nights-siege.png`）；`node tests/feel.browser.js` PASS；`npm run build` 通过；生产预览服务 4173 运行以保证并行编辑期间测试稳定。
- 设计修正：腐吐者最初射程 6.5，实战被塔在射程外先手击杀、从未开火；改为 14 后才形成"必须出门清理"的真实决策。
- 遗留：潜行者/迷雾未做逐夜浏览器实战；风向未做；ECO/META 任务待推进。并行会话已把 ARC（状态机/存档）Phase 0 并入 `docs/ROADMAP.md` 与 `DEVELOPMENT.md`。

## META-01 · 黎明评分（本轮）
- `rules.js`：新增 `dawnRating({ campLost, downs, buildingsLost, nightSeconds })`，营地损失/倒地/建筑被毁/超时扣分，60 秒内清场有速度加成，上限 100；S/A/B/C 门槛 `RATING`。
- `main.js`：`beginNight()` 重置本轮遥测（起始营地耐久、倒地次数、建筑损毁、耗时），清场前记录结束耐久；黎明专长模态显示「评分 S（100）· 营地 −0% · 耗时 42 秒」，诊断 `stats.rating` 暴露本夜明细。
- 验证：`npm test` 通过（新增 `tests/meta.test.js` 4 项：满分、慢速、逐项扣分、下限为 0）；`npm run build` 通过；`node tests/nights-siege.browser.js` 真实推进第 1/2/3 夜，每次黎明断言评分文案与 `stats.rating` 合法，PASS。
- 遗留：评分尚未接入解锁（META-03）与恶兆（META-02）；五夜全流程评分对照待跑。

## 2026-09-19 · Vite+ 工具链迁移 + 全量 TypeScript + Vitest + zod 存档校验
**变更**
- 迁移到 Vite+ 0.3.3（`vp migrate`）：新增 `vite-plus@0.3.3`，`vite` 经 npm overrides 别名到 `@voidzero-dev/vite-plus-core`；scripts 改为 `vp dev/build/preview`；`vite.config.ts` 统一承载 `fmt`/`lint`/`test`/`base` 配置。迁移生成的 `devEngines` 固定 npm 12.0.2 会让 npm 11 直接 EBADDEVENGINES 拒绝安装，已放宽为 `npm >=11`（onFail warn），本机 npm 升级到 12.0.2。
- 格式基线：oxfmt `singleQuote`，排除 `docs/`、`.pi/`、`.agents/`、`AGENTS.md`、`skills-lock.json`；一次全库格式化（39 文件）。修复 oxlint 的 5 个警告（未用导入、无意义 spread 回退、sort 比较器）。
- 单测从 `node:test` 迁移到 Vitest（`import { test } from 'vite-plus/test'`），`test.include = tests/**/*.test.ts`；`package.json` 的 `test` 改为 `vp test`，新增 `check`。
- 全量 strict TypeScript：`src/` 13 个模块 + `tests/` 24 个脚本全部 `.ts`；`tsconfig.json`（moduleResolution bundler、noEmit、不用 baseUrl）；入口改 `/src/main.ts`；`src/global.d.ts` 声明 `window.__pinefall`；E2E 用 Node 原生类型剥离直接跑 `.browser.ts`。
- 存档校验引入 `zod@^4.6.5`：`src/save.ts` 的 `saveSchema` 取代手写字段检查（loose object 保持未知字段向前兼容），`isValidSave` 走 `safeParse`；新增 1 项校验边界单测。
- CI：新增 `.github/workflows/ci.yml`（Node 24：`npm run check`、`npm test`、`npm run build`），deploy workflow Node 22→24。
- 文档：`AGENTS.md` 技术边界/命令改为 TS + vp；`GAME_DESIGN.md` §10 记录 Vite+ 工具链、TypeScript、zod 决策与实测体积；`STATE_MACHINE_DESIGN.md` §6 注明 schema 校验；本文件与 `DEVELOPMENT.md` 同步。

**验证（实际执行）**
- 迁移后、TS 转换前：55/55 单测；`vp build` 通过；13 个浏览器测试全 PASS（10 个对 4173 生产预览，interior/occlusion/audio 对 5173 dev；其间清掉了迁移前遗留的旧 Vite dev server 进程）。
- 全量 TS 后：`vp test` 11 文件 56/56；`vp check` 47 文件格式 + 39 文件 lint/类型 0 错误；`vp build` 通过；13 个浏览器测试重跑全 PASS（occlusion/audio 需 5173 dev，其余对 4173 预览）。
- 体积：687.75 kB / gzip 193.76（zod 前）→ 772.71 kB / gzip 218.00（含 zod），+85.0 kB raw / +24.2 kB gzip；>500 kB 提示仍在，未做代码分割。
- `npm ci` 在 npm 11 下曾被 `devEngines` 阻断，已修复并在临时目录用 `npm ci --dry-run` 复验；本机 npm 12.0.2 全流程通过。

**未完成 / 下一步**
- 用户日常使用验收后 TOL-01 转 DONE；CI 工作流尚未推送运行。
- `vp staged`/git hooks 未启用；`zod/mini` 可作为体积优化备选。
- `audio`/`occlusion` 浏览器测试仍依赖 dev server 动态模块路径（非本轮引入，未扩大修复范围）。

## 2026-09-19 · 工具链补充：浏览器测试入口 + 提交钩子
- 新增 `scripts/browser-tests.ts` 与 `npm run test:browser [filter]`：顺序执行全部 `tests/*.browser.ts` 并汇总 PASS/FAIL（`GAME_URL` 透传；`audio`/`occlusion` 仍按既有约定需要 5173 dev 服务）。以 `home` 过滤实测通过。
- 启用 `vp staged` 提交钩子：`vite.config.ts` 增加 `staged: { '*.{ts,css,html,json}': 'vp check --fix' }`；`.vite-hooks/pre-commit` 优先用项目内 `vp`，回退全局；`.vite-hooks/_` 加入 `.gitignore`。该补充提交自身触发钩子并完成检查。
- 验证：`vp hooks status` 显示 dispatcher 已装、preference enabled；`vp staged` 对 4 个匹配文件执行 `vp check --fix`；`npm run check`、`vp test`、`vp build` 仍全绿。

## 2026-09-19 · 文档-代码差距审计与任务化
**变更**
- 对照 `GAME_DESIGN.md` / `ROADMAP.md` 与 `src/`、`tests/` 实际代码逐项核验，区分「路线图 TODO」「设计承诺但代码缺失」「文档滞后」三类；结果见 `DEVELOPMENT.md` 审计小节。
- `ROADMAP.md`：Phase 0 新增 ARC-05（存档回退边界）；Phase 1 新增 NGT-05（战前确认界面）并把风向从 NGT-04 拆为 NGT-06（待设计取舍）；Phase 3 新增 BLD-04（阻挡形状与旋转模型一致）、BLD-05（通行性校验防自锁）；WLD-03 补充完成判定与 `WAVES[].hint` 去留；新增 Phase 8（FIX-01 余火守望体力恢复 / FIX-02 死数据清理 / FIX-03 文档与代码同步）；M1 注明 NGT-05 纳入、NGT-06 可延后。
- `DEVELOPMENT.md`：登记 ARC-05、NGT-05/06、BLD-04/05、FIX-01..03，新增 T13（五夜实战通关验收，指向工作区未跟踪草稿 `tests/victory.browser.ts`）、T14（完整倒地实战）、T15（夜间幽灵预览残留复现）；已知缺口 1–3 关联任务；下一步补差距任务建议顺序。
- 证据（审计时）：`save.ts:177` schema 失败即返回 corrupt；`rules.ts` `maxHp` 仅 +25、`MEDKIT_CAP` 无引用、`WAVES[].hint` 无消费者；`main.ts:753` `canPlace` 无上限/通行性、`main.ts:1847` 圆形阻挡、`main.ts` `elapsed > DAY_LENGTH` 直接 `START_NIGHT`。

**验证（实际执行）**
- 本轮仅文档变更，未改代码、未运行测试；任务登记内容均来自代码与文档静态核对。
- 工作区存在并行未提交重构（`src/dom.ts`/`gfx.ts`/`rng.ts` 等）与未跟踪测试文件，非本轮产物，未触碰、未运行。

**未完成 / 下一步**
- 新增任务全部 TODO：建议顺序 FIX-03 → FIX-02 → ARC-05 → NGT-05 → FIX-01/BLD-04/BLD-05 → T15；NGT-06 先做设计取舍；T13 待 `victory.browser.ts` 稳定后对预览服务实跑。

## 2026-09-19 · 差距任务并行收口 GAP-01
**变更**
- ARC-05：`src/save.ts` 双槽回退边界——current 为合法 JSON 但 schema/迁移失败时继续尝试 backup；高版本仍立即拒绝且不覆写；`tests/save.test.ts` 新增 4 项（非法字段 current+合法 backup → recovered、无迁移路径 → backup、双坏 corrupt、高版本锁定）。
- FIX-01/02：`rules.ts` 新增 `staminaRegen/staminaDelay`（余火守望 +50% 恢复、延迟 0.5→0.3s，卡片文案同步，`tests/survivor.test.ts` 3 项）；`MEDKIT_CAP` 接入 `maxMedkits` 并由 `rv.test.ts` 锁定；`WAVES[].hint` 已由 WLD-03a 引导消费。
- FIX-03：文档同步 `.js`→`.ts`、六种敌人模型、`GAME_DESIGN` §5 过时限制、`STATE_MACHINE_DESIGN` 头部状态、RV 文档与 `AGENTS.md`；DEVLOG 历史不改写。
- NGT-05：`machine.ts` overlay 增加 `confirm`（`OPEN_CONFIRM/CLOSE_CONFIRM/CONFIRM_NIGHT`）；计时到点（`elapsed > DAY_LENGTH`）弹「战前确认」（今晚情报/风向/电台时间轴/准备摘要，冻结预算与输入），Esc/按钮返回白天、Enter/按钮开战；会话标志 `nightPrompted` 抑制同日重弹；**N/按钮保持直接入夜**；`tests/machine-graph.test.ts`/`machine.test.ts` 同步；新增 `tests/night-confirm.browser.ts`（20x 时间缩放触发真实到点）。
- NGT-06：规则层 `WINDS`（五夜确定性风向/强度）、`nightWind/nightIntel/windVector/windDrift`；场景接入——酸液弹落点按风漂移（弧线同步、速度/伤害不变）、营火与信号弹烟焰沿风向、情报页与确认模态显示风；`tests/wind.test.ts`（+3 项契约测试）、新增 `tests/wind.browser.ts`。
- BLD-04/05：`rules.ts` 新增 `FOOTPRINTS`（fence box / tower box / lantern circle）与 `pointInFootprint/distanceToFootprint/circleTouchesFootprint/footprintsOverlap`；`canPlace`、角色 `blocked()`、敌人拆墙判定与放置预览轮廓全部改用旋转 footprint；`sealsPlayer()` 以 0.5m 网格洪泛验证放置后玩家仍可达营地中心，封死时红预览 +「会把自己封死」；新增 `tests/footprint.test.ts`、`tests/bld.browser.ts`。
- T15：`ghostPermitted()` 统一幽灵可见性（day/非暂停/非模态/非 photo·home/非室内/非过渡）；拒绝选择与模态打开清理残留；新增 `tests/ghost.browser.ts`。
- T14：`tests/death.browser.ts` 适配重平衡——连续三天山脊远征压血、第 3 夜延迟切入北径避免卡宾枪提前击杀、保护窗用 1× 时间；真实倒地 2 次 PASS（营地 100→85、半血 50 复活、保护 2.50s）。
- 类型：`global.d.ts` 补 `windDir/windTier/windX/windZ/lastSpit` 诊断字段；`GAME_DESIGN` §2 补战前确认语义（到点才弹、N/按钮为主动开战）。

**验证（实际执行）**
- `vp check` 全绿（78 文件格式、68 文件 lint/类型 0 错误）；`vp test` 17 文件 92/92。
- 全量浏览器回归 19/19 PASS（ambience、audio、bld、campaign、combat、death、expanded-map、feel、gather、ghost、home、interior、night-confirm、nights、nights-siege、occlusion、rv、save、wind）。
- `tests/victory.browser.ts` 3/3 PASS：真实建造/选专长/夜战（8x 夜速），第 5 夜 health 97/28/50，终局 `phase=victory` + 结局弹窗，`artifacts/victory.png` 刷新。
- 截图：`night-confirm.png`、`wind-intel.png`、`wind-spit.png`、`bld-04-fence-rotated.png`、`bld-05-blocked.png`、`ghost-day/night/day-restored.png`、`death-respawn.png`、`death-flow.png`。

**未完成 / 下一步**
- 全部为自动化证据，用户实机验收前保持 `VERIFY`；「到点才弹确认、N 直入」为产品决策待用户确认；ECO 余量按 T13 最差样本（第 5 夜 health 28）复核。
- 工作区仍有并行会话的 React UI/i18n/guidance/economy 未提交改动；本轮仅对其共享的 `main.ts`/`rules.ts` 做精确编辑，未触碰其余文件。

## 2026-09-19 · 用户验收确认（GAP-01）
- 用户确认：GAP-01 全部任务与 T13/T14/T15 通过，`ARC-05`、`FIX-01/02/03`、`NGT-05/06`、`BLD-04/05`、`T14`、`T15`、`T13` 状态转 `DONE`；「到点才弹战前确认、N/按钮直接入夜」产品决策一并确认。
- `ROADMAP.md`/`DEVELOPMENT.md` 状态与已知缺口同步；ECO 余量（第 5 夜 health 最低 28）留待 `ECO-01` 复核。
- 本轮无代码改动，仅文档状态更新。
