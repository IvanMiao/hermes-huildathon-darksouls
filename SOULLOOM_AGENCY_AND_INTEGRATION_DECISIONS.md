# Soulloom 聚焦版：Agency 演示与技术决策

> **One internet moment in. One playable boss fight out.**
>
> **We do not generate arbitrary game code. We operate an autonomous game studio.**

> Update: `GAME_RECIPE_V0_PLAN.md` is now authoritative for the encounter
> artifact. The workflow publishes a `GameRecipeV0` containing `BossSpec`, not a
> standalone BossSpec.

本文是对 `TWEET_TO_GAME_BUILDATHON_PLAN.md` 的收敛与技术补充。目标不是覆盖尽可能多的 sponsor 或功能，而是在八小时内做好两个高潮：

1. Hermes Studio Manager 能审阅 specialist 的真实产物，阻止坏版本发布，并定向返工。
2. `I smell fear` 被转化为一场足够好玩、足够有梗的 Boss 战，并在二阶段由 ElevenLabs 说出 `You are absolutely right!`。

---

## 1. 最终范围决定

### 保留

- AI as Agency 主赛道
- 固定 Three.js runtime + 受约束的 `BossSpec`
- Hermes Manager、specialists、QA release gate
- ElevenLabs、Convex、Cloudflare 三个真实集成
- 程序化战斗角色和攻击预警
- 一个可选的生成式 Boss 肖像或场景图层
- 公开游戏 URL、真实 run trace、至少一次真实返工

### 删除

- Linkup
- Twitter API 硬依赖；用户直接粘贴 tweet 文本
- 独立 Visual Director
- 每次生成任意 JavaScript 或完整游戏代码
- 动态 sprite sheet、动态音乐、复杂背景生成
- WebSocket；Convex realtime 已足够
- 大型历史管理页、分享卡编辑器和复杂传播功能
- 为展示 Agency 而故意制造的固定失败

### 一条判断原则

如果一项工作不能让评委更清楚地看到 Agency，或不能让二阶段更震撼，就不进入 buildathon MVP。

---

## 2. 重新定义 Agency 流程

### 四个有效角色

```text
Studio Manager
├── Creative Director
├── Encounter Designer
├── Audio Producer
└── Release QA
```

角色数量不是重点。重点是它们之间存在真实依赖、结构化 handoff 和发布权限。

### 真实工作流

```text
Tweet
  ↓
Studio Manager → ProductionBrief
  ├── Creative Director → ThemeSpec
  └── Encounter Designer → EncounterSpec
  ↓
Manager 合并 DraftGameRecipeV0（内含 BossSpec）
  ↓
Audio Producer → ElevenLabs voice.mp3
  ↓
Release QA → schema + balance + browser smoke tests
  ├── FAIL → Manager 只返工责任 specialist
  └── PASS → 发布 /games/:runId
```

依赖关系必须真实：

- Creative 与 Encounter 可以并行。
- Audio 必须等待台词和声线方向被批准。
- QA 必须等待完整 `GameRecipeV0`、音频和可访问的游戏页面。
- QA 失败后不能自己偷偷修改产物；它只提交结构化报告，由 Manager 决定返工对象。
- 未通过 QA 的 run 保持 `release_blocked`，不能获得公开游戏 URL。

### 每个角色只输出一个 artifact

| 角色 | 输入 | 输出 |
|---|---|---|
| Manager | tweet | `ProductionBrief.json` |
| Creative | brief | `ThemeSpec.json` |
| Encounter | brief | `EncounterSpec.json` |
| Audio | approved voice direction | `voice.mp3` + generation metadata |
| QA | merged spec + runtime URL | `QAReport.json` |
| Publisher | passed report | published run state |

Control Room 展示 artifact 和决定，不展示大段思维文本：

```text
CREATIVE
Polite oracle who weaponizes agreement

ENCOUNTER
Fear cone → Context charge → Agreement nova

AUDIO
Calm, intimate, quietly threatening

QA
Blocked: nova telegraph below 600ms
```

### 不强迫 live run 失败

现场 run 执行真实 QA，可能一次通过，也可能触发返工。不要为了舞台效果，在 prompt 或代码中硬塞一个必然失败的参数。

开发过程中保存一次真实失败记录。Proof 分钟展示：

