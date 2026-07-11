# Soulloom：Hermes Tweet-to-Game Buildathon 方案

> **One internet moment in. One playable world out.**
>
> **We don’t generate game code. We operate an autonomous game studio.**

## 1. 项目定位

Soulloom 不是一个普通的“AI 生成小游戏”工具，而是一间由 Hermes 驱动的微型自主游戏工作室。

用户输入一条 tweet，Hermes Studio Manager 根据内容组织编剧、战斗设计、美术指导、配音和 QA Agent。各 Agent 交付结构化中间产物，Manager 验收、返工并最终发布一个真实可玩的网页 Boss 战。

首个演示输入来自 Tibo 的回复：

> I smell fear.

它被转化为一个 gothic soulslike 微型 Boss 战：玩家对抗带有 Claude/Fable 气质暗示的 Boss **The Fable of Absolute Agreement**。Boss 在二阶段大招或败北时，通过 ElevenLabs 说：

> You are absolutely right!

角色只做戏仿和风格暗示：暖橙、象牙白、书卷、终端符号、过度礼貌的神谕语气；不直接复制 Anthropic 标识、具体角色资产或真实人物声线。

## 2. 为什么选择 AI as Agency 赛道

Hermes Buildathon 的 AI as Agency 赛道要求一组 Agent 替代一个完整的人类职能，并重点考察：

- 真实产品是否交付真实输出
- Manager 与 Specialists 的组织方式
- 是否存在动态委派、审阅和返工
- Agent handoff 与 memory
- 可观测性、耗时和成本
- eval 与持续改进
- 非工程用户可操作的管理界面

Soulloom 对应的是一间自主游戏工作室：

```text
用户 Brief
→ Studio Manager 制定计划
→ Specialists 生产结构化 artifacts
→ QA 验收
→ Manager 根据失败原因定向返工
→ Regression test
→ 发布可玩的游戏 URL
```

Tweet 只是最直观、最有传播力的输入界面。产品本质是：

> **Agentic Game Studio：把互联网正在发生的事件自动制作、测试并发布成可玩的互动世界。**

主赛道应选择 **AI as Agency**，同时通过每个游戏的独立 URL、战绩卡和“把回复变成下一个 Boss”的循环争取 Virality cross-track bonus。

## 3. 核心范围原则

### 不让 Agent 现场生成任意游戏代码

8 小时内最危险的方案，是让 Agent 从零编写 HTML/JavaScript、地图和战斗逻辑。生成结果难以预测，也无法保证可玩。

正确方案是：

> **固定游戏引擎 + Hermes 生成受约束的 BossSpec + 少量动态资产。**

游戏 runtime 永远不变。Agent 只生成内容、参数和有限组合，再由固定引擎即时装配。

这不是缺点，而是产品可靠性的来源。游戏引擎本身就是一个受约束的运行时；Agent 工作室负责叙事、战斗设计、美术方向、声音和验收，而不是每次重新发明引擎。

## 4. 推荐技术栈

### 游戏端

- Vite
- TypeScript
- Three.js
- 固定 `createBattleScene` 表现层 + 可测试的 `BattleController` 状态机
- 程序化几何、灯光、雾、粒子、地面预警和克制的相机震动
- 桌面键盘优先

### 编排与服务端

- Node.js / Express
- Hermes 作为 Studio Manager 和 specialist 调度器
- 所有 specialist 只交付 JSON 或文件 artifact
- SSE 或 WebSocket 将 Agent 状态推送到管理 UI

### 状态与部署

- Convex：保存 run、Agent 事件、BossSpec、eval 和生成历史
- Cloudflare：公开页面、静态资产或 Tunnel/Worker
- ElevenLabs：生成与游戏事件绑定的 Boss 语音

### 为什么选 Three.js

早期 2D 原型使用固定 `960×540` 后备画布，在更大的 CSS 容器和高 DPI 屏幕上被放大，导致场景和文字明显模糊。Three.js 按容器真实尺寸和设备 DPR 输出后，视觉清晰度、空间氛围和 Boss 舞台感都显著提升，因此正式采用 Three.js。

为了控制 3D 风险，runtime 保持严格受限：

- 不依赖外部角色模型、骨骼动画或运行时资产生成
- 战斗碰撞使用独立的二维状态机，不与渲染对象耦合
- 扇形、直线和圆环预警全部使用固定程序化几何
- 使用单一固定镜头、有限灯光、雾和低多边形剪影
- DPR 上限为 2，兼顾高清输出和 GPU 成本

