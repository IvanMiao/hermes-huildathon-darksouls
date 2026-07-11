import { isBossSpec } from "../boss-spec/normalize";
import type { BossSpec, VoiceTrigger } from "../boss-spec/types";
import {
  BattleController,
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
    | "legal_spec"
    | "phase_two_reachable"
    | "boss_defeatable"
    | "death_restart"
    | "voice_trigger_reachable";
  passed: boolean;
  artifact: "DraftBossSpec" | "CombatSpec" | "VoiceArtifact";
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
  spec: BossSpec,
  seed: number,
): { seconds: number; events: CombatEvent[]; controller: BattleController } {
  const controller = new BattleController(spec, { seed });
  const events: CombatEvent[] = [];
  let seconds = 0;

  while (seconds < MAX_FIGHT_SECONDS && controller.state.outcome === "fighting") {
    collect(events, controller.update(FIXED_STEP, createAutoplayerInput(controller)));
    seconds += FIXED_STEP;
  }

  return { seconds, events, controller };
}

function simulateDeathAndRestart(spec: BossSpec, seed: number): boolean {
  const controller = new BattleController(spec, { seed });
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

function failedLegalSpecReport(seed: number): ReleaseGateReport {
  const checks: ReleaseGateCheck[] = [
    {
      id: "legal_spec",
      passed: false,
      artifact: "DraftBossSpec",
      owner: "Studio Manager",
      message: "Canonical BossSpec schema rejected the release candidate.",
    },
    ...([
      ["phase_two_reachable", "CombatSpec", "Encounter Designer"],
      ["boss_defeatable", "CombatSpec", "Encounter Designer"],
      ["death_restart", "CombatSpec", "Encounter Designer"],
      ["voice_trigger_reachable", "VoiceArtifact", "Audio Producer"],
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
  if (!isBossSpec(input)) {
    return failedLegalSpecReport(seed);
  }

  const victoryRun = simulateVictory(input, seed);
  const reachedPhaseTwo = victoryRun.events.some(({ type }) => type === "phase_two");
  const defeatedBoss = victoryRun.controller.state.outcome === "victory";
  const deathRestartPassed = simulateDeathAndRestart(input, seed);
  const voiceReached = voiceTriggerWasReached(input.voice.trigger, victoryRun.events);

  const checks: ReleaseGateCheck[] = [
    {
      id: "legal_spec",
      passed: true,
      artifact: "DraftBossSpec",
      owner: "Studio Manager",
      message: "Canonical BossSpec schema passed.",
    },
    {
      id: "phase_two_reachable",
      passed: reachedPhaseTwo,
      artifact: "CombatSpec",
      owner: "Encounter Designer",
      message: reachedPhaseTwo
        ? "Autoplayer crossed the phase-two threshold exactly through combat damage."
        : "Autoplayer never reached phase two before the simulation limit.",
    },
    {
      id: "boss_defeatable",
      passed: defeatedBoss,
      artifact: "CombatSpec",
      owner: "Encounter Designer",
      message: defeatedBoss
        ? `Autoplayer defeated the boss in ${victoryRun.seconds.toFixed(2)}s.`
        : `Boss remained alive after ${MAX_FIGHT_SECONDS}s.`,
    },
    {
      id: "death_restart",
      passed: deathRestartPassed,
      artifact: "CombatSpec",
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
        ? `Configured voice trigger '${input.voice.trigger}' was reached.`
        : `Configured voice trigger '${input.voice.trigger}' was not reached.`,
    },
  ];

  return {
    passed: checks.every(({ passed }) => passed),
    seed,
    simulatedSeconds: victoryRun.seconds,
    checks,
  };
}
