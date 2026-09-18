# PINEFALL 开发状态

> 本文件记录实际代码状态和已确认任务。设计讨论稿不等于功能完成。  
> 状态：TODO / DOING / PARTIAL / VERIFY / DONE / BLOCKED

## 当前基线

- 外部营地、房车模型、昼夜循环、基础防守为可见基线。
- 地图已扩展至 180×180（可行走约 ±64），镜头可跟随玩家离开营地；外围暂无新交互点。
- 夜晚无法跳过战斗；夜间 UI 显示剩余敌人（含未生成）。
- 首屏在运行时 CSS 注入前已有深色背景与加载遮罩，不再短暂显示浏览器默认白底。
- 首屏资源遮罩按营地材质、环境细节、音频图表、字体和 shader 预热阶段显示真实进度，100% 后才进入场景。
- 防御规则模块 `src/rules.js` 已含五夜波次、专长、武器、远征、维修/升级的**规则层**，但多数尚未接入 UI 或场景，具体见任务表。

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

## 任务状态

### 房车内部（提案见 `docs/RV_INTERIOR_PROPOSAL.md`）
| 任务 | 状态 | 证据/说明 |
|---|---|---|
| RV-01 室内布局与进入规则 | VERIFY | 采用独立近景切面，白天进入；布局观感待用户确认 |
| RV-02 进入/退出房车 | VERIFY | E/门口按钮进入，WASD 过道移动，E/Esc/按钮退出原位置；镜头过渡已实现（详见下）；浏览器闭环通过 |
| RV-03 家具布置闭环 | PARTIAL | 本轮新增床头灯可开关陈设（灯罩+真实点光+摆杆联动，会话内保留状态）；网格布置、旋转、撤销仍未做 |
| RV-04 功能家具（工作台/电台/医疗柜） | TODO | 待用户确认三件套 |
| RV-05 窗光与室外剪影反馈 | TODO | |
| RV-06 昼夜/资源/存档验收 | TODO | |

### 战役主线（P0：五夜战役可完整游玩）
| 任务 | 状态 | 说明 |
|---|---|---|
| T1 专长/武器/远征规则 | PARTIAL | 专长选择闭环 VERIFY：真实首夜清场→领取→第二夜已验证，玩家/塔伤害与采集加成已接入；武器/远征/角色生存仍未接入 |
| T2 敌人类型差异化（外观/行为/血条） | TODO | 数据已定义，模型仍是同一种外观 |
| T3 武器切换与工坊 | TODO | |
| T4 主动能力（冲刺/信号弹/医疗包） | TODO | |
| T5 战前情报界面 | TODO | |
| T6 黎明检查点存档（版本化 JSON） | TODO | 依赖 T1 专长 UI |
| T7 夜间剩余敌人计数 | DONE | 浏览器验证：`artifacts/night-counter-ui.png` |
| T8 建筑升级/维修/拆除 | TODO | 规则已有 `upgrade/repair`，无 UI 与模型变化 |
| T9 每日远征入口 | TODO | |
| T10 美术：夜间树背光与地表改良 | TODO | 对照视频逐项核查 |
| T11 首日引导 | TODO | |
| T12 性能基线（真实 GPU 60fps 实测） | TODO | headless 数字不算实测 |

### 发行门槛（P2）
桌面包、离线启动、许可证审计、本地化、崩溃报告、Steamworks、外部试玩 ≥5 人、设备矩阵——全部 TODO，不随本里程碑承诺。商业音频（录音/采样库或委托配乐）未立项，当前为运行时合成。

## 已知缺口
1. T1 专长 UI 已接入；余火守望暂无实战生存用途（卡片已标注），第五夜结算未全程浏览器实战验收。T6 存档尚未实现。
2. 敌人生成仍用固定三点，未按 `WAVES` 的 lane/spacing 配置；接入时保留组间呼吸。
3. 夜间建造栏禁用，但已选中的建筑幽灵预览可能残留（待复现，见下轮验证项）。
4. 外围扩展区域暂无资源点/地标（等待 T9/T11 落地）。

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
1. 用户确认床头灯交互方向后，推进 RV-03 网格布置与 RV-04 功能家具（工作台/电台/医疗柜）；验证五夜胜败实战及重复领取边界。
2. T2 敌人差异化（外观 + 波次配置生成）。
3. T6 黎明存档（依赖 T1）。

## RV-ART-01 床头灯交互与室内细节（本轮）
- `src/interior.js`：床铺/餐区/厨房/门边补足生活陈设（坐垫毯、床尾毯、书本内页、座下储物篮、搪瓷水壶、砧板面包、擦手巾、香料罐、悬挂勺具、餐区旅行地图与马克杯、地板条、墙面相片绳、门边挂钩包），均不侵入过道；室内面板新增「床头灯」开关。
- 开关同时改变灯罩（发光/哑光双网格切换）、真实点光源强度与摆杆角度；纯会话内状态，不产生资源收益，不代表存档或家具布置已实现。
- `src/main.js`：空格默认仅阻止页面滚动，不再吞按钮激活；房间内暂停时拒绝灯开关（与其它室内操作一致）；诊断接口暴露 `lampOn`，浏览器测试直接断言场景灯光。
- 测试修复：`tests/interior.browser.js` 行走助手按键时长按剩余距离缩放，消除障碍旁固定步长振荡导致的偶发超时（测试自身缺陷，非场景问题）。
- 验证：`npm test` 9/9（新增 `tests/interior.test.js` 开关联动+过道不被家具阻塞）、`npm run build`、`node tests/interior.browser.js`（开关/暂停拒绝/退出重进保留/1280×720 截图）、ambience/expanded-map/occlusion/audio 浏览器回归、`git diff --check` 全部通过。
- 截图：`artifacts/rv-details-light-on.png`、`rv-details-light-off.png`（同机位开关对比，已查看：关灯后暖光区消失、灯罩转暗、过道仍可辨）、`rv-details-720.png`。未实测真实 GPU 帧时。
