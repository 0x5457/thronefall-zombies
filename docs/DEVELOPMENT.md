# PINEFALL 开发状态

> 本文件记录实际代码状态和已确认任务。设计讨论稿不等于功能完成。  
> 状态：TODO / DOING / PARTIAL / VERIFY / DONE / BLOCKED

## 工具链迁移 TOL-01（本轮，VERIFY）
- 状态：`VERIFY`（迁移与自动化验证通过；待用户日常使用确认后转 DONE）。
- Vite+ 0.3.3：全局 `vp` 已安装且未接管运行时（沿用 mise Node 26.8.1 + npm 12.0.2）；项目内固定 `vite-plus@0.3.3`，`vite` 经 npm overrides 别名到 `@voidzero-dev/vite-plus-core`（内置 Vite 8.3.0 + Rolldown 1.2.9）。测试 Vitest 4.1.11；检查 Oxfmt 0.68.0 + Oxlint 1.83.0 + tsgolint 7.0.2001。
- 命令：`vp dev` / `vp build` / `vp preview` / `vp check`（格式+lint+类型）/ `vp test`；`package.json` 同步提供 `dev/build/preview/test/check` 脚本。
- TypeScript：`src/`、`tests/` 全量 strict TS（`tsconfig.json`，moduleResolution bundler，不用 baseUrl）；`vite.config.ts`；`index.html` 入口改 `/src/main.ts`；`src/global.d.ts` 声明 `window.__pinefall` 诊断类型。E2E 脚本为 `tests/*.browser.ts`，用 Node 原生类型剥离直接运行（CI Node 24）。
- 存档校验：`src/save.ts` 用 `zod@4.6.5` schema 校验不可信 JSON，替代手写字段检查，保留版本拒绝/双槽回退/不覆写语义。
- 验证：`vp check` 全绿（47 文件格式、39 文件 lint/类型 0 错误）；`vp test` 11 文件 56/56；`vp build` 通过（772.71 kB / gzip 218.00 kB；zod 前 687.75 / 193.76，+85.0 kB raw / +24.2 kB gzip，>500 kB 提示仍在）；13 个浏览器测试在 TS 代码上全 PASS（11 个对生产预览，`audio`/`occlusion` 按既有约定需 5173 dev 服务做动态模块导入）。迁移为行为不变重构，无画面改动，未新存截图。
- CI：新增 `.github/workflows/ci.yml`（Node 24：`npm run check` + `npm test` + `npm run build`）；deploy workflow Node 22→24。工作流尚未推送运行。
- 浏览器测试统一入口：`npm run test:browser [filter]`（`scripts/browser-tests.ts` 顺序执行 `tests/*.browser.ts`，按环境变量 `GAME_URL` 指向服务；`audio`/`occlusion` 需 5173 dev）。已用 `home` 过滤实测 PASS。
- Git 钩子：`vp hooks enable` 已启用，`.vite-hooks/pre-commit`（提交时运行 `vp staged` → `vp check --fix`）；`.vite-hooks/_` 已加入 `.gitignore`。提交 `edb6d36` 实测钩子触发正常。
- 遗留：`devEngines` 放宽为 `npm >=11`（vp 迁移生成时固定 npm 12.0.2，本机 npm 11 会 EBADDEVENGINES 拒绝安装）；`audio`/`occlusion` 浏览器测试依赖 dev server 的源码模块路径。

## 夜间有题 NGT-01/02/03/04（本轮，VERIFY）
- 状态：`VERIFY`（数据、行为与浏览器验证通过；五夜全程实战与观感待用户确认）。
- `src/rules.js`：五夜改为五个课题（单路教学/双路取舍/攻城/迷雾/综合），每组带意图标签（突击/奔袭/拆塔/远程/潜行/首领）；新增敌人 `spitter 腐吐者`（射程 14、超远程腐蚀建筑，迫使玩家离开塔防区）与 `stalker 潜行者`（迷雾中仅灯/信号弹/近距离显形）；纯判定函数 `siegeGoal`/`rangedGoal`/`revealed` 供场景调用与单测。
- `src/world.js`：新增腐吐者（鼓胀酸囊+发光喷口）与潜行者（低伏四足+发光双目）体块模型。
- `src/main.js`：破阵者无视车道直扑最近瞭望塔；腐吐者停在射程外抛射可见酸液弹（命中建筑/角色，可躲避）；潜行者未照亮时对自动射击与塔均不可见；迷雾降低月光/提灯/营地灯强度与半径；情报页显示课题、环境、应对建议与各组意图标签。
- 验证：`npm test` 26/26（新增 `tests/nights.test.js`：课题与意图、迷雾夜构成、冲塔/远程目标选择、显形规则、新敌人数值）；`node tests/nights.browser.js` PASS（情报含课题/建议/意图；首夜按真实计划刷怪且不泄漏新类型）；`node tests/nights-siege.browser.js` 真实推进至第 3 夜 PASS（观测到 `sieging > 0` 与 `spits > 0`，截图 `artifacts/nights-siege.png`）；`feel.browser.js` 回归 PASS；`npm run build` 通过。
- 已知限制：潜行者/迷雾的浏览器实战未逐步跑（显形判定为单测 + 场景接入代码走查）；风向（NGT-04 后半）未做；M1 评价值得等 ECO 落地后一起实战复验。

