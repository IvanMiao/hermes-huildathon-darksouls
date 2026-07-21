import { toMusicEvidence, toVoiceEvidence } from "../cloudflare/evidenceApi";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import type {
  AnyArtifactEnvelope,
  MusicArtifactData,
  StudioEvent,
  StudioRunResult,
  VoiceArtifactData,
} from "./contracts";

export interface CloudflareEvidenceOptions {
  evidenceUrl?: string;
  integrationToken?: string;
  fetcher?: typeof fetch;
  onEvent?: (event: StudioEvent) => void;
  onArtifact?: (artifact: AnyArtifactEnvelope) => void;
}

export interface CloudflareMirrorResult {
  mode: "disabled" | "mirrored";
  recipe: GameRecipeV0;
  voice?: VoiceArtifactData;
  music?: MusicArtifactData;
  events: StudioEvent[];
  artifacts: AnyArtifactEnvelope[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function endpoint(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl.replace(/\/$/, "")}/`).toString();
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

async function requireOk(response: Response, operation: string): Promise<unknown> {
  const body = await responseJson(response);
  if (response.ok) return body;
  const detail = isRecord(body) && typeof body.error === "string"
    ? body.error
    : `HTTP ${response.status}`;
  throw new Error(`${operation} failed: ${detail}`);
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

/** Generates Cloudflare-hosted audio and mirrors the complete release into D1. */
export async function mirrorRunToCloudflare(
  result: StudioRunResult,
  options: CloudflareEvidenceOptions = {},
): Promise<CloudflareMirrorResult> {
  const evidenceUrl = options.evidenceUrl ?? process.env.CLOUDFLARE_EVIDENCE_URL;
  const events = structuredClone(result.events);
  const artifacts = structuredClone(result.artifacts);
  if (!evidenceUrl) {
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
    throw new Error(
      "STUDIO_INTEGRATION_TOKEN is required when CLOUDFLARE_EVIDENCE_URL is set.",
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const authorization = `Bearer ${integrationToken}`;
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

  let voice: VoiceArtifactData | undefined;
  let music: MusicArtifactData | undefined;
  if (result.status === "published") {
    emitEvent({
      actor: "Audio Producer",
      type: "task_started",
      status: "started",
      summary: "ElevenLabs phase voice and original boss music generation started.",
    });
    try {
      const audioResponse = await fetcher(endpoint(
        evidenceUrl,
        `/api/evidence/runs/${encodeURIComponent(result.runId)}/audio`,
      ), {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceText: result.recipe.boss.voice.text,
          direction: musicDirection(result.recipe),
        }),
      });
      const generated = await requireOk(audioResponse, "Cloudflare audio generation");
      voice = toVoiceEvidence(isRecord(generated) ? generated.voice : undefined);
      music = toMusicEvidence(isRecord(generated) ? generated.music : undefined);
      if (!voice || !music) {
        throw new Error("Cloudflare returned invalid ElevenLabs audio evidence.");
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
  const mirrorResponse = await fetcher(endpoint(
    evidenceUrl,
    `/api/evidence/runs/${encodeURIComponent(result.runId)}`,
  ), {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      runId: result.runId,
      status: result.status,
      inputText: recipe.source.text,
      recipe,
      events,
      artifacts,
      qaReport: result.qaReport,
      voice,
      music,
    }),
  });
  await requireOk(mirrorResponse, "Cloudflare evidence mirror");

  return {
    mode: "mirrored",
    recipe,
    voice,
    music,
    events,
    artifacts,
  };
}
