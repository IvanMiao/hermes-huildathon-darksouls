import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import type {
  AnyArtifactEnvelope,
  MusicArtifactData,
  StudioEvent,
  StudioRunResult,
  VoiceArtifactData,
} from "./contracts";

const getRun = makeFunctionReference<"query">("studio:getRun");
const generateVoice = makeFunctionReference<"action">("studio:generateVoice");
const generateBossMusic = makeFunctionReference<"action">("music:generateBossMusic");
const mirrorRun = makeFunctionReference<"mutation">("studio:mirrorRun");

interface ConvexEvidenceClient {
  query(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
  action(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
  mutation(reference: unknown, args: Record<string, unknown>): Promise<unknown>;
}

export interface ConvexEvidenceOptions {
  convexUrl?: string;
  integrationToken?: string;
  client?: ConvexEvidenceClient;
  onEvent?: (event: StudioEvent) => void;
  onArtifact?: (artifact: AnyArtifactEnvelope) => void;
}

export interface ConvexMirrorResult {
  mode: "disabled" | "mirrored";
  recipe: GameRecipeV0;
  voice?: VoiceArtifactData;
  music?: MusicArtifactData;
  events: StudioEvent[];
  artifacts: AnyArtifactEnvelope[];
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function voiceEvidence(value: unknown): VoiceArtifactData | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.storageId !== "string"
    || typeof value.url !== "string"
    || typeof value.text !== "string"
    || value.source !== "elevenlabs_generated"
  ) {
    return undefined;
  }
  return {
    storageId: value.storageId,
    url: value.url,
    text: value.text,
    model: "eleven_multilingual_v2",
    source: "elevenlabs_generated",
    ...(optionalString(value.requestId) ? { requestId: String(value.requestId) } : {}),
    ...(optionalString(value.traceId) ? { traceId: String(value.traceId) } : {}),
    ...(typeof value.characterCost === "number"
      ? { characterCost: value.characterCost }
      : {}),
  };
}

function musicEvidence(value: unknown): MusicArtifactData | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.storageId !== "string"
    || typeof value.url !== "string"
    || typeof value.durationMs !== "number"
    || value.model !== "music_v2"
    || value.source !== "elevenlabs_generated"
    || !isRecord(value.compositionPlan)
  ) {
    return undefined;
  }
  return {
    storageId: value.storageId,
    url: value.url,
    durationMs: value.durationMs,
    model: "music_v2",
    source: "elevenlabs_generated",
    compositionPlan: value.compositionPlan,
    ...(isRecord(value.direction) ? { direction: value.direction } : {}),
    ...(optionalString(value.songId) ? { songId: String(value.songId) } : {}),
    ...(optionalString(value.requestId) ? { requestId: String(value.requestId) } : {}),
    ...(optionalString(value.traceId) ? { traceId: String(value.traceId) } : {}),
  };
}

function musicDirection(recipe: GameRecipeV0) {
  return {
    bossName: recipe.boss.boss.name,
    bossTitle: recipe.boss.boss.title,
    motif: recipe.presentation.motif,
    cameraMood: recipe.presentation.cameraMood,
    archetype: recipe.archetype,
    arenaTheme: recipe.arena.theme,
  };
}

function nextArtifactVersion(
  artifacts: readonly AnyArtifactEnvelope[],
  kind: AnyArtifactEnvelope["kind"],
): number {
  return Math.max(
    0,
    ...artifacts.filter((artifact) => artifact.kind === kind).map(({ version }) => version),
  ) + 1;
}