## 界面重构 UI-01（本轮，VERIFY）
- 状态：`VERIFY`（实现、自动化与截图通过；观感与字体方案待用户确认）。
- 原因：反馈“UI 像网页 app”。移除毛玻璃、圆角胶囊与大段叙事侧栏，改为木牌营地语言：不透明深松绿面板、2px 描边、硬投影、切角、铜钉、刻度条与低对比点阵纹理；常驻 HUD 只保留决策信息。
- `index.html`：品牌改为像素字名plate；资源牌 4 格改为内联 SVG 图标（木材/零件/营地/击退）；角色状态改为头像 + 生命/体力 + 带键位角标的武器/医疗包/信号弹槽；操作提示改键位列；新增 `src/ui-fx.js`（资源数值变化时跳动，尊重 reduced-motion）。
- `src/style.css` / `src/ui-polish.css`：全部组件重写为统一令牌（`--ink/--gold/--parchment/--notch/--font-pixel`）；字体新增 Silkscreen（数字/键位）与 ZCOOL QingKe HuangYou（中文标题）经 Google Fonts 引入，正文回退 DM Sans/系统字体；覆盖顶栏、昼夜面板、工具栏、资源牌、底部目标卡、建造栏、操作提示、角色状态、建筑面板、手册、专长、结局、加载画幕与房车布置（RV 家具/电台 HUD 由本轮的 style.css 接管，替换并行会话的玻璃样式）。
- 修复：`#interior-panel[hidden]`、`#radio-alert[hidden]` 因 `display:flex` 覆盖 hidden 属性导致的常驻显示回归。
- 验证：`npm test` 44/44（含并行新增规则/状态机测试）；`npm run build` 通过（CSS 35.06 kB，JS 仍 >500 kB 警告）；浏览器回归 `combat`/`feel`/`nights`/`rv`/`interior`/`campaign`/`ambience`/`expanded-map`/`occlusion`/`audio` 均 PASS；`git diff --check` 通过。
- 截图：`artifacts/ui-hud-day.png`、`ui-hud-night.png`（1440×1000 同机位）、`ui-hud-720.png`（1280×720）、`ui-hud-mobile.png`（390×844）、`ui-hud-help.png`、`ui-hud-manual.png`、`ui-hud-building.png`；测试同时刷新 `rv-*`、`campaign-dawn*`、`combat-manual-*`、`nights-intel` 等实机截图。
- 已知限制：字体仍走 Google Fonts CDN，离线自托管与许可证审计未做（发行门槛）；未与参考视频逐帧比较，不宣称优于参考；真实 GPU 帧率未测；并行会话同时修改 `main.js`/规则，本轮只动标记与样式，未触碰游戏数值与存档。
- 附注：此前 `interior.browser.js` 偶发 “Execution context destroyed” 已定位为 Vite HMR 在并行写文件时整页重载，非游戏缺陷；对构建预览（静态服务）执行不受影响。

## 当前基线

- 外部营地、房车模型、昼夜循环、基础防守为可见基线。
- 地图已扩展至 180×180（可行走约 ±64），镜头可跟随玩家离开营地；外围暂无新交互点。
- 夜晚无法跳过战斗；夜间 UI 显示剩余敌人（含未生成）。
- 首屏在运行时 CSS 注入前已有深色背景与加载遮罩，不再短暂显示浏览器默认白底。
- 首屏资源遮罩按营地材质、环境细节、音频图表、字体和 shader 预热阶段显示真实进度，100% 后才进入场景。
- 防御规则模块 `src/rules.ts` 已含五夜波次、专长、武器、远征、维修/升级的**规则层**；当前工作区已有一部分敌人类型、武器与 HUD 接入，完成度以任务表与实际代码为准。
- 状态机与存档架构：设计见 `docs/STATE_MACHINE_DESIGN.md`；`xstate@5.33.2`，ARC-01..04 已实现（VERIFY），启动流程改为首页（开始新游戏 / 继续游戏）。

