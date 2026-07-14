import { resolve } from "node:path";
import type { BossSpec } from "../src/boss-spec/types";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import {
  type ArtifactEnvelope,
  type ArtifactDataByKind,
  type ArtifactSource,
  type EncounterSpec,
  type ProductionBrief,
  type QAReport,
  type SpecialistOwner,
  type StudioEvent,
  type StudioRunResult,
  type ThemeSpec,
} from "./contracts";
import { evaluateReleaseCandidateWithStages } from "./qa";
import { RunStore } from "./runStore";
import type { RunStoreObserver } from "./runStore";
import {
  createLocalStudioAdapters,
  createProductionBrief,
  type SpecialistAdapter,
  type StudioAdapters,
} from "./specialists";

export interface StudioManagerOptions {
  runsRoot?: string;
  timeoutMs?: number;
  adapters?: StudioAdapters;
}

export interface StartRunOptions extends RunStoreObserver {
  runId?: string;
}

class SpecialistTimeoutError extends Error {
  constructor(owner: SpecialistOwner, timeoutMs: number) {
    super(`${owner} exceeded the hard ${timeoutMs}ms timeout.`);
    this.name = "SpecialistTimeoutError";
  }
}

function withTimeout<T>(
  task: Promise<T>,
  owner: SpecialistOwner,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolveTask, rejectTask) => {
    const timeout = setTimeout(() => {
      rejectTask(new SpecialistTimeoutError(owner, timeoutMs));
    }, timeoutMs);
    task.then(
      (result) => {
        clearTimeout(timeout);
        resolveTask(result);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        rejectTask(error);
      },
    );
  });
}

function createRunId(brief: ProductionBrief): string {
  const compactTimestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "z")
    .toLowerCase();
  return `${compactTimestamp}-${brief.inputHash.slice(0, 8)}`;
}

function mergeGameRecipe(
  runId: string,
  brief: ProductionBrief,
  theme: ThemeSpec,
  encounter: EncounterSpec,
): GameRecipeV0 {
  const boss: BossSpec = {
    slug: theme.slug,
    title: theme.title,
    boss: {
      name: theme.boss.name,
      title: theme.boss.title,
      palette: [...theme.boss.palette],
      maxHp: encounter.maxHp,
      phaseTwoAt: encounter.phaseTwoAt,
      phase2Multiplier: encounter.phase2Multiplier,
      lines: { ...theme.boss.lines },
    },
    attacks: encounter.attacks.map((attack) => ({ ...attack })) as BossSpec["attacks"],
    voice: {
      trigger: "phase_two_or_defeat",
      text: theme.boss.lines.phaseTwo,
      url: brief.voiceRequested
        ? `/runs/${runId}/voice.mp3`
        : "/audio/cached-house-voice.mp3",
    },
    arena: { ...theme.arena },
  };
  return {
    version: 1,
    runId,
    source: {
      text: brief.inputText,
      normalizedIntent: theme.normalizedIntent,
    },
    selection: { ...encounter.selection },
    archetype: encounter.archetype,
    arena: {
      rule: encounter.arenaRule,
      theme: theme.arena.theme,
    },
    combat: {
      phaseOneOrder: [...encounter.phaseOneOrder],
      phaseTwoOrder: [...encounter.phaseTwoOrder],
      phaseTwoRule: encounter.phaseTwoRule,
    },
    boss,
    presentation: {
      motif: theme.motif,
      cameraMood: theme.cameraMood,
      music: {
        url: `/runs/${runId}/music.mp3`,
        durationMs: 30_000,
        sections: {
          phaseOneLoopStartMs: 3_000,
          phaseTwoStartMs: 14_000,
          phaseTwoLoopStartMs: 17_000,
          aftermathStartMs: 27_000,
        },
      },
    },
  };
}

function feedbackForOwner(report: QAReport, owner: SpecialistOwner): string[] {
  return report.checks
    .filter((check) => check.owner === owner && !check.passed)
    .map(({ message }) => message);
}

export class HermesStudioManager {
  private readonly runsRoot: string;
  private readonly timeoutMs: number;
  private readonly adapters: StudioAdapters;