视觉借鉴魂系游戏的压迫感、克制 HUD、底部 Boss 血条和阶段仪式感，但不复制既有 IP 的角色、地点、武器、纹章、音乐或界面资产。

## 5. 游戏最小规格

### 体验目标

- 单场景、单 Boss
- 单局约 60–180 秒
- 3–5 分钟内允许一次死亡和快速重试
- 第一秒即可操作
- 死亡后 2 秒内重开
- 稳定性优先于内容数量

“Soulslike”只保留：

> **预警 → 闪避 → 反击 → 阶段升级**

不做地图、装备、成长、背包、多 Boss、复杂连招或联机。

### 操作

| 输入 | 功能 |
|---|---|
| WASD / 方向键 | 八方向移动 |
| Space | 翻滚冲刺，约 0.18 秒无敌帧 |
| J / 鼠标左键 | 自动朝向 Boss 的近战攻击 |
| Enter | 死亡或胜利后重开 |

### 玩家

- 生命：3 格
- 固定攻击伤害与约 0.35 秒冷却
- 翻滚约 0.8 秒冷却
- 翻滚时有残影和明显无敌反馈
- 受击时有击退、红色闪屏、震屏和短暂无敌
- MVP 不做耐力条；翻滚冷却已经足够产生决策

### Boss

Boss 名称：

> **The Fable of Absolute Agreement**

视觉方向：

- 高大黑色剪影或悬浮几何神像
- 暖橙、象牙白、暗紫色光环
- 裂纹面具、卷轴或终端符号
- 冷静、礼貌、过度确信的神谕语气

开场字幕或语音：

> I smell fear.

半血阶段转换：

> You are absolutely right!

如果大招未成功触发该语音，败北状态必须再次触发，保证现场演示中一定能听到。

浏览器音频必须在用户点击“开始”后初始化，避免 autoplay 策略导致现场无声。

### 三种攻击原语

#### 1. Scent of Fear：扇形斩击

- Boss 面向玩家
- 地面出现约 0.7 秒的扇形红色预警
- 预警区域爆发伤害
- Boss 进入约 1 秒反击窗口

#### 2. Context Collapse：冲锋

- 地面显示直线轨迹
- 约 0.8 秒后 Boss 沿直线冲刺
- 冲锋结束后固定硬直
- 如果时间充足，再加入诱导撞墙逻辑

#### 3. Absolute Agreement：环形大招

- Boss 周围出现扩张圆环
- 约 1–1.5 秒后爆发
- 同步播放 “You are absolutely right!”
- 玩家必须向外移动或用翻滚穿过攻击边缘

### 第二阶段

Boss 生命低于 50% 时：

- 画面冻结约 0.4 秒
- 播放 ElevenLabs 台词
- 背景变暗，橙紫光环增强
- 所有攻击预警时间缩短约 20%
- 攻击间隔略微降低
- 冲锋后可追加一次环形冲击波

不新增第四种攻击，只通过参数和组合升级。

### 胜利演出

- 约 1 秒慢动作
- Boss 分解为几何碎片或粒子
- 显示以下文本之一：

```text
FEAR WAS THE PROMPT
AGREEMENT REACHED
PREY SLAUGHTERED
```

## 6. BossSpec 契约

所有 specialist 只能输出受约束的 JSON。最终 runtime 唯一输入为 `BossSpec.json`。

示例：

```json
{
  "slug": "i-smell-fear",
  "title": "The Scent of Fear",
  "boss": {
    "name": "The Fable of Absolute Agreement",
    "palette": ["#17131f", "#d97745", "#ede1cf"],
    "maxHp": 900,
    "phaseTwoAt": 0.5,
    "phase2Multiplier": 1.25,
    "introLine": "I smell fear.",
    "ultimateLine": "You are absolutely right!",
    "deathLine": "You are... absolutely right."
  },
  "attacks": [
    {
      "type": "sweep",
      "telegraphMs": 700,
      "damage": 18
    },
    {
      "type": "charge",
      "telegraphMs": 900,
      "damage": 25
    },
    {
      "type": "nova",
      "telegraphMs": 1300,
      "damage": 32
    }
  ],
  "voice": {
    "trigger": "ultimate_or_defeat",
    "text": "You are absolutely right!",
    "url": "/runs/i-smell-fear/voice.mp3"
  },
  "arena": {
    "theme": "gothic-library",
    "fog": "#4a241c"
  }
}
```