## 状态机与存档架构 ARC（全部实现，VERIFY）
- 设计：`docs/STATE_MACHINE_DESIGN.md`。XState 管理 `phase`（day/night/dawn/interior/victory/defeat）与 `overlay`（pause/help/manual）并行区域；context 直接复用 `rules.js` 的 `state`，纯函数作为 guards/actions，不做大规模重写。
- 存档点仅在新战役与黎明选完专长后的 day 状态；自有版本化 JSON，不持久化 XState 内部结构。
- ARC-01（VERIFY）：`src/machine.js` + `tests/machine.test.js`；12/12 单测覆盖合法/非法转移、RV 与暂停隔离、整局五夜循环、`perkAvailable` 与 `choosePerk` 一致性；`startCampaign()` 启动即跑 `assertPhaseSync`。
- ARC-02（VERIFY）：`main.js` 接入 actor——入夜/黎明/选专长/RV/暂停/营地归零全部走事件与 hooks；`state.paused`、`state.phase` 由 machine 单一写入；浏览器回归 campaign/combat/nights/nights-siege/feel/interior/rv 全 PASS。
- ARC-03（VERIFY）：建筑数据化进 `state.buildings`（含 id/lv/hp/朝向/投入），场景改为 `Map<id, {mesh,light}>` 视图；倒木 `state.logs` 带稳定 id；存档 JSON 往返、读档重建建筑由 `tests/save.*` 验证。
- ARC-04（VERIFY）：`src/save.js` 版本化 JSON + current/backup 双槽 + 损坏回退/容量/版本拒绝；首页 `src/home.js` 提供开始/继续与覆盖二次确认；真实首夜黎明检查点、刷新续玩、坏档回退、未来版本拒绝均由 `tests/save.browser.js` 通过。T6 随之落地。

## 打击感 FEEL-01（本轮，VERIFY）
- 状态：`VERIFY`（实现与自动化验证通过，实战观感待用户验收）。
- `src/feel.js`（纯函数、Node 单测）：镜头创伤模型（事件累加、按 `trauma²` 输出位移/缩放/侧倾、自动衰减归零）、hit-stop（真实时间计时，必然恢复）、`easeOutBack` 建造弹出、按敌人重量分级的停顿/创伤档位。
- 射击反馈：枪口实体闪光（加法混合八面体，白天也可见）+ 短促点光；弹道按武器颜色；命中闪白、身体后仰、击退冲量（Boss 不位移、破阵者减半）；击杀 0.5 秒倒地动画与碎裂粒子；击杀触发 hit-stop 与镜头震动，镜头震动可按 HUD「≈」关闭并本地保存，`prefers-reduced-motion` 默认关闭。
- 受击反馈：营地/角色受击红色渐晕、建筑受击木屑与抖动、营地失守与建筑摧毁加强震动；建造完成带 easeOutBack 弹出。
- 视觉反馈只在场景层，不修改 `src/rules.js` 数值、碰撞与存档权威数据；粒子/闪光全部走固定池并回收。
- `npm test` 20/20（含 `tests/feel.test.js` 4 项）、`npm run build` 通过；`node tests/feel.browser.js` PASS（真实第一夜战斗：枪口闪光 12、命中闪白 8、击退 8、后坐力 12、击杀 4、hit-stop 4、镜头震动帧 8；震动开关持久化与 reduced-motion 默认关闭；无页面错误）；`campaign`/`interior`/`ambience`/`expanded-map`/`occlusion` 浏览器回归 PASS。
- 截图：`artifacts/feel-day.png`、`feel-night-kill.png`、`feel-night-combat.png`（已查看，同机位昼夜；夜间命中闪白可见）。未测真实 GPU 帧时，不宣称帧率达标；观感强度待确认。

## 环境动效 ENV-01
- 状态：`VERIFY`（代码与浏览器检查通过，动效观感待用户确认）。
- 树林/草叶采用批次 GPU 风摆，阴影使用同一形变；灯串两端固定、中央轻晃。
- 白天浮尘/夜间萤火虫复用粒子，独立明灭；火光慢呼吸、烟雾随风漂移。
- 暂停冻结环境时间；动态响应系统 reduced-motion，关闭装饰摆动/浮粒/火光波动。
- `npm test` 2/2、`npm run build`、`node tests/ambience.browser.js`、`node tests/expanded-map.browser.js`、`git diff --check` 通过；无 JS/着色器错误。
- 同机位截图：`artifacts/breathing-day-a.png`、`breathing-day-b.png`、`breathing-night.png`。已对照查看，树冠位置跨时间变化；夜间远处树林仍偏暗。
- 保留静态几何合批，无新依赖；未测真实 GPU 帧时，不宣称 60fps 达标。下一步：用户确认动效强度，再做 T10 夜间可读性。

