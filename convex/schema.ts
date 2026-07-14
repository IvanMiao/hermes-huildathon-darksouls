import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  studioRuns: defineTable({
    runId: v.string(),
    status: v.union(v.literal("published"), v.literal("release_blocked")),
    inputText: v.string(),
    recipe: v.any(),
    events: v.any(),
    artifacts: v.any(),
    qaReport: v.any(),
    voice: v.optional(v.object({
      storageId: v.id("_storage"),
      url: v.string(),
      text: v.string(),
      source: v.literal("elevenlabs_generated"),
      model: v.optional(v.literal("eleven_multilingual_v2")),
      requestId: v.optional(v.string()),
      traceId: v.optional(v.string()),
      characterCost: v.optional(v.number()),
    })),
    music: v.optional(v.object({
      storageId: v.id("_storage"),
      url: v.string(),
      durationMs: v.number(),
      model: v.literal("music_v2"),
      source: v.literal("elevenlabs_generated"),
      songId: v.optional(v.string()),
      requestId: v.optional(v.string()),
      traceId: v.optional(v.string()),
      compositionPlan: v.any(),
      direction: v.optional(v.any()),
    })),
    mirroredAt: v.number(),
  }).index("by_run_id", ["runId"]),
});