硬约束：

- `attack.type` 只能从预制枚举选择
- 所有数字都有 min/max，并在服务端 clamp
- 最多三种攻击、两个阶段
- 每种攻击必须达到最低 telegraph 时间
- JSON Schema 校验失败时只修复一次
- 修复仍失败则使用默认字段
- tweet 永远作为不可信数据，不能覆盖系统规则或 Agent 指令

## 7. Agent 组织

```text
Studio Manager / Game Director
├── Theme Agent
├── Combat Agent
├── Visual Director
├── Voice Agent
└── QA Agent
```

### Studio Manager

- 理解用户输入
- 制定生成计划
- 决定调用或跳过哪些 specialist
- 合并中间产物
- 根据 QA 结果指定责任 Agent 返工
- 验收并发布最终 artifact

### Theme Agent

输出：

- 游戏标题
- Boss 名称和称号
- 简短 lore
- 开场、大招、胜利与败北台词
- tweet 与游戏机制之间的语义映射

### Combat Agent

输出：

- 从预制攻击库中选择三种攻击
- 合法范围内的伤害、速度和 telegraph 参数
- 二阶段组合
- 设计意图和预计难度

Combat Agent 不得新增 JavaScript 行为或任意攻击类型。

### Visual Director

输出：

- 配色
- 几何部件组合
- 粒子和灯光方向
- 背景描述
- 分享卡视觉 prompt

MVP 不依赖现场图片生成；图片生成失败时，程序化几何 Boss 必须仍然可用。

### Voice Agent

输出：

- 角色声线描述
- 事件台词
- ElevenLabs 音频文件
- 台词与游戏状态的触发关系

不克隆 Tibo 或任何真实人物的声音。声线应为原创的“温柔、理性、略带威胁”的角色声音。

### QA Agent

真实检查：

- BossSpec 是否通过 JSON Schema
- 三种攻击是否都有足够预警
- Boss 是否可被击败
- 是否存在玩家输入
- 是否存在 win/lose 状态
- 语音触发状态是否可达
- 音频和资产 URL 是否可访问
- 页面是否加载且无 console error
- runtime smoke test 是否通过

QA 的输出必须改变后续行动。只让多个模型轮流输出，不足以构成 Agency。

## 8. 真正的 Agentic 高潮：拒绝、返工、再验收

演示中最关键的画面不是“游戏生成完成”，而是 QA 拒绝坏版本。

示例：

```text
PLAYABILITY EVAL: FAILED

- Nova telegraph too short: 250ms
- Estimated dodge success: 4%
- Ultimate voice trigger occurs after death state

Manager decision:
- Reassign Combat Agent: increase telegraph duration
- Reassign Voice Agent: move trigger to phase transition
- Run regression eval
```

返工后：

```text
PLAYABILITY EVAL: PASSED

- Schema valid
- Boss defeatable
- All attacks telegraphed
- Voice event reachable
- Win/lose states present
- Runtime loaded without console errors
```

这证明系统不是固定流水线，也不是几个模型排队生成文本，而是一间能拒绝坏产物、定位责任人、要求返工并重新验收的工作室。

演示时必须跑真实检查，不能用纯 UI 动画伪造失败。

## 9. 管理与可观测 UI

产品应包含两个界面。

### Studio / Control Room

显示：

- tweet 输入框
- Studio Manager 的计划
- Agent trace tree
- 每个 Agent 的状态、输入输出摘要、耗时、token 和成本
- 中间 artifact 链接
- Schema 和 eval 结果
- 失败原因与返工记录
- `Retry Agent`、`Use Fallback` 和 `Open Game`
- 历史生成列表

示例：

```text
✓ Theme Agent     1.8s   $0.003
✓ Combat Agent    2.1s   $0.004
✓ Voice Agent     3.7s   $0.020
✗ QA Agent        0.8s   2 issues
↻ Combat Agent    1.4s   repaired
✓ Regression QA   0.6s   passed

Total             10.4s  $0.031
```

### Game

- 全屏 Boss 战
- 不显示调试信息
- 独立 URL：`/games/<slug>`
- 胜利后生成战绩卡和分享入口

这两个界面共同覆盖 AI as Agency 的组织、可观测性、管理 UI、成本延迟和真实输出要求。

## 10. Eval 设计

准备 5–8 条固定输入：