## 音频 AUD-01（本轮，VERIFY）
- 状态：`VERIFY`（基础播放/场景切换已验证；实战自适应层及听感仍需验收，不声称全部闭环已完成）。
- `src/audio.js`：Web Audio 运行时合成，零资产、零新依赖；昼/夜/房车内三套 32 小节原创编曲（主题→对答→间奏→再现），七声部（主旋/琶音/贝斯/和声铺底/对答/鼓组/铃音）分轨声像；房车版无鼓、慢速、低通滤波，进出房车在小节边界渐变切换；主旋/对答/贝斯轨独立电平。
- 音效 11 种：射击（人/塔双变体）、击退、建造、采集、建筑受损/摧毁、营地受击、入夜、黎明、失败、胜利；射击节流 65ms，受损 300ms。
- 静音持久化；浏览器手势后起播；暂停/隐藏标签页停止播放，恢复不重播积压；结局淡出 BGM、保留结局音效。隐藏标签页逻辑已接入，但本轮浏览器测试未专项覆盖。
- `v3-adaptive`：主旋双振荡微失谐、旋律声部卷积混响；附近存活敌人驱动平滑紧张度（心跳/低音衬底），不改游戏 RNG。距离计算与高紧张度加层已单测；实战听感未验收。
- `npm test` 6/6（含编曲结构、本地存储异常、敌情计算与加层）、`node tests/audio.browser.js` PASS（真实开关/滑杆/建造/入夜/暂停恢复，离线渲染 4 段 WAV：`artifacts/pinefall-day/night/interior/sfx.wav`，峰值/RMS/立体声非零）、`node tests/interior.browser.js` PASS（进入室内 `phase=interior`，退出恢复 `day`）、`npm run build`、`git diff --check` 通过；音频测试未发现页面 JS 错误。射击自动化等待曾超时，未列为本轮通过项；未用跳战/清敌掩盖。
- 截图：`artifacts/audio-day.png`（音乐 44% 滑杆生效）、`audio-night.png`。未做用户听测；试听文件为 22.05kHz 离线渲染，与游戏共用乐谱/声部/滤波/混响；不含实时主总线压缩与实际战斗混音。夜曲后半段固定演示 0.85 紧张度。下一步：用户试听三曲，随后真实夜战检查紧张层、射击遮蔽及循环接缝；不继续盲加声部。

## 角色遮挡剪影 VIS-01
- 状态：`VERIFY`（实现及浏览器验证通过，颜色/透明度待用户确认）。
- `src/occlusion.js` + `src/main.js`：仅玩家增加跟随动作的淡青色半透明剪影，深度测试限制在被遮挡区域，stencil 避免自身遮挡误显和肢体叠色；不改环境透明度、碰撞或战役规则。
- `node tests/occlusion.browser.js` PASS：真实键盘走到房车背面；像素测试覆盖无遮挡、完全/部分遮挡、遮挡物位于身后、移开后无残留、重叠肢体透明度一致，无 JS/shader 错误。
- 已查看同机位 `artifacts/occlusion-before-day.png`、`occlusion-day.png`、`occlusion-night.png`：原先人物不可见，开启后车顶区域能看见人物剪影；白天奶白车顶上的对比弱于夜晚。
- 最终复跑 `npm test` 8/8、`npm run build`、`git diff --check` 通过（含并行新增规则测试；仍有 >500kB 警告）；室内及环境浏览器回归在此前构建预览服务 5174 上通过。开发服务上的室内测试曾因执行上下文销毁中断，原因未确定，不列为该次通过。
- 下一步：用户确认轮廓强度；真实 GPU 性能未测，不宣称帧率达标。没有新增依赖或全屏后处理。

