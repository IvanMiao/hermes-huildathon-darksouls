import { ARENA_THEMES, ATTACK_TYPES, VOICE_TRIGGERS } from "./types";

export const BOSS_SPEC_BOUNDS = {
  maxHp: { min: 300, max: 2_000 },
  phaseTwoAt: { min: 0.25, max: 0.75 },
  phase2Multiplier: { min: 1, max: 2 },
  telegraphMs: { min: 600, max: 2_000 },
  damage: { min: 1, max: 50 },
} as const;

const hexColorSchema = {
  type: "string",
  pattern: "^#[0-9a-fA-F]{6}$",
} as const;

const lineSchema = {
  type: "string",
  minLength: 1,
  maxLength: 160,
} as const;

function numericSchema(
  type: "integer" | "number",
  bounds: { min: number; max: number },
  enforceBounds: boolean,
) {
  return enforceBounds
    ? { type, minimum: bounds.min, maximum: bounds.max }
    : { type };
}

function createBossSpecSchema(enforceBalanceBounds: boolean) {
  const attackTypeRequirements = ATTACK_TYPES.map((attackType) => ({
    contains: {
      type: "object",
      required: ["type"],
      properties: { type: { const: attackType } },
    },
  }));

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    additionalProperties: false,
    required: ["slug", "title", "boss", "attacks", "voice", "arena"],
    properties: {
      slug: {
        type: "string",
        minLength: 1,
        maxLength: 64,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      },
      title: { type: "string", minLength: 1, maxLength: 100 },
      boss: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "title",
          "palette",
          "maxHp",
          "phaseTwoAt",
          "phase2Multiplier",
          "lines",
        ],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 60 },
          title: { type: "string", minLength: 1, maxLength: 100 },
          palette: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            uniqueItems: true,
            items: hexColorSchema,
          },
          maxHp: numericSchema(
            "integer",
            BOSS_SPEC_BOUNDS.maxHp,
            enforceBalanceBounds,
          ),
          phaseTwoAt: {
            type: "number",
            minimum: BOSS_SPEC_BOUNDS.phaseTwoAt.min,
            maximum: BOSS_SPEC_BOUNDS.phaseTwoAt.max,
          },
          phase2Multiplier: numericSchema(
            "number",
            BOSS_SPEC_BOUNDS.phase2Multiplier,
            enforceBalanceBounds,
          ),
          lines: {
            type: "object",
            additionalProperties: false,
            required: ["intro", "phaseTwo", "defeat"],
            properties: {
              intro: lineSchema,
              phaseTwo: lineSchema,
              defeat: lineSchema,
            },
          },
        },
      },
      attacks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        allOf: attackTypeRequirements,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "telegraphMs", "damage"],
          properties: {
            type: { type: "string", enum: ATTACK_TYPES },
            telegraphMs: numericSchema(
              "integer",
              BOSS_SPEC_BOUNDS.telegraphMs,
              enforceBalanceBounds,
            ),
            damage: numericSchema(
              "integer",
              BOSS_SPEC_BOUNDS.damage,
              enforceBalanceBounds,
            ),
          },
        },
      },
      voice: {
        type: "object",
        additionalProperties: false,
        required: ["trigger", "text", "url"],
        properties: {
          trigger: { type: "string", enum: VOICE_TRIGGERS },
          text: lineSchema,
          url: {
            type: "string",
            minLength: 1,
            maxLength: 2_048,
            pattern: "^(?:/|https://)",
          },
        },
      },
      arena: {
        type: "object",
        additionalProperties: false,
        required: ["theme", "fog"],
        properties: {
          theme: { type: "string", enum: ARENA_THEMES },
          fog: hexColorSchema,
        },
      },
    },
  };
}

// The input schema rejects unsafe structure and semantics while deliberately
// allowing balance numbers outside the safe envelope so normalization can clamp them.
export const bossSpecInputSchema = createBossSpecSchema(false);

// The canonical runtime contract requires every balance number to be in range.
export const bossSpecSchema = createBossSpecSchema(true);