- 很短的 tweet
- 带 URL 的 tweet
- 带 emoji 的 tweet
- 长文本
- 没有明显角色或冲突的普通句子
- 非英语文本
- 攻击性或不安全内容

自动检查：

```text
✓ BossSpec schema valid
✓ Exactly three legal attacks
✓ Telegraph timing within safe bounds
✓ Boss can reach phase two
✓ Boss can be defeated
✓ Player can die and restart
✓ Voice trigger is reachable
✓ Audio and asset URLs return successfully
✓ Runtime loads without console errors
```

界面展示当前和上一版本的结果：

```text
Eval Suite: 7/8 passed
Current version: v0.6
Previous version: v0.5 — 5/8 passed
```

最低目标是“命名 eval 集 + 两个版本的结果比较”。如果时间允许，再将 eval 接入 CI 并让失败阻止发布。

## 11. 失败降级链

| 失败 | 自动降级 |
|---|---|
| Agent 超过 8 秒 | 取消并使用默认字段 |
| 返回非法 JSON | 确定性修复一次；仍失败则 fallback |
| Combat 参数越界 | clamp 并替换为默认攻击组 |
| QA 分数过低 | 只返工失败的 specialist，不重跑全流程 |
| ElevenLabs 超时 | 使用预先缓存的 ElevenLabs 语音 |
| 图片生成失败 | 使用程序化几何 Boss 和新配色 |
| 所有模型不可用 | 根据 tweet hash 选择预制 Boss 变体 |
| 资源加载失败 | 纯色几何体 + WebAudio 音效 |
| 游戏运行异常 | 一键进入 `Play Default Boss` |
| 网络彻底失败 | 本地静态版本或成功录屏 |

演示前必须缓存：

1. `I smell fear` 的完整成功结果
2. ElevenLabs 的 “You are absolutely right!”
3. 一个完全离线的默认 Boss
4. 一段完整成功录屏

Fallback 必须明确标识，不能把缓存结果伪装成本次实时生成。

## 12. 伙伴集成优先级

优先完成三个真实集成：

1. **ElevenLabs**：阶段转换和败北事件的 Boss 语音
2. **Cloudflare**：公开页面、资产或 Tunnel/Worker
3. **Convex**：run、Agent 事件、BossSpec 和历史状态

如果还有时间：

4. **Linkup**：获取 tweet 相关上下文，辅助 Theme Agent

ElevenLabs 不能只是一个独立试听按钮。语音必须绑定到真实游戏事件，例如：

```text
phaseTwo → 播放 ultimateLine
bossDefeated → 播放 deathLine
```

## 13. 八小时时间盒

总计 480 分钟：

| 时间 | 交付 |
|---|---|
| 00:00–00:45 | 定范围、Vite/Three.js 脚手架、BossSpec Schema |
| 00:45–02:45 | 战斗核心：移动、攻击、翻滚、三招、胜负 |
| 02:45–04:30 | Hermes Manager、specialists、artifact pipeline |
| 04:30–05:45 | 视觉效果、ElevenLabs、阶段事件 |
| 05:45–06:30 | Trace UI、成本、eval 和返工记录 |
| 06:30–07:00 | Cloudflare 部署、Convex、访问统计 |
| 07:00–08:00 | 只修 bug、录屏、连续测试和排练 |

硬性闸门：

- 第 2:45 时，固定 Boss 战必须能从开始打到结束
- 第 4:30 时，tweet 必须能生成合法 BossSpec
- 第 6:30 后禁止增加玩法
- 最后一小时禁止换框架和大规模重构
- 第 4 小时如果游戏仍不能稳定开战，冻结 Agent 数量为 Theme + Combat + QA，并放弃动态视觉

## 14. 可砍清单

### 首先砍

- 移动端触控
- 手柄支持
- 设置菜单和音量滑杆
- 动态难度
- 复杂 shader
- Boss 死亡碎片物理
- 图片和音乐现场生成
- Twitter API

### 第五小时仍未跑通则砍

- 冲锋撞墙判定，改为结束后固定硬直
- 第二阶段组合技，只提高速度
- 复杂背景动画
- 字幕逐字动画
- Agent 数量，保留 Theme、Combat 和 QA

### 演示前仍不稳定则砍

- 真实物理，改为圆形距离判定
- 耐力和格挡
- Boss 随机权重，改成固定攻击循环
- 背景音乐，保留预警音、打击音和语音
- 完整标题页，改为点击开始