## 战斗深度与营地经营 CMP-01（本轮，VERIFY）
- 状态：`VERIFY`（功能与自动化验证通过；五夜全程实战与观感待用户确认）。
- 敌人：`src/world.js` 新增四种独立体块模型（游荡者/疾行者/破阵者/林中巨影，含护甲板、鹿角、发光双目），身体合并为单网格 + 双腿控制绘制次数；生成改为 `wavePlan` 的路线与间隔，掉出固定三点、种族数值、护甲减伤（`applyArmor`，上限 70%）、拆墙倍率、首领血条与出场提示。巨影击杀有额外特效。
- 武器：Tab 手册工坊以 10 零件解锁并装备；卡宾枪/霰弹枪/猎人步枪的射程、伤害、间隔、穿甲与多目标由 `rules.js` 驱动；`X` 循环切换，HUD 显示当前武器。
- 主动能力：`Shift` 冲刺（体力 30、0.22s、短暂无敌），`Q` 信号弹（半径 5、5s、冷却 25s、首领减速弱），`F` 医疗包（60，满血不消耗）；角色生命/体力/医疗包/冷却独立 HUD；敌人贴近会攻击角色，倒下扣营地 15 并在篝火旁半血复活（2.5s 保护）。
- 建筑：点击建筑打开操作面板；升级（20×等级木材、4×等级零件，上限 3 级）后重建模型并提升塔伤害/射程/射速、灯减速半径、栅栏耐久；维修 10 木材；拆除返还 60% 已投入资源并在按钮明示。
- 环境：新增门口挂灯与暖光、踏步石、劈柴堆、独轮车、林下蘑菇、独木舟、三条小径木路牌；夜晚增加月光与角色提灯。
- 验证：`npm test` 20/20（新增 `tests/combat.test.js`：护甲、波次计划、武器解锁、倒地/体力、升级退款、远征）；`npm run build`、`git diff --check` 通过。
- 浏览器：`node tests/combat.browser.js` 通过——真实手册远征（扣 50 秒、−20 生命）、工坊解锁并装备步枪、冲刺耗体力、信号弹进冷却、医疗包边界、放置/选中/升级/拆除栅栏（返还 21 木材 + 2 零件）、首夜按路线刷出游荡者；截图 `artifacts/combat-manual-workshop.png`、`combat-building-panel.png`、`combat-night-typed.png`。
- 回归：campaign、ambience、expanded-map、audio、interior、occlusion、feel 浏览器测试全部通过（生产预览构建；interior/occlusion/audio 的离线渲染在 5173 开发服务运行）。
- 接触伤害冒烟：站到北径出生点，敌人接触使 `playerHp 100→96` 且营地保持 100；完整倒地实战未覆盖，倒地数值由单测保证。
- 截图：`artifacts/enriched-day.png` / `enriched-night.png`（1404×1080 无 HUD）、`enriched-hud-1280.png`、`enriched-manual-mobile.png`、`enriched-manual-intel.png`；已查看，photo 模式不再显示角色条。
- 并行完成的打击反馈（`src/feel.js`：枪口闪光、受击闪白、击退、后坐、hit-stop、镜头震动与开关）已合并，`tests/feel.*` 通过；未测真实 GPU 帧时，不宣称帧率达标。

## 房车布置 RV-GAMEPLAY（本轮，VERIFY）
- 状态：`VERIFY`（功能与自动化验证通过；跨夜取舍实战与窗外色标强度待用户确认）。产品文档：`docs/RV_INTERIOR_PRODUCT.md`。
- 定位：外部营地决定今晚，房车决定接下来几晚；功能家具与防线争抢同一份木材/零件，且必须当晚可见效果。
- 家具：工作台（▰25 ⚙4，武器解锁门禁 + 每晚二选一：伤害 +1 / 射程 +1，黎明重置）、短波电台（▰10 ⚙6，情报页时间轴 + 夜战"下一路 + 倒计时"）、医疗柜（▰15 ⚙3，医疗包上限 3、安装补 1、黎明补 1）；装饰：窗台绿植、拼布暖毯、旅途照片绳（只改视觉）。
- 槽位：功能槽 1/2/3 个随第 1/2/3 天解锁；装饰槽 3 个首日全开；同一家具唯一；拆除返还 60%。禁用时显示具体原因（功能槽不足 / 材料不足 / 只能白天）。
- 场景：`src/interior.js` 6 件模型与空槽标记、功能模块沿切面 z=1.6、装饰锚定台面/床/北墙，不侵入过道；`src/world.js` 的 `rvGlow` 让朝营地两扇窗在夜里透出暖光和模块色标/剪影，白天不发光。
- 规则：`src/rules.js` 新增 `RV/_FURNITURE/WEAPON_MODS` 与 `rvSlots/furnitureReason/installFurniture/uninstallFurniture/maxMedkits/setWeaponMod/weaponDamage/weaponRange/spawnTimeline`；`unlockWeapon` 需要工作台；`advance` 黎明清改装并补给医疗柜。
- 验证：`npm test` 55/55（含 `tests/rv.test.js`、扩展的 `tests/interior.test.js`）；`node tests/rv.browser.js` PASS（进车→装工作台→选射程改装 `playerRange 10`→槽位拒绝→拆返还→装电台→情报时间轴→入夜预警与 `windowGlow > .2`）；`combat.browser.js` 已按工作台门禁更新；campaign/feel/nights/ambience/expanded-map/audio/interior/occlusion 回归 PASS；`npm run build`、`git diff --check` 通过。
- 截图：`artifacts/rv-slots-day.png`（六槽面板）、`rv-workbench-installed.png`（工作台+改装高亮）、`rv-radio-installed.png`、`rv-intel-radio.png`（时间轴）、`rv-night-radio.png`、`rv-night-windows.png`（拉近后窗光可读）。
- 未覆盖：第 2/3 功能槽的真实跨夜浏览器验证（仅单测）；医疗柜跨夜补给仅单测；窗外模块色标在远视角不显眼；自由网格/旋转与存档仍不做。

