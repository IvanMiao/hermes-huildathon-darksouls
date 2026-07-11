import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const runStatus = v.union(v.literal("published"), v.literal("release_blocked"));
const voiceEvidence = v.object({
  storageId: v.id("_storage"),
  url: v.string(),
  text: v.string(),
  source: v.literal("elevenlabs_generated"),
});

const elevenLabsVoiceSettings = {
  stability: 0.42,
  similarity_boost: 0.75,
  style: 0,
  use_speaker_boost: true,
  speed: 0.88,
} as const;

export const generateVoice = action({
  args: { text: v.string(), integrationToken: v.string() },
  handler: async (ctx, { text, integrationToken }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const expectedToken = process.env.STUDIO_INTEGRATION_TOKEN;
    if (!expectedToken || integrationToken !== expectedToken) {
      throw new Error("Unauthorized studio integration request.");
    }
    if (!apiKey || !voiceId) {
      throw new Error("ElevenLabs credentials are not configured in Convex.");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: elevenLabsVoiceSettings,
        }),
      },
    );
    if (!response.ok) {
      const details = (await response.text()).slice(0, 300);
      throw new Error(`ElevenLabs returned ${response.status}: ${details}`);
    }

    const storageId = await ctx.storage.store(await response.blob());
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Convex stored the voice but did not return a public URL.");
    }
    return {
      storageId,
      url,
      text,
      source: "elevenlabs_generated" as const,
    };
  },
});

export const mirrorRun = mutation({
  args: {
    integrationToken: v.string(),
    runId: v.string(),
    status: runStatus,
    inputText: v.string(),
    recipe: v.any(),
    events: v.any(),
    artifacts: v.any(),
    qaReport: v.any(),
    voice: v.optional(voiceEvidence),
  },
  handler: async (ctx, { integrationToken, ...args }) => {
    const expectedToken = process.env.STUDIO_INTEGRATION_TOKEN;
    if (!expectedToken || integrationToken !== expectedToken) {
      throw new Error("Unauthorized studio integration request.");
    }
    const existing = await ctx.db
      .query("studioRuns")
      .withIndex("by_run_id", (queryBuilder) => queryBuilder.eq("runId", args.runId))
      .unique();
    const document = { ...args, mirroredAt: Date.now() };
    if (existing) {
      await ctx.db.replace(existing._id, document);
      return existing._id;
    }
    return ctx.db.insert("studioRuns", document);
  },
});

export const getRun = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => ctx.db
    .query("studioRuns")
    .withIndex("by_run_id", (queryBuilder) => queryBuilder.eq("runId", runId))
    .unique(),
});
