import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import type { StudioRunResult } from "./contracts";

interface VoiceEvidence {
  storageId: string;
  url: string;
  text: string;
  source: "elevenlabs_generated";
}

const getRun = makeFunctionReference<"query">("studio:getRun");
const generateVoice = makeFunctionReference<"action">("studio:generateVoice");
const mirrorRun = makeFunctionReference<"mutation">("studio:mirrorRun");

export interface ConvexMirrorResult {
  mode: "disabled" | "mirrored";
  recipe: GameRecipeV0;
  voice?: VoiceEvidence;
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isVoiceEvidence(value: unknown): value is VoiceEvidence {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VoiceEvidence>;
  return typeof candidate.storageId === "string"
    && typeof candidate.url === "string"
    && typeof candidate.text === "string"
    && candidate.source === "elevenlabs_generated";
}

export async function mirrorRunToConvex(
  result: StudioRunResult,
): Promise<ConvexMirrorResult> {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    return { mode: "disabled", recipe: result.recipe };
  }
  const integrationToken = process.env.STUDIO_INTEGRATION_TOKEN;
  if (!integrationToken) {
    throw new Error("STUDIO_INTEGRATION_TOKEN is required when CONVEX_URL is set.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const existing = await client.query(getRun, { runId: result.runId }) as {
    voice?: unknown;
  } | null;
  let voice = isVoiceEvidence(existing?.voice) ? existing.voice : undefined;
  if (!voice && result.status === "published") {
    const generated = await client.action(generateVoice, {
      text: result.recipe.boss.voice.text,
      integrationToken,
    });
    if (!isVoiceEvidence(generated)) {
      throw new Error("Convex returned invalid ElevenLabs voice evidence.");
    }
    voice = generated;
  }

  const recipe = voice
    ? {
        ...result.recipe,
        boss: {
          ...result.recipe.boss,
          voice: { ...result.recipe.boss.voice, url: voice.url },
        },
      }
    : result.recipe;
  await client.mutation(mirrorRun, jsonValue({
    integrationToken,
    runId: result.runId,
    status: result.status,
    inputText: recipe.source.text,
    recipe,
    events: result.events,
    artifacts: result.artifacts,
    qaReport: result.qaReport,
    voice,
  }));

  return { mode: "mirrored", recipe, voice };
}
