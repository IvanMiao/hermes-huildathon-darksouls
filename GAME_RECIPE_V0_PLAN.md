# GameRecipe v0：受控的无限 Boss 战生成

## 目标

把 Soulloom 从“同一场 Boss 战的换皮”提升为：

```text
任意合格 tweet
→ 一种可解释的 encounter package
→ 一个可玩的、可验证的 Boss 战 run
```

v0 不承诺任意类型游戏。它只交付三种**玩法可感知不同**的 Boss 战，同时共用现有 Three.js runtime、玩家控制、碰撞、发布链和 QA。

## 本轮范围

保留：

- 单场景、单 Boss、击败 Boss 为唯一胜利条件。
- WASD/方向键移动、Space 翻滚、J 攻击、Enter 重开。
- 现有 `BattleController`、三种攻击原语和两阶段结构。
- `BossSpec` 继续是 Boss 身份、文案、palette、攻击数值的底层契约。

新增：

- 一个版本化的 `GameRecipe`，把 `BossSpec` 放入一个受控 encounter package。
- 三个固定 encounter package：`duel`、`procession`、`revelation`。
- 每个 package 至少一个真实的战斗规则变化，不能只是换色或换文案。
- QA 同时检查“可玩”与“该 run 是否确实遵守其 package 的规则”。

不做：

- 任意 Agent 生成 TypeScript、shader 或游戏代码。
- 多关卡、开放地图、平台跳跃、背包、升级、职业树。
- 多 Boss、召唤物、复杂物理、程序化关卡。
- 新增第四种基础攻击。
- 为每条 tweet 强行发明前所未见的机制。

## 产品承诺

不说“每条 tweet 都会生成一种从未存在过的游戏”。

说：

> 每条合格 tweet 都会被编译成一个可玩的 run。系统从经过验证的 encounter grammar 中选择玩法结构，并改变至少两个可感知维度：战斗节奏/规则、空间规则、视觉叙事。

低信息、重复或风险输入可以复用稳定 package，但必须在 run artifact 中明确标记：

```text
archetype reused: duel
reason: source input has low mechanical novelty
```

## 最小 GameRecipe 契约

```ts
type EncounterArchetype = "duel" | "procession" | "revelation";
type ArenaRule = "open_ring" | "closing_ring" | "inner_sanctuary";
type PhaseTwoRule = "haste" | "charge_chain" | "outer_safe_nova";

interface GameRecipeV0 {
  version: 1;
  runId: string;
  source: {
    text: string;
    normalizedIntent: string;
  };
  selection: {
    reason: string;
    reused: boolean;
    reuseReason?: string;
  };
  archetype: EncounterArchetype;
  arena: {
    rule: ArenaRule;
    theme: "gothic-library" | "ruined-cathedral" | "void-sanctum";
  };
  combat: {
    phaseOneOrder: ["sweep" | "charge" | "nova", ...Array<"sweep" | "charge" | "nova">];
    phaseTwoOrder: ["sweep" | "charge" | "nova", ...Array<"sweep" | "charge" | "nova">];
    phaseTwoRule: PhaseTwoRule;
  };
  boss: BossSpec;
  presentation: {
    motif: string;
    cameraMood: "watchful" | "oppressive" | "ceremonial";
  };
}
```

`BossSpec` 依然负责：

```text
FABLE 的名称、称号、台词、palette、HP、三种攻击的 telegraph 与 damage。
```

`GameRecipe` 新负责：

```text
这次战斗属于什么 archetype、攻击以什么顺序出现、二阶段怎么改变、竞技场有什么固定规则。
```

## 三个 encounter package

### 1. Duel — 直面决斗

**适用 tweet：** 挑衅、恐惧、质问、对立、单人宣言。

```text
arena.rule: open_ring
phaseTwoRule: haste
```

真实规则：

- 使用现有开放圆形竞技场。
- Boss 按固定但可配置的三招循环。
- 二阶段缩短 telegraph 与攻击间隔。
- 玩家靠观察、翻滚、贴身反击获胜。

这是当前 FABLE 的默认 package。

### 2. Procession — 绝对行进

**适用 tweet：** 命令、deadline、制度、强迫、不可回头的趋势。

```text
arena.rule: closing_ring
phaseTwoRule: charge_chain
```

真实规则：

- 二阶段后竞技场有效半径从固定安全值缓慢收缩至较小半径。
- Boss 的 attack order 以 `charge` 为核心，可连续两次冲锋；仍只使用既有三种攻击原语。
- 玩家不能永远绕场逃跑，必须在收缩空间里抓住冲锋后的反击窗口。

这只需要在 `BattleController` 增加动态 arena radius、在 recipe 中允许攻击顺序重复；不需要新物理系统。

### 3. Revelation — 外环启示

**适用 tweet：** 反转、揭露、悖论、突然承认、真相显现。

```text
arena.rule: inner_sanctuary
phaseTwoRule: outer_safe_nova
```

真实规则：

- 一阶段 nova 保留内环 sanctuary，危险带位于中外环。
- 二阶段 nova 反转规则：中心区域危险，标记边界之外的外环安全。
- 地面通过固定程序化环清楚标识安全边界。
- Boss 使用 `nova → sweep → charge` 的仪式型循环，节奏较慢但位置判断要求更高。
- 玩家必须读懂 phase-two rule，而非沿用第一阶段直觉。