## 任务状态

### 房车内部（提案见 `docs/RV_INTERIOR_PROPOSAL.md`）
| 任务 | 状态 | 证据/说明 |
|---|---|---|
| RV-01 室内布局与进入规则 | VERIFY | 采用独立近景切面，白天进入；布局观感待用户确认 |
| RV-02 进入/退出房车 | VERIFY | E/门口按钮进入，WASD 过道移动，E/Esc/按钮退出原位置；镜头过渡已实现（详见下）；浏览器闭环通过 |
| RV-03 家具布置闭环 | VERIFY | 槽位制（功能 3 槽按天解锁 + 装饰 3 槽）、6 件家具、成本/禁用原因/拆除 60% 返还；自由网格与旋转仍不做（见产品文档 §8） |
| RV-04 功能家具（工作台/电台/医疗柜） | VERIFY | 工作台=武器解锁门禁+每晚二选一改装；电台=时间轴+夜战下一路预警；医疗柜=上限 3+安装补 1+黎明补 1；均浏览器/单测验证 |
| RV-05 窗光与室外剪影反馈 | VERIFY | `rvGlow` 朝营地双窗夜光 + 模块色标/剪影；灯开关联动；白天不发光；截图 `rv-night-windows.png` |
| RV-06 昼夜/资源/存档验收 | VERIFY | 规则/室内/浏览器测试与回归已跑；家具列表随 T6 检查点持久化（`state.rv` 入存档），跨夜布置续玩待用户实测 |

### 战役主线（P0：五夜战役可完整游玩）
| 任务 | 状态 | 说明 |
|---|---|---|
| T1 专长/武器/远征规则 | VERIFY | 专长与武器/远征均已接入真实 UI；余火守望生命上限、营造专家维修加成生效；五夜全程实战仍待跑 |
| T2 敌人类型差异化（外观/行为/血条） | VERIFY | 四种独立模型 + 种族数值/护甲/拆墙 + 巨影血条；首夜路线生成浏览器验证，其余类型仅规则层覆盖 |
| T3 武器切换与工坊 | VERIFY | Tab 工坊解锁/装备 + `X` 切换；浏览器验证步枪解锁闭环 |
| T4 主动能力（冲刺/信号弹/医疗包） | VERIFY | 三技能与 HUD 接入；浏览器验证冲刺/信号弹/医疗包，倒地惩罚为单测+接触冒烟 |
| T5 战前情报界面 | VERIFY | 手册情报页显示波次名、提示、组成、路线、数量与危险说明 |
| T6 黎明检查点存档（版本化 JSON） | VERIFY | ARC-04 落地；`tests/save.test.js` 6 项 + `tests/save.browser.js` 真实黎明写入/首页续玩/坏档回退/高版本拒绝通过 |
| T7 夜间剩余敌人计数 | DONE | 浏览器验证：`artifacts/night-counter-ui.png` |
| T8 建筑升级/维修/拆除 | VERIFY | 点击面板 + 等级模型变化 + 60% 返还；浏览器验证放置/升级/拆除 |
| T9 每日远征入口 | VERIFY | 手册远征页，白天一次，扣白天预算；浏览器验证山脊中继站 |
| T10 美术：夜间树背光与地表改良 | DOING | 增加月光与角色提灯、路牌与营地杂项；夜间远林仍偏暗，待对照视频继续 |
| T11 首日引导 | TODO | 手册与情报已就位，尚未做首日分步引导 |
| T12 性能基线（真实 GPU 60fps 实测） | TODO | headless 数字不算实测 |

