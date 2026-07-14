import { BOSS_SPEC_BOUNDS } from "../src/boss-spec/schema";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import {
  runReleaseGateWithStages,
  type ReleaseGateStage,
} from "../src/simulation/releaseGate";
import {
  ARTIFACT_SCHEMA_VERSION,
  type EncounterSpec,
  type QAReport,
  type QAStageId,
  type StudioQACheck,
} from "./contracts";

export interface StudioQAStage {
  id: QAStageId;
  label: string;
  checkIds: StudioQACheck["id"][];
  passed: boolean;
  durationMs: number;
}

export interface StudioQAStageObserver {
  onStageStarted?: (stage: Omit<StudioQAStage, "passed" | "durationMs">) => void;
  onStageCompleted?: (stage: StudioQAStage) => void;
}

export interface StudioQAExecution {
  report: QAReport;
  stages: StudioQAStage[];
}

function encounterFailures(encounter: EncounterSpec): string[] {
  const failures = encounter.attacks.flatMap((attack) => {
    if (attack.telegraphMs < BOSS_SPEC_BOUNDS.telegraphMs.min) {
      return [
        `${attack.type}.telegraphMs is ${attack.telegraphMs}ms; minimum is ${BOSS_SPEC_BOUNDS.telegraphMs.min}ms.`,
      ];
    }
    return [];
  });
  if (
    encounter.archetype === "duel"
    && (encounter.arenaRule !== "open_ring" || encounter.phaseTwoRule !== "haste")
  ) {
    failures.push("Duel must use open_ring and haste.");
  }
  if (encounter.archetype === "procession") {
    const hasChargeChain = encounter.phaseTwoOrder.some(
      (attack, index) => attack === "charge"
        && encounter.phaseTwoOrder[index + 1] === "charge",
    );
    if (
      encounter.arenaRule !== "closing_ring"
      || encounter.phaseTwoRule !== "charge_chain"
      || !hasChargeChain
    ) {
      failures.push("Procession must use closing_ring and contain an adjacent charge chain.");
    }
  }
  if (
    encounter.archetype === "revelation"
    && (
      encounter.arenaRule !== "inner_sanctuary"
      || encounter.phaseTwoRule !== "outer_safe_nova"
      || encounter.phaseTwoOrder[0] !== "nova"
    )
  ) {
    failures.push("Revelation must reverse nova safety and open phase two with nova.");
  }
  return failures;
}

/** QA reports failures; it never mutates a specialist artifact. */
export function evaluateReleaseCandidate(
  recipe: GameRecipeV0,
  encounter: EncounterSpec,
  seed: number,
  regression: boolean,
): QAReport {
  return evaluateReleaseCandidateWithStages(
    recipe,
    encounter,
    seed,
    regression,
  ).report;
}

function studioStage(stage: ReleaseGateStage): StudioQAStage {
  return { ...stage };
}

export function evaluateReleaseCandidateWithStages(
  recipe: GameRecipeV0,
  encounter: EncounterSpec,
  seed: number,
  regression: boolean,
  observer: StudioQAStageObserver = {},
): StudioQAExecution {
  const stages: StudioQAStage[] = [];
  const encounterDefinition = {
    id: "encounter_contract" as const,
    label: "Encounter contract",
    checkIds: ["package_rule_active" as const],
  };
  observer.onStageStarted?.(encounterDefinition);
  const encounterStartedAt = performance.now();
  const failures = encounterFailures(encounter);
  const encounterStage: StudioQAStage = {
    ...encounterDefinition,
    passed: failures.length === 0,
    durationMs: Math.max(0, performance.now() - encounterStartedAt),
  };
  stages.push(encounterStage);
  observer.onStageCompleted?.(encounterStage);
  if (failures.length > 0) {
    return {
      report: {
        schemaVersion: ARTIFACT_SCHEMA_VERSION,
        passed: false,
        regression,
        seed,
        checks: [
          {
            id: "package_rule_active",
            passed: false,
            artifact: "EncounterSpec",
            owner: "Encounter Designer",
            message: failures.join(" "),
          },
        ],
        ownersToRetry: ["Encounter Designer"],
      },
      stages,
    };
  }

  const gateExecution = runReleaseGateWithStages(recipe, seed, {
    onStageStarted: observer.onStageStarted,
    onStageCompleted: (stage) => observer.onStageCompleted?.(studioStage(stage)),
  });
  stages.push(...gateExecution.stages.map(studioStage));
  const gate = gateExecution.report;
  const ownersToRetry = [
    ...new Set(
      gate.checks
        .filter(({ passed }) => !passed)
        .map(({ owner }) => owner),
    ),
  ];
  return {
    report: {
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      passed: gate.passed,
      regression,
      seed,
      checks: gate.checks,
      ownersToRetry,
    },
    stages,
  };
}
