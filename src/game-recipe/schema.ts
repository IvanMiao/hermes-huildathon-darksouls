import { bossSpecSchema } from "../boss-spec/schema";
import { ARENA_THEMES, ATTACK_TYPES } from "../boss-spec/types";
import {
  ARENA_RULES,
  CAMERA_MOODS,
  ENCOUNTER_ARCHETYPES,
  PHASE_TWO_RULES,
} from "./types";

const nonEmptyText = { type: "string", minLength: 1, maxLength: 240 } as const;
const attackOrder = {
  type: "array",
  minItems: 1,
  maxItems: 8,
  items: { enum: ATTACK_TYPES },
} as const;

export const gameRecipeV0Schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "soulloom/GameRecipeV0/1",
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "runId",
    "source",
    "selection",
    "archetype",
    "arena",
    "combat",
    "boss",
    "presentation",
  ],
  properties: {
    version: { const: 1 },
    runId: {
      type: "string",
      minLength: 1,
      maxLength: 80,
      pattern: "^[a-z0-9][a-z0-9-]*$",
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["text", "normalizedIntent"],
      properties: {
        text: { type: "string", minLength: 1, maxLength: 2_000 },
        normalizedIntent: nonEmptyText,
      },
    },
    selection: {
      type: "object",
      additionalProperties: false,
      required: ["reason", "reused"],
      properties: {
        reason: nonEmptyText,
        reused: { type: "boolean" },
        reuseReason: nonEmptyText,
      },
      allOf: [{
        if: { properties: { reused: { const: true } }, required: ["reused"] },
        then: {
          properties: { reuseReason: nonEmptyText },
          required: ["reuseReason"],
        },
      }],
    },
    archetype: { enum: ENCOUNTER_ARCHETYPES },
    arena: {
      type: "object",
      additionalProperties: false,
      required: ["rule", "theme"],
      properties: {
        rule: { enum: ARENA_RULES },
        theme: { enum: ARENA_THEMES },
      },
    },
    combat: {
      type: "object",
      additionalProperties: false,
      required: ["phaseOneOrder", "phaseTwoOrder", "phaseTwoRule"],
      properties: {
        phaseOneOrder: attackOrder,
        phaseTwoOrder: attackOrder,
        phaseTwoRule: { enum: PHASE_TWO_RULES },
      },
    },
    boss: bossSpecSchema,
    presentation: {
      type: "object",
      additionalProperties: false,
      required: ["motif", "cameraMood", "music"],
      properties: {
        motif: nonEmptyText,
        cameraMood: { enum: CAMERA_MOODS },
        music: {
          type: "object",
          additionalProperties: false,
          required: ["url", "durationMs", "sections"],
          properties: {
            url: { type: "string", minLength: 1, maxLength: 2_000 },
            durationMs: { type: "integer", minimum: 3_000, maximum: 600_000 },
            sections: {
              type: "object",
              additionalProperties: false,
              required: [
                "phaseOneLoopStartMs",
                "phaseTwoStartMs",
                "phaseTwoLoopStartMs",
                "aftermathStartMs",
              ],
              properties: {
                phaseOneLoopStartMs: { type: "integer", minimum: 0, maximum: 600_000 },
                phaseTwoStartMs: { type: "integer", minimum: 0, maximum: 600_000 },
                phaseTwoLoopStartMs: { type: "integer", minimum: 0, maximum: 600_000 },
                aftermathStartMs: { type: "integer", minimum: 0, maximum: 600_000 },
              },
            },
          },
        },
      },
    },
  },
} as const;