这只需要让 nova 的命中半径遵循 recipe 的安全区规则，并更新预警几何和 QA；不需要新攻击类型。

## 可感知差异矩阵

| Package | 核心节奏 | 空间规则 | 二阶段规则 | 主观体验 |
|---|---|---|---|---|
| Duel | 标准三招循环 | 开放圆场 | 速度提升 | 正面对决 |
| Procession | 冲锋压迫 | 场地收缩 | 连续 charge | 无处可退 |
| Revelation | 仪式窗口 | 外环安全 | nova 规则反转 | 读懂真相 |

每个 run 至少必须改变：

1. 一项战斗规则：attack order 或 phase-two rule；以及
2. 一项空间/呈现规则：arena rule、motif 或 camera mood。

仅改变名称、台词、palette 的 run 只能标记为 `narrative_variant`，不能宣称为新 encounter。

## Agent pipeline：收窄后的职责

```text
Input tweet
  → Theme Agent: normalizedIntent + BossSpec narrative fields
  → Encounter Agent: 从 3 个 package 选择 1 个，并给出理由
  → Manager: 合并为 GameRecipeV0
  → Deterministic QA: schema + playability + package-specific rules
  → targeted repair or fallback
  → Published run
```

v0 只需要两个生成 specialist：

- `Theme Agent`：名称、称号、lore、台词、palette、motif。
- `Encounter Agent`：只选择一个 package、攻击顺序和合法参数；不得新增 archetype 或攻击类型。

QA 失败时的定向返工：

```text
BossSpec 非法              → Theme Agent
攻击顺序/参数非法          → Encounter Agent
收缩场地不可玩             → Encounter Agent
运行时或 schema 失败       → fallback recipe，不交给模型修代码
```

## QA gate

所有 `GameRecipeV0` 都必须通过：

```text
1. BossSpec schema valid
2. archetype、arena rule、phase-two rule 都来自 enum
3. attack order 非空，只包含 sweep/charge/nova
4. phase two 可达且最多触发一次
5. Boss 可击败
6. 玩家可死亡并可重开
7. package-specific rule 真实生效
8. 页面加载无 console error
```

额外的 package-specific tests：

```text
Duel:
- phase two 缩短攻击节奏

Procession:
- phase two 后有效 arena radius 单调收缩但不低于安全下限
- charge chain 发生，且不会让 Boss 卡在 arena 外

Revelation:
- phase two nova 的安全区语义与 phase one 不同
- 预警视觉和伤害判定使用同一个 recipe rule
```

## 实施顺序

### Step 1 — Recipe schema 和默认 recipe

**状态：已实现。**

**文件：** `src/game-recipe/*`

- 定义 `GameRecipeV0` TypeScript 类型和 Ajv schema。
- 创建 FABLE 的 `duel` 默认 recipe。
- `BossSpec` 保持兼容，不重写现有内容契约。

**验证：** schema unit tests；当前默认 Boss 仍可启动。

### Step 2 — Runtime 从 BossSpec 改为读 recipe

**状态：已实现。**

**文件：** `src/main.ts`、`src/game/createBattleScene.ts`、`src/game/combat/BattleController.ts`

- runtime 接收 recipe，而不是隐式假设唯一 encounter。
- attack order 由 `recipe.combat` 驱动。
- 先实现 `duel`，行为必须与当前 FABLE 基本一致。

**验证：** 现有 battle tests 全绿；Duel 回归截图不出现明显变化。

### Step 3 — Procession 的动态 arena radius

**状态：已实现。**

**文件：** `BattleController`、arena visual、对应 tests

- phase two 后按固定曲线收缩活动半径。
- 使用 recipe 的 phase-two attack order 支持 charge chain。
- 预警和位置限制使用同一个 authoritative radius。

**验证：** simulation 证明 Boss/玩家都不会被推出世界；手动完成一场 Procession。

### Step 4 — Revelation 的 nova 安全区反转

**状态：已实现。**

**文件：** `BattleController`、telegraph visual、对应 tests

- 将 nova 命中判断封装为 recipe-aware function。
- 预警环与实际安全区一致。
- 二阶段文本明确提示规则已改变。

**验证：** unit test 覆盖内环伤害、外环安全；手动完成一场 Revelation。

### Step 5 — 最小 Encounter Agent 与真实 QA 返工

**状态：已实现本地确定性 adapter 与接入契约；真实 Hermes delegate 仍待接入。**

**文件：** 后续 `runner/`、artifact schemas、fixtures

- Encounter Agent 的输出只能是 enum 选择、攻击顺序和理由。
- 令一条 fixture 故意生成非法/不可玩 Procession recipe。
- QA 拒绝后只重派 Encounter Agent；修复后 regression pass。

**验证：** 保存真实的失败 artifact、repair artifact 和 QAReport。

## 退出条件

v0 完成时，不要求“无限种玩法”。要求：

```text
- 3 个 package 都能从开始打到胜利或败北重开。
- 三者在第一分钟内可被玩家明确区分。
- 任意合法 GameRecipe 都可走 deterministic QA。
- 一条输入可映射为 package；低信息输入可回退为 Duel。
- QA 能拒绝一个坏 recipe，并触发只返工 Encounter Agent。
```

之后才评估是否增加第四个 package。新增 package 的门槛是：它必须复用现有 runtime primitives、拥有专属 deterministic tests、并在两分钟 demo 中可解释；否则不加入 catalog。
