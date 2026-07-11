import type {
  ArtifactSource,
  QAOwner,
  StudioActor,
  StudioEvent,
} from "../../runner/contracts";
import { isGameRecipeV0 } from "../game-recipe/normalize";
import type {
  QAProofCheck,
  StudioArtifactFixture,
  StudioRunFixture,
} from "./fixtures";

const ACTORS = new Set<StudioActor>([
  "Studio Manager",
  "Creative Director",
  "Encounter Designer",
  "Release QA",
  "Publisher",
]);
const EVENT_TYPES = new Set<StudioEvent["type"]>([
  "run_started",
  "task_started",
  "task_completed",
  "artifact_written",
  "fallback_used",
  "qa_stage_started",
  "qa_stage_completed",
  "qa_blocked",
  "retry_routed",
  "regression_started",
  "release_published",
  "release_blocked",
]);
const EVENT_STATUSES = new Set<StudioEvent["status"]>([
  "started",
  "passed",
  "failed",
  "info",
]);
const QA_STAGE_IDS = new Set([
  "encounter_contract",
  "recipe_contract",
  "combat_autoplay",
  "defeat_restart",
  "package_behavior",
]);
const ARTIFACT_KINDS = new Set<StudioArtifactFixture["kind"]>([
  "ProductionBrief",
  "ThemeSpec",
  "EncounterSpec",
  "DraftGameRecipe",
  "QAReport",
]);
const SOURCE_MODES = new Set<ArtifactSource["mode"]>([
  "generated",
  "repair",
  "cached_fallback",
  "default_fallback",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStudioEvent(value: unknown): value is StudioEvent {
  if (!isRecord(value)) return false;
  const validEvent = typeof value.sequence === "number"
    && typeof value.runId === "string"
    && typeof value.occurredAt === "string"
    && ACTORS.has(value.actor as StudioActor)
    && EVENT_TYPES.has(value.type as StudioEvent["type"])
    && EVENT_STATUSES.has(value.status as StudioEvent["status"])
    && typeof value.summary === "string";
  if (!validEvent || value.qaStage === undefined) return validEvent;
  return isRecord(value.qaStage)
    && QA_STAGE_IDS.has(String(value.qaStage.id))
    && typeof value.qaStage.label === "string"
    && Array.isArray(value.qaStage.checkIds)
    && value.qaStage.checkIds.every((id) => typeof id === "string")
    && (value.qaStage.passed === undefined || typeof value.qaStage.passed === "boolean")
    && (value.qaStage.durationMs === undefined || typeof value.qaStage.durationMs === "number");
}

function artifactSummary(kind: string, version: number, data: unknown): string {
  if (isRecord(data) && typeof data.summary === "string") return data.summary;
  return `${kind} v${version} recorded by the live Studio run.`;
}

function toArtifact(value: unknown): StudioArtifactFixture | null {
  if (!isRecord(value) || !ARTIFACT_KINDS.has(value.kind as StudioArtifactFixture["kind"])) {
    return null;
  }
  if (
    typeof value.version !== "number"
    || !ACTORS.has(value.actor as StudioActor)
    || !isRecord(value.source)
    || !SOURCE_MODES.has(value.source.mode as ArtifactSource["mode"])
  ) {
    return null;
  }
  return {
    kind: value.kind as StudioArtifactFixture["kind"],
    version: value.version,
    actor: value.actor as StudioActor,
    source: value.source as unknown as ArtifactSource,
    summary: artifactSummary(String(value.kind), value.version, value.data),
    data: value.data,
  };
}

function toQACheck(value: unknown): QAProofCheck | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || typeof value.passed !== "boolean"
    || typeof value.owner !== "string"
    || typeof value.message !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    passed: value.passed,
    owner: value.owner as QAOwner,
    message: value.message,
  };
}

function eventSequenceForArtifact(
  events: readonly StudioEvent[],
  kind: StudioArtifactFixture["kind"],
  version: number,
): number {
  return events.find((event) => (
    event.artifact?.kind === kind && event.artifact.version === version
  ))?.sequence ?? events.length;
}

export function toLiveStudioRun(value: unknown): StudioRunFixture | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.runId !== "string"
    || typeof value.inputText !== "string"
    || (value.status !== "published" && value.status !== "release_blocked")
    || !isGameRecipeV0(value.recipe)
    || !Array.isArray(value.events)
    || !value.events.every(isStudioEvent)
    || !Array.isArray(value.artifacts)
  ) {
    return null;
  }
  const events = value.events;
  const artifacts = value.artifacts.map(toArtifact);
  if (artifacts.some((artifact) => artifact === null)) return null;
  const validArtifacts = artifacts.filter((artifact): artifact is StudioArtifactFixture => artifact !== null);
  const qaReports = validArtifacts.flatMap((artifact) => {
    if (artifact.kind !== "QAReport" || !isRecord(artifact.data)) return [];
    const checks = Array.isArray(artifact.data.checks)
      ? artifact.data.checks.map(toQACheck)
      : [];
    if (
      typeof artifact.data.passed !== "boolean"
      || typeof artifact.data.regression !== "boolean"
      || checks.some((check) => check === null)
    ) {
      return [];
    }
    return [{
      version: artifact.version,
      eventSequence: eventSequenceForArtifact(events, artifact.kind, artifact.version),
      passed: artifact.data.passed,
      regression: artifact.data.regression,
      checks: checks.filter((check): check is QAProofCheck => check !== null),
    }];
  });
  return {
    runId: value.runId,
    label: `${value.recipe.boss.boss.name}, ${value.recipe.boss.boss.title}`,
    evidenceKind: "live",
    inputText: value.inputText,
    status: value.status,
    recipe: value.recipe,
    events,
    artifacts: validArtifacts,
    qaReports,
  };
}