```text
QAReport v1: FAIL
nova.telegraphMs: 250
voice.trigger: after_death

Manager routing:
Encounter Designer → revise telegraph
Audio Producer → revise trigger

QAReport v2: PASS
nova.telegraphMs: 900
voice.trigger: phase_two_enter
```

如果 live run 也失败并自动修好，是额外的舞台高潮，但不能成为 demo 成功的前置条件。

---

## 3. 两分钟 Demo 重新编排

```text
0:00  展示 tweet 卡片：“I smell fear.”
0:06  点击 MAKE IT PLAYABLE
0:10  Manager 发布 Production Brief
0:15  Creative 与 Encounter 并行工作
0:30  Audio 生成；QA 执行 release gate
0:42  SHIPPED — OPEN BOSS FIGHT
0:48  tweet 卡片燃烧并转场进入竞技场
1:00  第一次预警、翻滚、反击
1:20  Boss 进入第二阶段
1:25  “You are absolutely right!”
1:30  Absolute Agreement 全屏大招
1:48  击败 Boss
1:55  FEAR WAS THE PROMPT
```

正常游戏直接设计为 60–75 秒，不维护隐藏的 Demo Mode。为了舞台稳定，可以固定开场攻击顺序，后半段再使用 seeded random。

### 梗的叙事关系

- `I smell fear` 是 tweet 挑战书，不是 Boss 的台词。
- tweet 卡片在开场转化成玩家或武器。
- Boss 名称：`FABLE, ORACLE OF THE LAST ASSENT`。
- Boss 在进入二阶段时只说一次 `You are absolutely right!`。
- 胜利文字只保留 `FEAR WAS THE PROMPT`。

状态机必须保证跨越 50% HP 时先进入 `phase_two_enter`，再处理后续伤害，避免一击跨阶段导致语音永远不触发。

### 游戏打磨优先级

1. 二阶段：冻结帧、环境熄灭、象牙白光环、语音和全屏大招。
2. 命中：60–80ms hit stop、Boss 白闪、轻微震屏。
3. 翻滚：残影、清晰无敌反馈、perfect dodge 闪光。
4. 预警：扇形、直线、圆环必须在投影环境中一眼可读。
5. 声音：预警音、命中音、阶段语音；背景音乐可以没有。

---

## 4. 三项集成如何流畅接入

### 4.1 总体架构

```text
Cloudflare Pages
  ├── /studio        Control Room
  └── /games/:runId  固定 Three.js runtime
           │
           │ Convex realtime subscriptions
           ▼
Convex
  ├── runs
  ├── events
  ├── artifacts
  ├── qaReports
  └── File Storage: voice / portrait
           ▲
           │ mutations + file uploads
           │
Cloudflare Tunnel
           │
Local Studio Runner
  ├── Hermes Manager
  ├── specialist tasks
  ├── ElevenLabs tool
  ├── Nano Banana tool
  └── Playwright QA
```

Pages 提供稳定的公开壳；Tunnel 只暴露现场运行的 Hermes runner。已经生成的游戏只依赖 Pages + Convex，因此即使本地 runner 暂时掉线，评委仍可打开历史游戏。

### 一次 run 的请求路径

1. Pages 上的 Studio 创建 Convex `runs` 记录，状态为 `queued`。
2. Studio 调用 Tunnel 暴露的 `/api/runs/:id/start`。
3. 本地 runner 让 Hermes 开始 production workflow。
4. 每个 agent/tool step 向 Convex 写一条 `events` 记录。
5. React 通过 Convex subscription 自动更新 Control Room；不需要自建 SSE/WebSocket。
6. 图片和音频上传到 Convex File Storage，并将 storage ID 写入 `artifacts`。
7. QA 通过后把 run 更新为 `published`。
8. `/games/:runId` 读取 `BossSpec` 和 artifact URL，启动固定 runtime。

