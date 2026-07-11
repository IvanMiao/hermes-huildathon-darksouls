import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { bossSpecInputSchema, bossSpecSchema, BOSS_SPEC_BOUNDS } from "./schema";
import type { BossAttack, BossSpec } from "./types";

const ajv = new Ajv({ allErrors: true, strict: true });
const validateInput = ajv.compile(bossSpecInputSchema) as ValidateFunction<BossSpec>;
const validateCanonical = ajv.compile(bossSpecSchema) as ValidateFunction<BossSpec>;

export class BossSpecValidationError extends Error {
  readonly errors: ErrorObject[];

  constructor(stage: "input" | "normalized", errors: ErrorObject[] | null | undefined) {
    const details = errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");

    super(`BossSpec ${stage} validation failed${details ? `: ${details}` : ""}`);
    this.name = "BossSpecValidationError";
    this.errors = errors ?? [];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeAttack(attack: BossAttack): BossAttack {
  return {
    ...attack,
    telegraphMs: clamp(
      attack.telegraphMs,
      BOSS_SPEC_BOUNDS.telegraphMs.min,
      BOSS_SPEC_BOUNDS.telegraphMs.max,
    ),
    damage: clamp(
      attack.damage,
      BOSS_SPEC_BOUNDS.damage.min,
      BOSS_SPEC_BOUNDS.damage.max,
    ),
  };
}

/**
 * Validates untrusted data, clamps only documented balance fields, then validates
 * the resulting canonical runtime contract. Structural and semantic errors throw.
 */
export function normalizeBossSpec(input: unknown): BossSpec {
  if (!validateInput(input)) {
    throw new BossSpecValidationError("input", validateInput.errors);
  }

  const normalized: BossSpec = {
    ...input,
    boss: {
      ...input.boss,
      palette: [...input.boss.palette],
      maxHp: clamp(
        input.boss.maxHp,
        BOSS_SPEC_BOUNDS.maxHp.min,
        BOSS_SPEC_BOUNDS.maxHp.max,
      ),
      phase2Multiplier: clamp(
        input.boss.phase2Multiplier,
        BOSS_SPEC_BOUNDS.phase2Multiplier.min,
        BOSS_SPEC_BOUNDS.phase2Multiplier.max,
      ),
      lines: { ...input.boss.lines },
    },
    attacks: input.attacks.map(normalizeAttack) as BossSpec["attacks"],
    voice: { ...input.voice },
    arena: { ...input.arena },
  };

  if (!validateCanonical(normalized)) {
    throw new BossSpecValidationError("normalized", validateCanonical.errors);
  }

  return normalized;
}

export function isBossSpec(input: unknown): input is BossSpec {
  return validateCanonical(input);
}