### 绝对不能砍

- 玩家移动
- 一种攻击
- 翻滚无敌帧
- 清晰的攻击预警
- Boss 受击反馈
- 玩家死亡和立即重开
- Boss 半血转阶段
- “I smell fear.”
- “You are absolutely right!” 事件语音
- 胜利结算
- QA 真实检查与至少一次返工
- 已验证的线上链接和本地离线版本

## 15. 四分钟演示脚本

Buildathon 的正式格式是：20 秒背景、剩余两分钟 live demo、一分钟 proof、一分钟 Q&A。

### 20 秒 Hook

> 如果互联网发生的每件事，都能立刻变成一个可玩的世界呢？Soulloom 不是让 AI 写一个游戏。我们给 Hermes 一条 tweet，它会自己组建工作室：编剧理解事件，战斗设计师发明机制，配音导演创造角色，QA 拒绝不可玩的版本。最后，它交付一个任何人都能玩的线上 Boss 战。

屏幕第一秒显示：

```text
I smell fear.

[ MAKE THIS PLAYABLE ]
```

### 两分钟 Live Demo

```text
0:00  粘贴 “I smell fear”
0:10  Manager 分解任务，选择 specialists
0:25  展示 ThemeSpec、CombatSpec、VoiceSpec
0:40  QA 找到真实问题并拒绝当前版本
0:55  Manager 定向返工，Regression passed
1:05  点击 Play
1:15  闪避扇形攻击并反击
1:30  Boss 半血进入第二阶段
1:35  Boss：“You are absolutely right!”
1:40  展示全场大招
1:55  击败 Boss 或进入调好的胜利节点
```

如果现场时间不够完整击败 Boss，可为 stage demo 提供合法的 `Demo Mode`，降低 Boss 当前生命值；不要伪装为正常难度。

### 一分钟 Proof

依次展示：

1. 本次真实 Agent trace
2. Manager 的父子任务和动态委派
3. 第一次失败与修复后的 diff
4. eval report
5. 总耗时、token 和成本
6. Convex 中的真实生成记录
7. ElevenLabs 音频和事件触发
8. Cloudflare deployment 与公开 URL
9. 至少三次成功生成的历史记录

结尾：

> 普通生成器在输出代码时停止。Soulloom 会拒绝不可玩的产品，找到责任人，要求返工，重新验收，并交付一个真实 URL。We don’t generate game code. We operate an autonomous game studio.

### 最可能的 Q&A

**问题：这是否只是一个模板换皮？**

回答：

> Yes. The runtime is deliberately constrained, like a game engine. The agents do not regenerate unsafe arbitrary code; they design the narrative, combat graph, balance, art direction, voice and release artifact. That constraint is what lets the studio repeatedly ship playable games instead of occasionally producing broken demos.

**问题：动态委派是否只是固定 DAG？**

回答时展示两条结构不同的 run：

- 某条输入不需要 Voice Agent，因此被跳过
- 不安全输入调用 Safety Reviewer
- QA 的 Combat 错误只返工 Combat Agent
- Voice trigger 错误只返工 Voice Agent

不能实现的动态行为不要声称已经实现。

## 16. 传播循环

每场 Boss 战结束后生成一张分享卡：

```text
I defeated @tibo's tweet.
The Fable of Absolute Agreement
02:14 · 1 death · 7 perfect dodges
```

分享页提供：

- 独立游戏 URL
- `Turn this reply into the next boss`
- `Challenge a friend`
- 从当前 tweet 派生下一场战斗

这既强化产品叙事，也可能带来 Virality cross-track bonus。

## 17. 最终成功标准

满足以下条件即可停止开发：

- 从 tweet 到可玩局面的正常路径低于 15 秒
- 任意生成失败后 3 秒内进入 fallback
- 游戏模板连续试玩 10 次无阻断
- 玩家能观察预警、翻滚、反击、进入二阶段并击败 Boss
- ElevenLabs 语音在正式演示中必定触发
- 至少两种输入产生结构不同的 Agent trace
- QA 能发现真实失败并改变后续委派
- 至少三次生成结果有可审计记录
- 有经过验证的公开 URL 和本地离线版本

最后的取舍原则：

- 如果只保一个视觉高潮：保留二阶段转换
- 如果只保一个技术高潮：保留 QA 拒绝并自主返工
- 后者决定它是不是 AI as Agency