### 路线图任务（详见 `docs/ROADMAP.md`，M1 可玩性拐点）
| 任务 | 状态 | 说明 |
|---|---|---|
| NGT-01 五夜课题化（意图/建议/呼吸） | VERIFY | 见上 NGT 段落；规则单测 + 情报浏览器验证 |
| NGT-02 敌人意图行为（破阵者冲塔/吐息者/潜行者） | VERIFY | 真实第 3 夜观测冲塔与吐息；潜行者显形为单测覆盖 |
| NGT-03 情报页升级 | VERIFY | `tests/nights.browser.js` 校验课题/建议/意图标签 |
| NGT-04 夜晚环境差异（雾/能见度） | VERIFY | 第 4 夜迷雾影响灯光与潜行者显形；风向未做 |
| ECO-01 经济重平衡 | TODO | 不能全都要 |
| ECO-02 白天时间压力 | TODO | 采集/远征不能全做 |
| ECO-03 建造位上限 | TODO | 分类上限 + 剩余位 UI |
| ECO-04 修复与耐久收紧 | TODO | 漏怪后果跨夜可见 |
| META-01 黎明评分 | VERIFY | 规则单测 + 黎明模态显示评分/明细；`nights-siege` 浏览器断言 |
| BLD-01/02/03 建筑分支与协同 | TODO | 三级分支、协同、面板 |
| SKL-01..04 技巧空间 | TODO | 目标优先级、冲刺、信号弹、抢修 |
| META-02/03/04 恶兆/解锁/存档 | TODO | 重玩驱动 |
| WLD-01/02/03 世界与引导 | TODO | 地标、营地外观、首日引导 |

### 发行门槛（P2）
桌面包、离线启动、许可证审计、本地化、崩溃报告、Steamworks、外部试玩 ≥5 人、设备矩阵——全部 TODO，不随本里程碑承诺。商业音频（录音/采样库或委托配乐）未立项，当前为运行时合成。

## 已知缺口
1. 第五夜巨影与破阵者/疾行者的完整实战（含胜利结算）未全程浏览器验收，目前仅规则单测与首夜实战覆盖；T6/ARC 存档已落地。
2. 角色完整倒地流程（扣营地 15、篝火旁半血复活）为单测 + 接触伤害冒烟，未在浏览器中真实倒下验收。
3. 夜间建造栏禁用，但已选中的建筑幽灵预览可能残留（待复现，见下轮验证项）。
4. 外围扩展区域暂无资源点/地标（等待 T11 落地）；路牌仅是视觉提示。
5. 建筑被摧毁时无耐久条以外的可读反馈，暴击/闪避等未做。
6. 首页观感、标题镜头与继续游戏信息待用户实机验收；存档只落黎明/新战役，当日建设退出后回到本日黎明是既定边界；`?home=1` 为自动化测试显示首页的钩子（webdriver 默认跳过首页）。

## T1 黎明专长闭环（VERIFY）
- 原生模态、键盘/窄屏支持；选择期间冻结时间与游戏输入，不能 Esc 跳过，已选项不重复，领取后 HUD 显示。第五夜调用胜利结算；败局仍可重开。
- `npm test` 8/8、`npm run build`、`node tests/audio.browser.js`、`node tests/campaign.browser.js` 通过。战役浏览器测试通过实际 UI 建两座塔、击退 10 名敌人，抵达第二天（营地 100%），验证 Esc/N/P/移动隔离、键盘领取神射手并进入第二夜；不注入状态、不清敌。
- `node tests/interior.browser.js` 首次因 execution context destroyed 中断，重跑 PASS；未认定偶发导航根因已修复。`git diff --check` 通过。
- 已查看 `artifacts/campaign-dawn.png`、`campaign-dawn-mobile.png`；同机位准备/夜战 `campaign-preparation.png` / `campaign-first-night.png` 已保存。原场景未改。
- 五夜规则推进/胜败为单测覆盖，不能据此声称全程实战通关；余火守望、维修与零件用途的未接入限制在卡片明示。构建仍有 >500 kB 提示。

