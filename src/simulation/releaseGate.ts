import type { VoiceTrigger } from "../boss-spec/types";
import { isGameRecipeV0 } from "../game-recipe/normalize";
import type { GameRecipeV0 } from "../game-recipe/types";
import {
  BattleController,
  doesNovaHit,
  PROCESSION_MINIMUM_RADIUS,
  type CombatEvent,
  type CombatInput,
  type Vec2,
} from "../game/combat/BattleController";

export type ReleaseGateOwner =
  | "Studio Manager"
  | "Encounter Designer"
  | "Audio Producer";

export interface ReleaseGateCheck {
  id:
    | "legal_recipe"
    | "phase_two_reachable"
    | "boss_defeatable"
    | "death_restart"
    | "voice_trigger_reachable"
    | "package_rule_active";
  passed: boolean;
  artifact: "DraftGameRecipe" | "EncounterSpec" | "VoiceArtifact";
  owner: ReleaseGateOwner;
  message: string;
}

export interface ReleaseGateReport {
  passed: boolean;
  seed: number;
  simulatedSeconds: number;
  checks: ReleaseGateCheck[];
}

const FIXED_STEP = 1 / 60;
const MAX_FIGHT_SECONDS = 90;

const idleInput: CombatInput = {
  movement: { x: 0, z: 0 },
  attackPressed: false,
  dodgePressed: false,
  restartPressed: false,
};

function normalize(vector: Vec2): Vec2 {
  const magnitude = Math.hypot(vector.x, vector.z);
  return magnitude < 0.0001
    ? { x: 0, z: 0 }
    : { x: vector.x / magnitude, z: vector.z / magnitude };
}

function collect(target: CombatEvent[], events: CombatEvent[]): void {
  target.push(...events);
}

function initialFightWasRestored(controller: BattleController): boolean {
  return controller.state.outcome === "fighting"
    && controller.state.player.hp === controller.state.player.maxHp;
}

function createAutoplayerInput(controller: BattleController): CombatInput {
  const { player, boss } = controller.state;
  const towardBoss = normalize({
    x: boss.position.x - player.position.x,
    z: boss.position.z - player.position.z,
  });
  const distance = Math.hypot(
    boss.position.x - player.position.x,
    boss.position.z - player.position.z,
  );
  const attack = boss.attack;
  const telegraphRemaining = attack?.stage === "telegraph"
    ? attack.duration - attack.elapsed
    : Number.POSITIVE_INFINITY;
  const dangerIsImminent = attack !== null
    && (attack.stage === "active" || telegraphRemaining <= 0.1);

  return {
    movement: distance > 1.32 ? towardBoss : { x: 0, z: 0 },
    attackPressed: distance <= 1.55 && player.attackCooldown === 0,
    dodgePressed: dangerIsImminent && player.dodgeCooldown === 0,
    restartPressed: false,
  };
}

function simulateVictory(
  recipe: GameRecipeV0,
  seed: number,
): { seconds: number; events: CombatEvent[]; controller: BattleController } {
  void seed;
  const controller = new BattleController(recipe);
  const events: CombatEvent[] = [];
  let seconds = 0;

  while (seconds < MAX_FIGHT_SECONDS && controller.state.outcome === "fighting") {
    collect(events, controller.update(FIXED_STEP, createAutoplayerInput(controller)));
    seconds += FIXED_STEP;
  }

  return { seconds, events, controller };
}

function simulateDeathAndRestart(recipe: GameRecipeV0, seed: number): boolean {
  void seed;
  const controller = new BattleController(recipe);
  controller.state.player.position = { x: 0, z: -0.2 };
  controller.state.player.hp = 1;
  controller.state.boss.nextAttackRemaining = 0;

  for (let seconds = 0; seconds < 8 && controller.state.outcome === "fighting"; seconds += FIXED_STEP) {
    controller.update(FIXED_STEP, idleInput);
  }

  if (controller.state.outcome !== "defeat") {
    return false;
  }

  const restartEvents = controller.update(FIXED_STEP, {
    ...idleInput,
    restartPressed: true,
  });
  return restartEvents.some(({ type }) => type === "restart")
    && initialFightWasRestored(controller);
}

function voiceTriggerWasReached(
  trigger: VoiceTrigger,
  events: CombatEvent[],
): boolean {
  const eventTypes = new Set(events.map(({ type }) => type));
  if (trigger === "phase_two_enter") {
    return eventTypes.has("phase_two");
  }
  if (trigger === "boss_defeated") {
    return eventTypes.has("victory");
  }
  return eventTypes.has("phase_two") || eventTypes.has("victory");
}