  constructor(options: StudioManagerOptions = {}) {
    this.runsRoot = resolve(options.runsRoot ?? ".soulloom/runs");
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.adapters = options.adapters ?? createLocalStudioAdapters();
  }

  async start(inputText: string, options: StartRunOptions = {}): Promise<StudioRunResult> {
    const brief = createProductionBrief(inputText);
    const runId = options.runId ?? createRunId(brief);
    const store = await RunStore.create(this.runsRoot, runId, {
      onEvent: options.onEvent,
      onArtifact: options.onArtifact,
    });
    await store.appendEvent({
      actor: "Studio Manager",
      type: "run_started",
      status: "started",
      summary: `Production started for input ${brief.inputHash}.`,
    });
    await store.writeArtifact({
      kind: "ProductionBrief",
      actor: "Studio Manager",
      source: { mode: "generated" },
      data: brief,
    });

    const [themeArtifact, encounterArtifact] = await Promise.all([
      this.runSpecialist(
        store,
        brief,
        "Creative Director",
        "ThemeSpec",
        this.adapters.creative,
      ),
      this.runSpecialist(
        store,
        brief,
        "Encounter Designer",
        "EncounterSpec",
        this.adapters.encounter,
      ),
    ]);

    let theme = themeArtifact.data;
    let encounter = encounterArtifact.data;
    let recipe = await this.writeDraft(store, brief, theme, encounter, false);
    let qaArtifact = await this.runQA(store, brief, recipe, encounter, false);

    if (!qaArtifact.data.passed) {
      await store.appendEvent({
        actor: "Release QA",
        type: "qa_blocked",
        status: "failed",
        summary: `Release blocked by ${qaArtifact.data.ownersToRetry.join(", ")}.`,
        artifact: { kind: "QAReport", version: qaArtifact.version },
      });

      const retryOwners = qaArtifact.data.ownersToRetry.filter(
        (owner): owner is SpecialistOwner =>
          owner === "Creative Director" || owner === "Encounter Designer",
      );
      if (retryOwners.length > 0) {
        await Promise.all(retryOwners.map(async (owner) => {
          await store.appendEvent({
            actor: "Studio Manager",
            type: "retry_routed",
            status: "info",
            summary: `Only ${owner} was assigned the failed ownership area.`,
            owner,
          });
          if (owner === "Creative Director") {
            const repaired = await this.repairSpecialist(
              store,
              brief,
              owner,
              "ThemeSpec",
              this.adapters.creative,
              theme,
              feedbackForOwner(qaArtifact.data, owner),
            );
            theme = repaired.data;
          } else {
            const repaired = await this.repairSpecialist(
              store,
              brief,
              owner,
              "EncounterSpec",
              this.adapters.encounter,
              encounter,
              feedbackForOwner(qaArtifact.data, owner),
            );
            encounter = repaired.data;
          }
        }));
        await store.appendEvent({
          actor: "Release QA",
          type: "regression_started",
          status: "started",
          summary: "Regression QA started against the repaired draft.",
        });
        recipe = await this.writeDraft(store, brief, theme, encounter, true);
        qaArtifact = await this.runQA(store, brief, recipe, encounter, true);
      }
    }

    const status = qaArtifact.data.passed ? "published" : "release_blocked";
    if (qaArtifact.data.passed) {
      await store.publish(recipe, qaArtifact);
    } else {
      await store.appendEvent({
        actor: "Publisher",
        type: "release_blocked",
        status: "failed",
        summary: "No release.json was created because regression QA did not pass.",
        artifact: { kind: "QAReport", version: qaArtifact.version },
      });
    }

    return {
      runId,
      status,
      runDirectory: store.runDirectory,
      recipe,
      qaReport: qaArtifact.data,
      artifacts: await store.readArtifacts(),
      events: await store.readEvents(),
    };
  }

