import type { BossSpec } from "../src/boss-spec/types";
import type {
  ArenaRule,
  AttackOrder,
  CameraMood,
  EncounterArchetype,
  GameRecipeV0,
  PhaseTwoRule,
} from "../src/game-recipe/types";
import type {
  ReleaseGateCheck,
  ReleaseGateOwner,
} from "../src/simulation/releaseGate";

export const ARTIFACT_SCHEMA_VERSION = "1.0" as const;

export const ARTIFACT_KINDS = [
  "ProductionBrief",
  "ThemeSpec",
  "EncounterSpec",
  "DraftGameRecipe",
  "QAReport",
  "VoiceArtifact",
  "MusicArtifact",
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];
export type SpecialistOwner = "Creative Director" | "Encounter Designer";
export type QAOwner = ReleaseGateOwner | "Creative Director";
export type QAStageId =
  | "encounter_contract"
  | "recipe_contract"
  | "combat_autoplay"
  | "defeat_restart"
  | "package_behavior";
export type StudioQACheck = Omit<ReleaseGateCheck, "artifact" | "owner"> & {
  artifact: ReleaseGateCheck["artifact"] | "ThemeSpec";
  owner: QAOwner;
};
export type StudioActor =
  | "Studio Manager"
  | SpecialistOwner
  | "Audio Producer"
  | "Release QA"
  | "Publisher";

export interface ArtifactSource {
  mode: "generated" | "repair" | "cached_fallback" | "default_fallback";
  fallbackReason?: string;
  agentRuntime?: "local_fixture" | "hermes_specialist";
}

export interface ProductionBrief {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  inputText: string;
  inputHash: string;
  seed: number;
  conflict: string;
  normalizedIntent: string;
  tone: "gothic" | "ritual" | "void";
  voiceRequested: boolean;
}

export interface ThemeSpec {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  normalizedIntent: string;
  slug: string;
  title: string;
  boss: {
    name: string;
    title: string;
    palette: [string, string, string];
    lines: BossSpec["boss"]["lines"];
  };
  arena: BossSpec["arena"];
  lore: string;
  motif: string;
  cameraMood: CameraMood;
  summary: string;
}

export interface EncounterSpec {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  archetype: EncounterArchetype;
  selection: GameRecipeV0["selection"];
  arenaRule: ArenaRule;
  phaseOneOrder: AttackOrder;
  phaseTwoOrder: AttackOrder;
  phaseTwoRule: PhaseTwoRule;
  maxHp: number;
  phaseTwoAt: number;
  phase2Multiplier: number;
  attacks: BossSpec["attacks"];
  difficulty: "measured" | "aggressive";
  designIntent: string;
  summary: string;
}

export interface QAReport {
  schemaVersion: typeof ARTIFACT_SCHEMA_VERSION;
  passed: boolean;
  regression: boolean;
  seed: number;
  checks: StudioQACheck[];
  ownersToRetry: QAOwner[];
}

export interface VoiceArtifactData {
  storageId: string;
  url: string;
  text: string;
  model: "eleven_multilingual_v2";
  source: "elevenlabs_generated";
  requestId?: string;
  traceId?: string;
  characterCost?: number;
}

export interface MusicArtifactData {
  storageId: string;
  url: string;
  durationMs: number;
  model: "music_v2";
  source: "elevenlabs_generated";
  songId?: string;
  requestId?: string;
  traceId?: string;
  compositionPlan: unknown;
  direction?: unknown;
}

export interface ArtifactDataByKind {
  ProductionBrief: ProductionBrief;
  ThemeSpec: ThemeSpec;
  EncounterSpec: EncounterSpec;
  DraftGameRecipe: GameRecipeV0;
  QAReport: QAReport;
  VoiceArtifact: VoiceArtifactData;
  MusicArtifact: MusicArtifactData;
}

export interface ArtifactEnvelope<K extends ArtifactKind = ArtifactKind> {
  id: string;
  runId: string;
  kind: K;
  version: number;
  createdAt: string;
  actor: StudioActor;
  source: ArtifactSource;
  data: ArtifactDataByKind[K];
}

export type AnyArtifactEnvelope = {
  [K in ArtifactKind]: ArtifactEnvelope<K>;
}[ArtifactKind];

export const STUDIO_EVENT_TYPES = [
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
] as const;

export interface StudioEvent {
  sequence: number;
  runId: string;
  occurredAt: string;
  actor: StudioActor;
  type: (typeof STUDIO_EVENT_TYPES)[number];
  status: "started" | "passed" | "failed" | "info";
  summary: string;
  artifact?: {
    kind: ArtifactKind;
    version: number;
  };
  owner?: QAOwner;
  qaStage?: {
    id: QAStageId;
    label: string;
    checkIds: StudioQACheck["id"][];
    passed?: boolean;
    durationMs?: number;
  };
}

export interface PublishedRelease {
  runId: string;
  status: "published";
  publishedAt: string;
  recipe: GameRecipeV0;
  qaReportVersion: number;
}

export interface StudioRunResult {
  runId: string;
  status: "published" | "release_blocked";
  runDirectory: string;
  recipe: GameRecipeV0;
  qaReport: QAReport;
  artifacts: AnyArtifactEnvelope[];
  events: StudioEvent[];
}