function verifyPackageRule(recipe: GameRecipeV0): { passed: boolean; message: string } {
  if (recipe.archetype === "duel") {
    const phaseOne = new BattleController(recipe);
    phaseOne.state.boss.nextAttackRemaining = 0;
    phaseOne.update(FIXED_STEP, idleInput);
    const phaseOneTelegraph = phaseOne.state.boss.attack?.duration ?? 0;

    const phaseTwo = new BattleController(recipe);
    phaseTwo.state.phase = 2;
    phaseTwo.state.boss.nextAttackRemaining = 0;
    phaseTwo.update(FIXED_STEP, idleInput);
    const phaseTwoTelegraph = phaseTwo.state.boss.attack?.duration ?? 0;
    const passed = phaseTwoTelegraph > 0 && phaseTwoTelegraph < phaseOneTelegraph;
    return {
      passed,
      message: passed
        ? "Duel haste shortened the phase-two telegraph."
        : "Duel haste did not shorten the phase-two telegraph.",
    };
  }

  if (recipe.archetype === "procession") {
    const controller = new BattleController(recipe);
    controller.state.phase = 2;
    controller.state.player.hp = 1_000_000;
    controller.state.boss.nextAttackRemaining = 0;
    const attacks: string[] = [];
    let monotonic = true;
    let previousRadius = controller.state.arena.radius;
    for (let elapsed = 0; elapsed < 24; elapsed += FIXED_STEP) {
      const events = controller.update(FIXED_STEP, idleInput);
      attacks.push(...events
        .filter(({ type }) => type === "boss_attack_started")
        .map((event) => event.type === "boss_attack_started" ? event.attack : ""));
      monotonic &&= controller.state.arena.radius <= previousRadius + 0.000_001;
      previousRadius = controller.state.arena.radius;
    }
    const hasChargeChain = attacks.some(
      (attack, index) => attack === "charge" && attacks[index + 1] === "charge",
    );
    const reachedMinimum = Math.abs(
      controller.state.arena.radius - PROCESSION_MINIMUM_RADIUS,
    ) < 0.01;
    const passed = monotonic && reachedMinimum && hasChargeChain;
    return {
      passed,
      message: passed
        ? "Procession radius shrank monotonically to its safe floor and executed a charge chain."
        : "Procession did not prove both safe arena shrink and a charge chain.",
    };
  }

  const semanticsReversed = !doesNovaHit(recipe, 1, 1.5)
    && doesNovaHit(recipe, 1, 3.2)
    && doesNovaHit(recipe, 2, 1.5)
    && !doesNovaHit(recipe, 2, 4.4);
  return {
    passed: semanticsReversed,
    message: semanticsReversed
      ? "Revelation nova changed from an inner sanctuary to an outer safe ring."
      : "Revelation nova safety semantics did not reverse across phases.",
  };
}

function failedLegalRecipeReport(seed: number): ReleaseGateReport {
  const checks: ReleaseGateCheck[] = [
    {
      id: "legal_recipe",
      passed: false,
      artifact: "DraftGameRecipe",
      owner: "Studio Manager",
      message: "Canonical GameRecipeV0 schema rejected the release candidate.",
    },
    ...([
      ["phase_two_reachable", "EncounterSpec", "Encounter Designer"],
      ["boss_defeatable", "EncounterSpec", "Encounter Designer"],
      ["death_restart", "EncounterSpec", "Encounter Designer"],
      ["voice_trigger_reachable", "VoiceArtifact", "Audio Producer"],
      ["package_rule_active", "EncounterSpec", "Encounter Designer"],
    ] as const).map(([id, artifact, owner]) => ({
      id,
      passed: false,
      artifact,
      owner,
      message: "Blocked because the canonical BossSpec is illegal.",
    })),
  ];
  return { passed: false, seed, simulatedSeconds: 0, checks };
}

/** Runs the deterministic, headless release checks against the real combat state machine. */
export function runReleaseGate(input: unknown, seed = 0x51_4c_4d): ReleaseGateReport {
  if (!isGameRecipeV0(input)) {
    return failedLegalRecipeReport(seed);
  }

  const victoryRun = simulateVictory(input, seed);
  const reachedPhaseTwo = victoryRun.events.some(({ type }) => type === "phase_two");
  const defeatedBoss = victoryRun.controller.state.outcome === "victory";
  const deathRestartPassed = simulateDeathAndRestart(input, seed);
  const voiceReached = voiceTriggerWasReached(input.boss.voice.trigger, victoryRun.events);
  const packageRule = verifyPackageRule(input);

  const checks: ReleaseGateCheck[] = [
    {
      id: "legal_recipe",
      passed: true,
      artifact: "DraftGameRecipe",
      owner: "Studio Manager",
      message: "Canonical GameRecipeV0 schema passed.",
    },
    {
      id: "phase_two_reachable",
      passed: reachedPhaseTwo,
      artifact: "EncounterSpec",
      owner: "Encounter Designer",
      message: reachedPhaseTwo
        ? "Autoplayer crossed the phase-two threshold exactly through combat damage."
        : "Autoplayer never reached phase two before the simulation limit.",
    },
    {
      id: "boss_defeatable",
      passed: defeatedBoss,
      artifact: "EncounterSpec",
      owner: "Encounter Designer",
      message: defeatedBoss
        ? `Autoplayer defeated the boss in ${victoryRun.seconds.toFixed(2)}s.`
        : `Boss remained alive after ${MAX_FIGHT_SECONDS}s.`,
    },
    {
      id: "death_restart",
      passed: deathRestartPassed,
      artifact: "EncounterSpec",
      owner: "Encounter Designer",
      message: deathRestartPassed
        ? "A lethal hit reached defeat and restart restored the initial fight."
        : "Defeat or restart could not be reached through the combat controller.",
    },
    {
      id: "voice_trigger_reachable",
      passed: voiceReached,
      artifact: "VoiceArtifact",
      owner: "Audio Producer",
      message: voiceReached
        ? `Configured voice trigger '${input.boss.voice.trigger}' was reached.`
        : `Configured voice trigger '${input.boss.voice.trigger}' was not reached.`,
    },
    {
      id: "package_rule_active",
      passed: packageRule.passed,
      artifact: "EncounterSpec",
      owner: "Encounter Designer",
      message: packageRule.message,
    },
  ];

  return {
    passed: checks.every(({ passed }) => passed),
    seed,
    simulatedSeconds: victoryRun.seconds,
    checks,
  };
}