  private async runSpecialist<K extends "ThemeSpec" | "EncounterSpec">(
    store: RunStore,
    brief: ProductionBrief,
    owner: SpecialistOwner,
    kind: K,
    adapter: SpecialistAdapter<ArtifactDataByKind[K]>,
  ): Promise<ArtifactEnvelope<K>> {
    await store.appendEvent({
      actor: owner,
      type: "task_started",
      status: "started",
      summary: `${owner} started ${kind}.`,
    });

    let data: ArtifactDataByKind[K];
    let source: ArtifactSource = {
      mode: "generated",
      agentRuntime: adapter.agentRuntime,
    };
    try {
      data = await withTimeout(adapter.generate(brief), owner, this.timeoutMs);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      data = adapter.fallback(brief);
      source = {
        mode: "cached_fallback",
        fallbackReason: reason,
        agentRuntime: adapter.agentRuntime,
      };
      await store.appendEvent({
        actor: owner,
        type: "fallback_used",
        status: "failed",
        summary: `${kind} used cached fallback: ${reason}`,
      });
    }

    const artifact = await store.writeArtifact({ kind, actor: owner, source, data });
    await store.appendEvent({
      actor: owner,
      type: "task_completed",
      status: "passed",
      summary: `${owner} completed ${kind} v${artifact.version}.`,
      artifact: { kind, version: artifact.version },
    });
    return artifact;
  }

  private async repairSpecialist<K extends "ThemeSpec" | "EncounterSpec">(
    store: RunStore,
    brief: ProductionBrief,
    owner: SpecialistOwner,
    kind: K,
    adapter: SpecialistAdapter<ArtifactDataByKind[K]>,
    previous: ArtifactDataByKind[K],
    feedback: readonly string[],
  ): Promise<ArtifactEnvelope<K>> {
    let data: ArtifactDataByKind[K];
    let source: ArtifactSource = {
      mode: "repair",
      agentRuntime: adapter.agentRuntime,
    };
    try {
      data = await withTimeout(
        adapter.repair(brief, previous, feedback),
        owner,
        this.timeoutMs,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      data = adapter.fallback(brief);
      source = {
        mode: "default_fallback",
        fallbackReason: reason,
        agentRuntime: adapter.agentRuntime,
      };
      await store.appendEvent({
        actor: owner,
        type: "fallback_used",
        status: "failed",
        summary: `${kind} repair used default fallback: ${reason}`,
      });
    }
    return store.writeArtifact({ kind, actor: owner, source, data });
  }

  private async writeDraft(
    store: RunStore,
    brief: ProductionBrief,
    theme: ThemeSpec,
    encounter: EncounterSpec,
    repaired: boolean,
  ): Promise<GameRecipeV0> {
    const recipe = mergeGameRecipe(
      store.runId,
      brief,
      theme,
      encounter,
    );
    await store.writeArtifact({
      kind: "DraftGameRecipe",
      actor: "Studio Manager",
      source: { mode: repaired ? "repair" : "generated" },
      data: recipe,
    });
    return recipe;
  }

  private async runQA(
    store: RunStore,
    brief: ProductionBrief,
    recipe: GameRecipeV0,
    encounter: EncounterSpec,
    regression: boolean,
  ): Promise<ArtifactEnvelope<"QAReport">> {
    await store.appendEvent({
      actor: "Release QA",
      type: "task_started",
      status: "started",
      summary: regression ? "Regression QA started." : "Release QA started.",
    });
    const stageEvents: Promise<StudioEvent>[] = [];
    const execution = evaluateReleaseCandidateWithStages(
      recipe,
      encounter,
      brief.seed,
      regression,
      {
        onStageStarted: (stage) => {
          stageEvents.push(store.appendEvent({
            actor: "Release QA",
            type: "qa_stage_started",
            status: "started",
            summary: `${stage.label} started.`,
            qaStage: stage,
          }));
        },
        onStageCompleted: (stage) => {
          stageEvents.push(store.appendEvent({
            actor: "Release QA",
            type: "qa_stage_completed",
            status: stage.passed ? "passed" : "failed",
            summary: `${stage.label} ${stage.passed ? "passed" : "failed"} in ${stage.durationMs.toFixed(2)}ms.`,
            qaStage: stage,
          }));
        },
      },
    );
    await Promise.all(stageEvents);
    return store.writeArtifact({
      kind: "QAReport",
      actor: "Release QA",
      source: { mode: "generated" },
      data: execution.report,
    });
  }
}
