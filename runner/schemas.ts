import Ajv, { type ValidateFunction } from "ajv";
import { ARENA_THEMES, ATTACK_TYPES } from "../src/boss-spec/types";
import {
  ARENA_RULES,
  CAMERA_MOODS,
  ENCOUNTER_ARCHETYPES,
  PHASE_TWO_RULES,
} from "../src/game-recipe/types";
import {
  ARTIFACT_SCHEMA_VERSION,
  type EncounterSpec,
  type ProductionBrief,
  type QAReport,
  type ThemeSpec,
} from "./contracts";

const hexColor = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } as const;
const nonEmptyText = { type: "string", minLength: 1, maxLength: 240 } as const;
const schemaVersion = { const: ARTIFACT_SCHEMA_VERSION } as const;

const attackSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "telegraphMs", "damage"],
  properties: {
    type: { enum: ATTACK_TYPES },
    telegraphMs: { type: "integer", minimum: 100, maximum: 2_000 },
    damage: { type: "integer", minimum: 1, maximum: 50 },
  },
} as const;

export const productionBriefSchema = {
  $id: "soulloom/ProductionBrief/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "inputText",
    "inputHash",
    "seed",
    "conflict",
    "normalizedIntent",
    "tone",
    "voiceRequested",
  ],
  properties: {
    schemaVersion,
    inputText: { type: "string", minLength: 1, maxLength: 2_000 },
    inputHash: { type: "string", pattern: "^[0-9a-f]{12}$" },
    seed: { type: "integer", minimum: 0, maximum: 4_294_967_295 },
    conflict: nonEmptyText,
    normalizedIntent: nonEmptyText,
    tone: { enum: ["gothic", "ritual", "void"] },
    voiceRequested: { type: "boolean" },
  },
} as const;

export const themeSpecSchema = {
  $id: "soulloom/ThemeSpec/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "normalizedIntent",
    "slug",
    "title",
    "boss",
    "arena",
    "lore",
    "motif",
    "cameraMood",
    "summary",
  ],
  properties: {
    schemaVersion,
    normalizedIntent: nonEmptyText,
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
      required: ["name", "title", "palette", "lines"],
      properties: {
        name: { type: "string", minLength: 1, maxLength: 60 },
        title: { type: "string", minLength: 1, maxLength: 100 },
        palette: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          uniqueItems: true,
          items: hexColor,
        },
        lines: {
          type: "object",
          additionalProperties: false,
          required: ["intro", "phaseTwo", "defeat"],
          properties: {
            intro: nonEmptyText,
            phaseTwo: nonEmptyText,
            defeat: nonEmptyText,
          },
        },
      },
    },
    arena: {
      type: "object",
      additionalProperties: false,
      required: ["theme", "fog"],
      properties: {
        theme: { enum: ARENA_THEMES },
        fog: hexColor,
      },
    },
    lore: { type: "string", minLength: 1, maxLength: 500 },
    motif: nonEmptyText,
    cameraMood: { enum: CAMERA_MOODS },
    summary: nonEmptyText,
  },
} as const;

export const encounterSpecSchema = {
  $id: "soulloom/EncounterSpec/1.0",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "archetype",
    "selection",
    "arenaRule",
    "phaseOneOrder",
    "phaseTwoOrder",
    "phaseTwoRule",
    "maxHp",
    "phaseTwoAt",
    "phase2Multiplier",
    "attacks",
    "difficulty",
    "designIntent",
    "summary",
  ],
  properties: {
    schemaVersion,
    archetype: { enum: ENCOUNTER_ARCHETYPES },
    selection: {
      type: "object",
      additionalProperties: false,
      required: ["reason", "reused"],
      properties: {
        reason: nonEmptyText,
        reused: { type: "boolean" },
        reuseReason: nonEmptyText,
      },
    },
    arenaRule: { enum: ARENA_RULES },
    phaseOneOrder: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { enum: ATTACK_TYPES },
    },
    phaseTwoOrder: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { enum: ATTACK_TYPES },
    },
    phaseTwoRule: { enum: PHASE_TWO_RULES },
    maxHp: { type: "integer", minimum: 300, maximum: 2_000 },
    phaseTwoAt: { type: "number", minimum: 0.25, maximum: 0.75 },
    phase2Multiplier: { type: "number", minimum: 1, maximum: 2 },
    attacks: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      allOf: ATTACK_TYPES.map((type) => ({
        contains: { type: "object", required: ["type"], properties: { type: { const: type } } },
      })),
      items: attackSchema,
    },
    difficulty: { enum: ["measured", "aggressive"] },
    designIntent: { type: "string", minLength: 1, maxLength: 500 },
    summary: nonEmptyText,
  },
} as const;

export const qaReportSchema = {
  $id: "soulloom/QAReport/1.0",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "passed", "regression", "seed", "checks", "ownersToRetry"],
  properties: {
    schemaVersion,
    passed: { type: "boolean" },
    regression: { type: "boolean" },
    seed: { type: "integer", minimum: 0, maximum: 4_294_967_295 },
    checks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "passed", "artifact", "owner", "message"],
        properties: {
          id: {
            enum: [
              "legal_recipe",
              "phase_two_reachable",
              "boss_defeatable",
              "death_restart",
              "voice_trigger_reachable",
              "package_rule_active",
            ],
          },
          passed: { type: "boolean" },
          artifact: {
            enum: ["DraftGameRecipe", "ThemeSpec", "EncounterSpec", "VoiceArtifact"],
          },
          owner: {
            enum: [
              "Studio Manager",
              "Creative Director",
              "Encounter Designer",
              "Audio Producer",
            ],
          },
          message: nonEmptyText,
        },
      },
    },
    ownersToRetry: {
      type: "array",
      uniqueItems: true,
      items: {
        enum: [
          "Studio Manager",
          "Creative Director",
          "Encounter Designer",
          "Audio Producer",
        ],
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: true });

const validators = {
  ProductionBrief: ajv.compile(productionBriefSchema) as ValidateFunction<ProductionBrief>,
  ThemeSpec: ajv.compile(themeSpecSchema) as ValidateFunction<ThemeSpec>,
  EncounterSpec: ajv.compile(encounterSpecSchema) as ValidateFunction<EncounterSpec>,
  QAReport: ajv.compile(qaReportSchema) as ValidateFunction<QAReport>,
};

export type ValidatedArtifactKind = keyof typeof validators;

export function assertArtifactData(
  kind: ValidatedArtifactKind,
  data: unknown,
): void {
  const validator = validators[kind];
  if (validator(data)) {
    return;
  }

  const details = validator.errors
    ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
  throw new Error(`${kind} schema validation failed${details ? `: ${details}` : ""}`);
}
