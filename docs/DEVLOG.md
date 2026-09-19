# PINEFALL 开发日志

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