/** Generates and mirrors the release-bound audio that published game routes consume. */
export async function mirrorRunToConvex(
  result: StudioRunResult,
  options: ConvexEvidenceOptions = {},
): Promise<ConvexMirrorResult> {
  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL;
  const events = structuredClone(result.events);
  const artifacts = structuredClone(result.artifacts);
  if (!convexUrl) {
    return {
      mode: "disabled",
      recipe: result.recipe,
      events,
      artifacts,
    };
  }
  const integrationToken = options.integrationToken
    ?? process.env.STUDIO_INTEGRATION_TOKEN;
  if (!integrationToken) {
    throw new Error("STUDIO_INTEGRATION_TOKEN is required when CONVEX_URL is set.");
  }

  const client = options.client ?? new ConvexHttpClient(convexUrl) as unknown as ConvexEvidenceClient;
  let nextSequence = Math.max(0, ...events.map(({ sequence }) => sequence)) + 1;
  const emitEvent = (input: Omit<StudioEvent, "sequence" | "runId" | "occurredAt">) => {
    const event: StudioEvent = {
      ...input,
      sequence: nextSequence,
      runId: result.runId,
      occurredAt: new Date().toISOString(),
    };
    nextSequence += 1;
    events.push(event);
    options.onEvent?.(structuredClone(event));
    return event;
  };
  const emitArtifact = <T extends AnyArtifactEnvelope>(artifact: T): T => {
    artifacts.push(artifact);
    options.onArtifact?.(structuredClone(artifact));
    emitEvent({
      actor: artifact.actor,
      type: "artifact_written",
      status: "passed",
      summary: `${artifact.kind} v${artifact.version} recorded (${artifact.source.mode}).`,
      artifact: { kind: artifact.kind, version: artifact.version },
    });
    return artifact;
  };

  const existing = await client.query(getRun, { runId: result.runId });
  let voice = voiceEvidence(isRecord(existing) ? existing.voice : undefined);
  let music = musicEvidence(isRecord(existing) ? existing.music : undefined);

  if (result.status === "published") {
    emitEvent({
      actor: "Audio Producer",
      type: "task_started",
      status: "started",
      summary: "ElevenLabs phase voice and original boss music generation started.",
    });
    try {
      if (!voice) {
        const generatedVoice = await client.action(generateVoice, {
          text: result.recipe.boss.voice.text,
          integrationToken,
        });
        voice = voiceEvidence(generatedVoice);
        if (!voice) {
          throw new Error("Convex returned invalid ElevenLabs voice evidence.");
        }
      }
      if (!music) {
        const generatedMusic = await client.action(generateBossMusic, {
          direction: musicDirection(result.recipe),
          integrationToken,
        });
        music = musicEvidence(generatedMusic);
        if (!music) {
          throw new Error("Convex returned invalid ElevenLabs music evidence.");
        }
      }

      const voiceVersion = nextArtifactVersion(artifacts, "VoiceArtifact");
      emitArtifact({
        id: `${result.runId}:VoiceArtifact:v${voiceVersion}`,
        runId: result.runId,
        kind: "VoiceArtifact",
        version: voiceVersion,
        createdAt: new Date().toISOString(),
        actor: "Audio Producer",
        source: { mode: "generated" },
        data: voice,
      });
      const musicVersion = nextArtifactVersion(artifacts, "MusicArtifact");
      emitArtifact({
        id: `${result.runId}:MusicArtifact:v${musicVersion}`,
        runId: result.runId,
        kind: "MusicArtifact",
        version: musicVersion,
        createdAt: new Date().toISOString(),
        actor: "Audio Producer",
        source: { mode: "generated" },
        data: music,
      });
      emitEvent({
        actor: "Audio Producer",
        type: "task_completed",
        status: "passed",
        summary: "Phase-two voice and generated boss score are stored as release evidence.",
        artifact: { kind: "MusicArtifact", version: musicVersion },
      });
    } catch (error) {
      emitEvent({
        actor: "Audio Producer",
        type: "task_completed",
        status: "failed",
        summary: `Audio generation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      throw error;
    }
  }

  const recipe = voice && music
    ? {
        ...result.recipe,
        boss: {
          ...result.recipe.boss,
          voice: { ...result.recipe.boss.voice, url: voice.url },
        },
        presentation: {
          ...result.recipe.presentation,
          music: {
            ...result.recipe.presentation.music,
            url: music.url,
            durationMs: music.durationMs,
          },
        },
      }
    : result.recipe;
  await client.mutation(mirrorRun, jsonValue({
    integrationToken,
    runId: result.runId,
    status: result.status,
    inputText: recipe.source.text,
    recipe,
    events,
    artifacts,
    qaReport: result.qaReport,
    voice,
    music,
  }));

  return {
    mode: "mirrored",
    recipe,
    voice,
    music,
    events,
    artifacts,
  };
}