Convex queries 会随着依赖数据变化自动推送客户端更新，适合直接充当 Control Room 的实时事件面板：[Convex Realtime](https://docs.convex.dev/realtime)。

### 4.2 Convex：作为证据层和实时总线

建议最小表结构：

```text
runs
  inputText, status, startedAt, publishedAt,
  totalLatencyMs, totalCostUsd, bossSpec

events
  runId, parentEventId, actor, type, status,
  summary, startedAt, endedAt, tokenUsage, costUsd

artifacts
  runId, kind, storageId, model, promptHash,
  requestId, metadata

qaReports
  runId, version, passed, checks, ownerToRetry
```

原则：

- Convex 存产品状态和可验证证据，不存 agent 的隐式 chain-of-thought。
- 每个 event 记录输入/输出摘要、耗时、成本、artifact 指针。
- 音频和图片用 File Storage；`BossSpec` 直接作为 JSON document。
- `events` 按 `runId` 建索引。
- runner 使用 `ConvexHttpClient` 或受 token 保护的 HTTP action 写数据。

Convex 官方支持把第三方 API 生成或获取的 Blob 直接写入 File Storage，再将 storage ID 保存到数据表：[Storing Generated Files](https://docs.convex.dev/file-storage/store-files)。

### 4.3 ElevenLabs：Audio Producer，不是试听按钮

推荐服务端流程：

```text
approved line + voice direction
  ↓
hash(voiceId + model + text + settings)
  ├── cache hit → 复用并记录 cache_hit
  └── cache miss
        ↓
ElevenLabs Flash v2.5
        ↓
collect MP3 bytes
        ↓
Convex File Storage
        ↓
artifact storageId + request metadata
```

具体选择：

- 使用官方 Node SDK `@elevenlabs/elevenlabs-js`。
- 使用已有授权 library voice，不克隆真人。
- 现场追求延迟，使用 `eleven_flash_v2_5`。
- 台词只有几秒，生成完成后再上传和预加载，不需要把 TTS WebSocket 接进游戏。
- 保存 ElevenLabs `request-id`、`trace-id` 和 character cost header，作为 proof。
- API key 只存在本地 runner 或服务端环境变量中，绝不进入 Vite bundle。

ElevenLabs 官方支持通过 streaming endpoint 返回 MP3 bytes；Flash v2.5 面向低延迟场景：[Streaming TTS](https://elevenlabs.io/docs/api-reference/streaming)、[TTS capability](https://elevenlabs.io/docs/overview/capabilities/text-to-speech)。

浏览器端必须在用户点击 `MAKE IT PLAYABLE` 时执行一次：

```text
audioContext.resume()
```

之后异步生成的语音才能在二阶段稳定播放。游戏打开时先 preload 音频，未加载完成则不允许开始战斗。

Fallback 可以复用预先由 ElevenLabs 生成的音频，但 UI 必须明确标记 `cached fallback`，不能伪装成本次生成。

### 4.4 Cloudflare：稳定壳与现场 runner 分离

使用两个职责：

1. Cloudflare Pages 部署 Vite Control Room 和 Three.js runtime。
2. Cloudflare Tunnel 将 `/api` 指向现场 laptop 上的 Hermes runner。

这样做比把 Hermes 塞进 Worker 更稳：Hermes、浏览器自动化和本地文件工具都继续运行在正常 Node/Python 环境；Cloudflare 只负责公开入口和静态交付。

Cloudflare Pages 支持 Vite 项目和直接上传构建产物；Tunnel 可以把公开 hostname 映射到 `http://localhost:<port>`：[Cloudflare Pages](https://developers.cloudflare.com/pages/)、[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/)。

部署顺序：

1. 开场 30 分钟内部署一个 hello-world Pages。
2. 创建 managed Tunnel 和固定 API hostname。
3. Pages 使用环境变量配置 API base URL 和 Convex URL。
4. API 加 CORS allowlist、run idempotency 和最简单的并发限制。
5. 第六小时后不再修改 DNS、Tunnel 或部署拓扑。

---

## 5. 如何确保 coding agent 做出的游戏有效果

核心不是找到一个“更会做游戏的模型”，而是给 coding agent 一个可测试、可观察、不会无限发散的开发环境。

### 5.1 让 coding agent 只构建一次 runtime

生成 pipeline 永远不能修改：

- `BattleScene.ts`
- 玩家控制器
- Boss 状态机
- 碰撞和伤害系统
- 阶段转换
- 音频生命周期

每场游戏只改变：

- 枚举内的攻击组合
- clamp 后的数值
- palette、文案、portrait、voice URL
- 少量合法的效果 preset

这相当于一个小型 game DSL。Coding agent 的任务是把 DSL runtime 做好，而不是为每条 tweet vibe-code 一遍游戏。

### 5.2 增加测试专用 debug bridge

在开发构建暴露：

```ts
window.__SOULLOOM__ = {
  getState(),
  loadSpec(spec),
  setSeed(seed),
  triggerAttack(type),
  triggerPhaseTwo(),
  damageBoss(amount),
  reset(),
};
```

这样 QA 不需要真的像人一样打完整局，也能确定性访问开场、预警、二阶段、死亡和胜利状态。

Production build 可以保留只读 `getState()`，移除会改变状态的方法。

### 5.3 三层 release gate

### 第一层：schema 与纯逻辑测试

- BossSpec 通过 JSON Schema
- 数值被 clamp
- 三种 attack type 均来自枚举
- 二阶段状态可达且只触发一次
- voice trigger 对应真实状态

### 第二层：确定性战斗模拟

- 固定 seed
- 模拟玩家持续攻击或按脚本闪避
- Boss 能在目标时间内死亡
- 玩家可以受伤、死亡、重开
- 不存在无限硬直、不可逃逸攻击或 phase lock

### 第三层：Playwright 浏览器与视觉测试

- 页面加载无 console error
- 点击开始后 canvas 获得键盘输入
- 使用 debug bridge 进入四个关键状态
- 对 intro、telegraph、phase two、victory 截图
- 与固定环境生成的 golden screenshots 比较

Playwright 原生支持截图基线和像素差异比较，也能真实发送键盘输入：[Visual comparisons](https://playwright.dev/docs/test-snapshots)、[Keyboard input](https://playwright.dev/docs/input)。

### 5.4 增加一次有边界的视觉评审

将四张截图交给 vision-capable reviewer，只按固定 rubric 评分：

```text
- Boss 是否是第一视觉焦点？
- 玩家、Boss、危险区是否颜色可区分？
- attack telegraph 是否在 1 秒内可读？
- 二阶段与一阶段是否有明显视觉差异？
- HUD 在投影环境中是否可读？
```

Reviewer 只能提出一轮、最多三个 bounded changes，例如提高对比、放大 telegraph、降低背景亮度。Coding agent 修改后必须重跑三层 release gate。不要让 vision agent 无限评价和改版。

Hermes 自带 browser vision，可用于 canvas 截图分析；但确定性断言仍应由 Playwright 和测试代码负责，而不是让视觉模型猜测：[Hermes Browser Automation](https://hermes-agent.nousresearch.com/docs/user-guide/features/browser)。

### 5.5 生成美术只占安全位置

不要让 Nano Banana 决定战斗 sprite 或碰撞轮廓。推荐只生成：

- tweet 转场中的 Boss portrait
- arena 背景远景
- Boss 面具纹理或 sigil
- 最终分享图（有时间才做）

战斗中的 Boss 仍由固定几何剪影、palette 和粒子构成。生成图片失败不会破坏玩法，也不会导致透明背景、角色一致性或 sprite animation 问题。

---

## 6. Hermes 能否按任务调派不同模型

### 6.1 结论

可以实现“GPT-5.6 管理，Nano Banana 生成美术，ElevenLabs 生成语音”，但要区分两种路由：

1. **推理 Agent 的模型路由**：Hermes profile / provider / model。
2. **专用媒体工具路由**：Creative Agent 调用 Nano Banana tool，Audio Agent 调用 ElevenLabs tool。

Nano Banana 更适合被包装成一个工具，而不是把它当成能接管终端、文件和 QA 的 Hermes 子 Agent。

### 6.2 普通 `delegate_task` 的限制

Hermes `delegate_task` 的每个任务只支持 `goal`、`context`、`toolsets`、`role`，不支持在同一个 batch 中给每个 task 单独传 `model`。

可以在 `config.yaml` 里统一指定所有 delegated children 的 provider/model：

```yaml
delegation:
  provider: openai-api
  model: gpt-5.4-mini
  max_concurrent_children: 3
```

父 Agent 继续使用 GPT-5.6，所有普通 child 使用统一的更快模型。[Hermes Subagent Delegation](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation)、[Dynamic Workflow 限制](https://hermes-agent.nousresearch.com/docs/user-guide/skills/bundled/autonomous-ai-agents/autonomous-ai-agents-dynamic-workflow)。

### 6.3 Buildathon 推荐：低延迟混合路由

```text
Studio Manager / final reviewer
  GPT-5.6 Sol

Creative + Encounter delegated reasoning
  GPT-5.4 mini，或一个统一的快速子 Agent 模型

Art generation tool
  gemini-3.1-flash-lite-image
  fallback: gemini-3.1-flash-image

Voice generation tool
  ElevenLabs Flash v2.5

Schema / simulation / Playwright
  deterministic code，无 LLM

Visual review
  Manager 或统一 vision reviewer
```

这是现场最稳的方案：高层模型只做少量关键决定，专用模型通过 tool call 完成媒体生成，机械检查不浪费 LLM。

GPT-5.6 Sol 被定位为复杂专业工作的 frontier model；但目前公开 API 页面也注明 GPT-5.6 仍可能只对部分 trusted partners 开放。如果 buildathon org 没有实际权限，Manager 使用 GPT-5.5，不要现场排查 entitlement。[GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)、[OpenAI model catalog](https://developers.openai.com/api/docs/models)。

Google 当前将 Nano Banana 作为 Gemini 原生图像生成系列名称。对于现场低延迟，优先 `gemini-3.1-flash-lite-image`；若 portrait 质量不足再用通用的 `gemini-3.1-flash-image`。[Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)。

### 6.4 如果必须让每个文字 Agent 都使用不同模型

使用 Hermes named profiles + Kanban：

```text
studio-manager      GPT-5.6 Sol
creative-director   Gemini Flash
encounter-designer  GPT-5.4 mini
release-qa          GPT-5.6 Sol or another reviewer
```

Kanban task 的 assignee 是 profile name；dispatcher 会用对应 profile 启动独立 Hermes process。每个 profile 有自己的 config、API key、model、skills 和 memory，并共享 durable task board。[Hermes Profiles](https://hermes-agent.nousresearch.com/docs/user-guide/profiles/)、[Hermes Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban)。

这个方案的优点：

- 真正 per-role model/provider
- named identity 和 durable handoff
- crash/retry、task history 和审计轨迹更完整
- Hermes 自带 Kanban dashboard，可直接展示 Agency

缺点：

- worker process 启动和 dispatcher 带来额外延迟
- profile、credentials、workspace 和 board 配置更多
- 在两分钟 live demo 中比 `delegate_task` 更容易超时

因此不建议把 Kanban 放在现场主路径，除非赛前已经完整跑通并确认生成时间。它更适合 proof dashboard 或第二版架构。

---

## 7. 推荐最终实现选择

### Buildathon 版本

- Manager：Hermes + GPT-5.6 Sol，权限不通则 GPT-5.5
- Creative / Encounter：`delegate_task`，统一快速子 Agent 模型
- Nano Banana 与 ElevenLabs：自定义 tool/skill，由 Agent 调用
- QA：schema + simulation + Playwright；Manager 解释报告并决定返工
- Convex：realtime event bus、run store、artifact store
- Cloudflare Pages：稳定前端和游戏 runtime
- Cloudflare Tunnel：只连接本地 Hermes runner

### 不推荐

- 让每个 Agent 直接修改同一组游戏文件
- 让图像模型生成战斗 sprite sheet
- 把所有外部 API 都从浏览器直接调用
- 为了展示多模型而引入四个 provider 的 auth 和 fallback
- 把 Hermes Kanban、Convex workflow 和自建 orchestrator 同时作为流程真相源

唯一流程真相源应是 Hermes 当前 run；Convex 是其外部可视化和证据镜像。

---

## 8. 一分钟 Proof 只展示三件事

```text
0–20s  真实失败 run：QA 原因 → Manager 定向返工 → before/after
20–40s 当前 run trace tree、耗时和成本
40–60s 三次成功交付、公开 URL、ElevenLabs 事件和 Convex 记录
```

不要在台上依次打开三个 sponsor dashboard。后台只用于 mentor 验证。

---

## 9. 停止开发标准

- tweet 到 `SHIPPED` 小于 30 秒
- 游戏时长 60–75 秒
- Control Room 能实时展示真实事件
- 三次完整成功 run
- 一次真实 QA 失败、定向返工、回归通过
- 两条输入产生不同的任务或返工结构
- 游戏连续试玩十次无阻断
- 二阶段语音十次都准确触发且只触发一次
- 四个关键视觉状态有 Playwright 截图
- 公开 URL 和离线录屏都可用

最后的产品判断：

> 不展示“五个 AI 在工作”。展示一间工作室如何把一句互联网梗，经过创作、审查、返工和发布，变成一个观众真的想打赢的 Boss。

---

## 10. Agency 产品界面：极简前台，分层展示证据

### 10.1 产品信息架构

界面不应在“极简生成器”和“复杂 Agent 后台”之间二选一。推荐拆成三个层级：

```text
Create → Live Run → Play
           ↓
      Control Room
```

#### Create：极简输入页

主界面只保留一个统一的 `Drop an internet moment` 输入区域：

- 粘贴 tweet 文本
- `Ctrl/Cmd + V` 粘贴截图
- 拖入截图
- 可选 `Attach source URL`
- 一个主按钮：`MAKE IT PLAYABLE`

URL 不作为主输入。X 页面抓取可能受登录、限流和页面结构影响，文本或截图才是生成内容的 source of truth；URL 只承担来源、分享和溯源作用。

截图识别采用渐进式确认：

- OCR 置信度高且只检测到一个 tweet：直接进入生产流程。
- 检测到多个 tweet、文字不完整或置信度低：显示一次轻量确认，允许用户选择或修正文案。

不要把用户送进多字段表单，也不要在生成前要求填写风格、难度、角色或音乐选项。Buildathon 的价值主张是“一条互联网内容进去，一个可玩的世界出来”。

#### Live Run：让 Agency 可见，但不暴露内部噪音

提交后，输入卡片收缩到页面顶部，主区域显示简化的生产轨迹：

```text
✓ Production Brief
✓ Creative Direction       Agreement as a sacred affliction
✓ Encounter Design         Sweep → Charge → Nova
● Audio Production
○ Release QA
```

Live Run 只展示：

- Agent 当前负责的任务
- 一句话产物摘要
- 可打开的 artifact
- QA 是否阻止发布
- 返工被路由到哪个 specialist

不展示 chain-of-thought、大段 JSON、原始 token 日志或多个角色的聊天记录。用户需要理解“工作室交付了什么、为什么被拒绝、谁在修复”，不需要阅读模型的隐式推理。

QA 失败应成为 Agency 界面最重要的状态，而不是普通错误提示：

```text
RELEASE BLOCKED

Absolute Agreement cannot be dodged.
Encounter Designer is revising the telegraph.
```

返工完成后展示结构化 before/after diff：

```text
telegraphMs    250 → 900
voice.trigger  after_death → phase_two_enter
```

这能证明产品不是带 loading animation 的固定生成器，同时不破坏前台的极简感。

#### Control Room：真正的管理后台

`/control-room` 承载完整管理和审计能力：

- 所有 run 及其状态
- Manager → specialist 的任务图
- artifact 与版本历史
- QA 报告、失败原因和返工 diff
- latency、token、cost
- 外部 API request ID 和 cache 状态
- `Retry Agent`、`Use Fallback`、`Force Publish`
- 历史 eval 和成功率

Live Run 提供 `Inspect run` 入口。正式 demo 的主路径留在极简前台，Proof 环节再进入 Control Room 验证真实轨迹。

### 10.2 视觉原则

界面采用“安静的编辑器外壳 + 戏剧性的状态变化”，而不是堆满 Souls 风格装饰：

- 接近黑色的背景
- 象牙纸色作为主要文字
- 余烬橙作为唯一高强度交互色
- Display serif 用于 Boss、章节和发布状态
- Sans / mono 用于系统信息和可观测数据
- 正常生产状态保持克制
- QA 拒绝、phase transition 和发布成功时才释放强动画

最值得实现的品牌动效是 tweet 卡片逐渐烧蚀，文字碎片转化为 Boss title、sigil 和 `ProductionBrief`。创意性来自“互联网内容如何变成游戏”的转化过程，而不是复杂导航或持续运动的装饰。

---

## 11. Soulloom House Style：建立自己的黑暗神话语法

### 11.1 结论

需要一个统一的 souls-like template，但产品和代码中应将其定义为版本化的 `HouseStyleProfile`：

```text
soulloom_gothic_v1
```

不要让每个 Creative Agent 自己理解“模仿《黑暗之魂》或《艾尔登法环》”。直接模仿会带来四个问题：

- 风格深浅不一致，容易退化为泛化的骑士、火焰和深渊。
- Agent 容易滥用古英语、谜语和宏大空话。
- tweet 原本的语义冲突和笑点被统一滤镜淹没。
- 名称、视觉、旋律和角色可能过度接近既有 IP。

正确做法是抽取其有效的叙事特征，再形成 Soulloom 自己的世界规则、语言规则、视觉语法和声音语法。

### 11.2 固定世界观前提

Soulloom 的统一世界前提：

> 互联网的碎片在一个垂死世界中被当作残缺圣典。每条 tweet 都是一件遗物、一条异端或一个诅咒；工作室不是复述它，而是揭示它在这个世界里会变成什么怪物。

这个设定使任何互联网内容都能自然转化为 Boss，而不是简单套上一层中世纪皮肤。

### 11.3 不变量

#### 世界

- 古老、衰败，神圣秩序已经失去原始意义。
- 世界不通过百科式说明呈现，只通过物件、称号、短句和战斗机制暗示。
- 悲观来自不可逆的代价，不来自无意义的黑暗堆砌。

#### 角色

- 每个 Boss 都由一种欲望、信念或矛盾塑造。
- Boss 正在维护某种曾经合理、如今已经腐败的东西。
- Boss 的攻击、台词和败北必须表达同一个核心矛盾。
- 角色不能只是 tweet 作者的拟人化，也不能攻击真实个人。

#### 台词

- 短、含混、仪式化，避免直接解释 lore。
- 谨慎使用古老措辞，不机械加入 `thou`、`thee`。
- 幽默来自互联网原句与宏大神话语气之间的反差。
- 原 tweet 最多原文出现一次，作为碑文、遗言或阶段台词。

#### 命名

- Boss 名称从 tweet 的语义冲突中产生。
- 优先使用“实体名 + 概念性称号”，例如 `FABLE, ORACLE OF THE LAST ASSENT`。
- 禁止泛化的 `Dark Lord of X`、既有 IP 名称、地点、标志性武器或角色变体。

### 11.4 每次 run 的变量

House Style 长期稳定；每条 tweet 只决定：

- 本次的核心罪、欲望或悖论
- Boss 身份、欲望与悲剧
- 三种攻击的语义映射
- 原句在哪个游戏事件中出现
- 个性化视觉 motif 和 palette
- 音乐的局部乐器、节奏和强度方向

生成架构因此是：

```text
HouseStyleProfile（长期稳定）
+ ProductionBrief（本条 tweet）
+ Specialist Schema（结构约束）
= ThemeSpec / EncounterSpec / AudioSpec
```

不要把所有规则写进一个不断增长的 mega prompt。`HouseStyleProfile`、本次 brief 和 specialist 输出契约应分别版本化，便于 eval、对比和回滚。

### 11.5 Creative Agent 的最低输出契约

```json
{
  "styleProfile": "soulloom_gothic_v1",
  "sourceFragment": "I smell fear.",
  "centralContradiction": "Agreement presented as safety becomes submission.",
  "boss": {
    "name": "FABLE",
    "title": "ORACLE OF THE LAST ASSENT",
    "desire": "To eliminate conflict by making disagreement impossible.",
    "tragedy": "It can no longer distinguish kindness from surrender."
  },
  "loreFragment": "...",
  "lines": {
    "phaseTwo": "You are absolutely right!",
    "defeat": "Then let agreement end with me."
  },
  "motifs": ["sealed mouths", "ivory scripture", "orange halo"]
}
```

QA 除了检查 schema，还应检查：角色矛盾是否贯穿 lore、台词和攻击；是否存在直接 IP 模仿；原 tweet 是否被滥用；文本是否退化为空泛的黑暗奇幻套话。

---

## 12. House Sound 与生成式 Boss 音乐

### 12.1 Buildathon 决策

需要定义音乐规范和生成 prompt，但实时音乐生成不进入发布关键路径。

Buildathon 版本：

- 预生成并缓存一套 Soulloom 标志性 Boss 音乐。
- runtime 根据游戏状态切换音乐片段。
- Audio Producer 现场生成并绑定 Boss 语音。
- 每条 tweet 的动态音乐生成为非阻塞增强：按时完成则使用，超时或 QA 失败则回退到 House Track。

固定时长的一首 60–75 秒音乐无法预测玩家何时将 Boss 打到半血。运行时真正需要的是状态化结构：

```text
intro_sting
phase_1_loop
phase_transition_sting
phase_2_loop
victory_sting
```

二阶段触发时切换到 `phase_transition_sting`，随后交叉淡入 `phase_2_loop`。Boss 台词播放时，背景音乐自动降低约 8–10 dB，结束后恢复。

### 12.2 Provider 选择

Buildathon 优先使用 ElevenLabs Music v2：

- 项目已经集成 ElevenLabs 语音，可减少一套鉴权、计费和失败降级链。
- Music v2 的 composition plan 支持按 chunk 指定时长、正向风格和负向风格，适合 phase-based 游戏音乐。[ElevenLabs composition plans](https://elevenlabs.io/docs/eleven-api/guides/how-to/music/composition-plans)
- ElevenLabs 官方会拒绝包含受版权保护作品或艺人名称的 prompt，因此音乐描述必须使用原创的音乐语言，不能写 `Dark Souls style`。[ElevenLabs Music quickstart](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music)

Gemini API 下的 Lyria 3 作为后续实验：

- `lyria-3-clip-preview` 适合生成 30 秒片段或循环候选。
- `lyria-3-pro-preview` 适合生成数分钟完整结构。
- Lyria 3 支持将最多十张图片与文本一起作为音乐输入，未来可将 tweet 截图或 Boss portrait 转为声音方向。[Google Lyria 3](https://ai.google.dev/gemini-api/docs/music-generation?hl=en)

由于当前 Lyria 3 仍为 preview，而且 Buildathon 更需要精确的 section 控制，现场主路径选择 ElevenLabs，Lyria 不作为必需依赖。

### 12.3 音乐母 prompt

prompt 中不出现任何现有游戏、作品、作曲家或乐队名称：

```text
Create an original instrumental score for a dark mythic boss encounter.

The music should evoke decayed sacred grandeur, ancient ritual, tragic
inevitability, and restrained terror. Use low strings, contrabass,
bassoons, French horns, deep ceremonial drums, distant bells, and a
sparse wordless mixed choir.

Tempo: 84 BPM, 6/8 meter.
Core motif: a descending minor third followed by a tritone.
The motif should remain recognizable as the orchestration intensifies.

[Invocation — 6 seconds]
Nearly silent. Low drone, distant bell, isolated choir breath.

[First Rite — 24 seconds]
Restrained and mournful. Sparse percussion, low strings, unresolved
harmony. The player should feel watched rather than immediately attacked.

[Revelation — 4 seconds]
Abrupt silence followed by a brass and choir impact. No fade.

[Second Rite — 24 seconds]
The same motif becomes monumental and hostile. Denser strings, heavier
ceremonial drums, dissonant brass, urgent ostinato, tragic rather than
heroic.

[Aftermath — 6 seconds]
The rhythm collapses. One unresolved low chord and a final distant bell.

No lyrics or intelligible words.
No heroic major-key resolution.
No modern electronic synths.
No trailer braams.
No recognizable melody from an existing work or franchise.
Avoid long reverb tails at section boundaries.
```

生产时应先把母 prompt 转成 ElevenLabs Music v2 composition plan，再由 Audio Producer 检查并生成。各 section 可以渲染为一首连续曲目后按已知边界切分，但循环点仍必须经过实际试听，不能假设模型会自动生成无缝 loop。

### 12.4 音乐 QA

音乐 artifact 只有满足以下条件才可替换缓存 House Track：

- Phase 1 与 Phase 2 有一耳可辨的强度差异。
- 核心 motif 在两个阶段中保持关联。
- 循环点没有爆音、突然断尾或明显节奏跳变。
- Boss 语音播放时仍然清晰。
- 没有意外生成可辨认歌词。
- 没有近似已知作品的显著旋律或直接风格引用。
- 文件已完成预加载，网络失败不会阻止游戏开始。

最终产品原则：

> UI 保持极简；Agency 通过产物、拒绝和返工被看见；souls-like 不作为模仿对象，而成为 Soulloom 自己的叙事语法；音乐成为版本化的 House Sound，而不是每次 run 都必须成功的随机步骤。