## 本轮验证
- `npm test` 5/5；`npm run build` 通过。
- 首屏启动：Chromium 首个提交阶段检查到 `html/body` 深色背景，`#loading` 为全屏固定遮罩；未出现默认白底。
- 加载进度：Chromium 检查 `window.__pinefall.loading.progress === 100`、`#loading` 的 `aria-valuenow=100` 后才淡出；初始音频状态为 `locked`，点击声音按钮后进入 `running` 且开始调度。
- `tests/ambience.browser.js` PASS；`tests/expanded-map.browser.js` PASS；均无页面错误。
- `tests/expanded-map.browser.js` PASS（键盘走到 (-55.7,-5.7)，镜头跟随，无错误）。
- 夜间 UI：进度条隐藏、剩余敌人数正确；夜战敌人分批、击退计数正常。

## RV-02 镜头过渡（本轮）
- 进入/退出均走 0.9s 过渡：室外镜头向门口推进并放大（zoom 1→1.55），半程淡入室内，室内轻微推近（1.12 倍）后回到原位；`#rv-fade` 全屏遮罩驱动，不再直接跳切。
- 过渡期间锁输入（点击/滚轮/建造/入夜/E/N），时间冻结；结束恢复原 zoom 与位置。系统 reduced-motion 跳过镜头移动直接切换。
- `node tests/interior.browser.js` 通过：过渡中禁交互、预算不变、zoom 归位；截图 `artifacts/rv-enter-transition.png`（已查看，淡入中）。回归 `npm test` 5/5、`npm run build`、ambience/expanded-map 浏览器测试、`git diff --check` 全部通过。

## RV-02 本轮证据
- `node tests/interior.browser.js` 通过：真实绕车步行、远程拒绝、门口进入、过道碰撞、时间冻结、禁建/禁入夜、暂停拒绝操作、退出原位置、再次进入、窄屏按钮退出、夜间拒绝进入；无 JS/shader 错误。
- `npm test` 2/2、`npm run build`、`node tests/ambience.browser.js`、`git diff --check` 通过。构建仍有 >500kB 警告。
- 已查看 `artifacts/rv-interior.png` 与 `rv-interior-mobile.png`；另存 `rv-door-day.png` / `rv-door-night.png`。窄屏完整展示但场景较小，后续可优化视角。
- 固定床铺/厨房/餐桌仅为陈设；家具布置、工坊、存档及进入镜头过渡未实现，不宣称整款游戏完成。

## 下一步（按优先级）
1. 用户验收工具链迁移（`vp check` / `vp test` / `vp build` 日常使用无阻塞）后 TOL-01 转 DONE；随后按需启用 `vp staged` 钩子与 CI 首次运行。
2. 用户验收首页（开始/继续/覆盖确认/点击篝火火星）与存档边界（黎明检查点、坏档回退提示）；确认后 ARC-01..04 与 T6 可转 DONE。
3. 五夜胜败实战与完整倒地流程验收；随后 T2 敌人差异化（外观 + 波次配置生成）与 NGT-01 课题化。
4. RV-03 自由网格/旋转仍是产品待议项；RV-06 跨夜家具续玩随本次存档落地，待实测确认。

## RV-ART-01 床头灯交互与室内细节（本轮）
- `src/interior.js`：床铺/餐区/厨房/门边补足生活陈设（坐垫毯、床尾毯、书本内页、座下储物篮、搪瓷水壶、砧板面包、擦手巾、香料罐、悬挂勺具、餐区旅行地图与马克杯、地板条、墙面相片绳、门边挂钩包），均不侵入过道；室内面板新增「床头灯」开关。
- 开关同时改变灯罩（发光/哑光双网格切换）、真实点光源强度与摆杆角度；纯会话内状态，不产生资源收益，不代表存档或家具布置已实现。
- `src/main.js`：空格默认仅阻止页面滚动，不再吞按钮激活；房间内暂停时拒绝灯开关（与其它室内操作一致）；诊断接口暴露 `lampOn`，浏览器测试直接断言场景灯光。
- 测试修复：`tests/interior.browser.js` 行走助手按键时长按剩余距离缩放，消除障碍旁固定步长振荡导致的偶发超时（测试自身缺陷，非场景问题）。
- 验证：`npm test` 9/9（新增 `tests/interior.test.js` 开关联动+过道不被家具阻塞）、`npm run build`、`node tests/interior.browser.js`（开关/暂停拒绝/退出重进保留/1280×720 截图）、ambience/expanded-map/occlusion/audio 浏览器回归、`git diff --check` 全部通过。
- 截图：`artifacts/rv-details-light-on.png`、`rv-details-light-off.png`（同机位开关对比，已查看：关灯后暖光区消失、灯罩转暗、过道仍可辨）、`rv-details-720.png`。未实测真实 GPU 帧时。
