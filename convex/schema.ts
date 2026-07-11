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
    })),
    mirroredAt: v.number(),
  }).index("by_run_id", ["runId"]),
});
