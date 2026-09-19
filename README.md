# PINEFALL · 松林余烬

俯视角动作 + 营地建设 + 轻量生存防守的单人游戏。白天在松林营地采集、建造、跑远征、布置房车，夜晚亲自守住营地，熬过五个昼夜等到救援。

项目参考了 Thronefall 式「短局重玩」形态：一局五夜、约 20–30 分钟，靠评分、恶兆与构筑组合产生重复可玩性。当前处于**原型阶段**，首个五夜章节已可完整游玩并通过自动化通关验证，尚未达到商业发行标准。

## 当前状态

- 五夜战役闭环：白天建设 / 远征 / 房车布置 → 夜晚分组来袭 → 黎明结算与专长 → 胜利或失败。
- 真实浏览器回归：单测 92 项、浏览器测试 20 个文件全部通过；五夜实战通关 3/3（不注入状态、不清敌、不跳夜）。
- 开发进度、证据与已知缺口以 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) 为准；设计目标见 [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)。

## 玩法概览

- **白天**：采集倒木、建造瞭望塔/木栅栏/营地灯并升级维修、从营地手册接每日远征、进入房车安装家具（工作台/短波电台/医疗柜）与武器改装。
- **夜晚**：亲自走位防守，使用卡宾枪/霰弹枪/猎人步枪、冲刺、信号弹、医疗包；敌人有游荡者、疾行者、破阵者、腐吐者、潜行者与首领巨影。
- **成长**：每次守夜成功从四项专长中选一项；武器用零件在工坊解锁。
- **存档**：新战役与每个黎明（选完专长后）写入本地检查点，战斗中退出回到本日黎明。

## 操作

| 按键                                              | 作用                               |
| ------------------------------------------------- | ---------------------------------- |
| `WASD` / 方向键 / 左键点地                        | 移动                               |
| `E`                                               | 互动（采集、进出房车）             |
| `1` `2` `3`                                       | 选择建筑，`R` 旋转，左键放置       |
| `Shift`                                           | 冲刺（消耗体力，短暂无敌）         |
| `Q`                                               | 信号弹（范围减速）                 |
| `F`                                               | 医疗包                             |
| `X`                                               | 切换已解锁武器                     |
| `Tab`                                             | 营地手册（工坊 / 远征 / 情报）     |
| `N` / 「迎接夜晚」                                | 提前开战；计时到点会先弹出战前确认 |
| `P` 暂停，`Esc` 取消/返回，`H` 隐藏 HUD，滚轮缩放 |                                    |

自动化测试钩子：`?home=1` 强制显示首页，`?tune=1` 在开发模式挂载 Tweakpane 调参面板。

## 快速开始

环境：Node 24+、npm ≥ 11。开发工具链为 Vite+ 0.3.3（`vp`），项目已固定版本。

```bash
npm ci            # 安装依赖
npm run dev       # 开发服务器 http://localhost:5173/thronefall-zombies/
npm run build     # 生产构建（dist/）
npm run preview   # 预览构建产物
npm test          # Vitest 单测
npm run check     # 格式 + lint + 类型（vp check）
npm run test:browser [filter]   # 全部浏览器测试
```

浏览器测试需要先启动服务：默认指向 `http://localhost:5173/thronefall-zombies/`，可用 `GAME_URL` 覆盖；`audio`/`occlusion` 必须使用 dev server，其余可对 `npm run preview` 的稳定构建运行。

## 技术栈

- **语言**：TypeScript（strict），`src/` 与 `tests/` 全量类型检查。
- **渲染**：Three.js（低多边形程序化场景，无外部美术资产）。
- **UI**：React 19 + `@xstate/react`，XState 5 管理游戏阶段与模态，i18next 管理文案。
- **规则**：`src/rules.ts` 是运行时数值与纯函数的唯一来源，场景层只做表现。
- **存档**：自有版本化 JSON + zod schema 校验，本地双槽回退。
- **音频**：Web Audio 运行时合成的原创音乐与音效，零音频资产。
- **工具链**：[Vite+](https://viteplus.dev)（Vite 8 / Rolldown / Vitest / Oxlint / Oxfmt）。

## 项目结构

```
src/
  main.ts          游戏主循环与场景接线
  rules.ts         运行时规则唯一来源（数值/波次/专长/武器/家具/纯函数）
  world.ts         地形、营地、房车、植被、敌人模型
  interior.ts      房车近景切面
  machine.ts       XState 状态机（day/night/dawn/interior/overlay）
  save.ts          版本化存档（zod 校验、双槽回退）
  audio.ts         运行时合成音乐/音效
  feel.ts          打击感（镜头创伤、hit-stop 等纯函数）
  occlusion.ts     角色遮挡剪影
  rv.ts            房车家具与电台
  ui/              React UI（HUD、手册、对话框、面板、store）
  home.tsx         首页（标题镜头 / 开始 / 继续）
  locales/         i18n 文案
tests/             单测 *.test.ts 与浏览器测试 *.browser.ts
docs/              设计、开发状态、路线图、状态机、开发日志
scripts/           浏览器测试入口
artifacts/         本地验证截图与音频（不提交）
```

## 文档索引

| 文档                                                         | 内容                             |
| ------------------------------------------------------------ | -------------------------------- |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md)                   | 产品定位、机制、美术与范围       |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)                   | 当前状态、任务表、证据与已知缺口 |
| [docs/ROADMAP.md](docs/ROADMAP.md)                           | 阶段任务拆分与里程碑             |
| [docs/STATE_MACHINE_DESIGN.md](docs/STATE_MACHINE_DESIGN.md) | 状态机与存档架构                 |
| [docs/DEVLOG.md](docs/DEVLOG.md)                             | 逐轮开发记录与验证结果           |
| [AGENTS.md](AGENTS.md)                                       | 协作约定与开发纪律               |

## 说明

- 场景与音频均为运行时程序化生成，未复用任何第三方游戏资产。
- 发行相关事项（桌面包、离线启动、字体自托管、本地化审计、Steamworks 等）尚未完成，详见 `GAME_DESIGN.md` §9。
