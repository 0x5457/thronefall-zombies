# PINEFALL 开发日志

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
