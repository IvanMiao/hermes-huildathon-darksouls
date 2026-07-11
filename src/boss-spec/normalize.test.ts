import { describe, expect, it } from "vitest";
import { DEFAULT_BOSS_SPEC } from "./defaultBossSpec";
import {
  BossSpecValidationError,
  isBossSpec,
  normalizeBossSpec,
} from "./normalize";
import { BOSS_SPEC_BOUNDS } from "./schema";

function copyDefault(): Record<string, any> {
  return structuredClone(DEFAULT_BOSS_SPEC);
}

describe("BossSpec validation and normalization", () => {
  it("accepts the canonical default spec", () => {
    const normalized = normalizeBossSpec(DEFAULT_BOSS_SPEC);

    expect(normalized).toEqual(DEFAULT_BOSS_SPEC);
    expect(isBossSpec(normalized)).toBe(true);
  });

  it("rejects an illegal attack type", () => {
    const input = copyDefault();
    input.attacks[0].type = "laser";

    expect(() => normalizeBossSpec(input)).toThrow(BossSpecValidationError);
  });

  it.each([
    ["missing", (input: Record<string, any>) => input.attacks.pop()],
    [
      "duplicate",
      (input: Record<string, any>) => {
        input.attacks[2] = { ...input.attacks[0] };
      },
    ],
  ])("rejects a %s attack set", (_caseName, mutate) => {
    const input = copyDefault();
    mutate(input);

    expect(() => normalizeBossSpec(input)).toThrow(BossSpecValidationError);
  });

  it("clamps all balance numbers to their safe bounds", () => {
    const input = copyDefault();
    input.boss.maxHp = 10;
    input.boss.phase2Multiplier = 9;
    input.attacks[0].telegraphMs = 1;
    input.attacks[0].damage = 999;
    input.attacks[1].telegraphMs = 9_999;
    input.attacks[1].damage = -10;

    const normalized = normalizeBossSpec(input);

    expect(normalized.boss.maxHp).toBe(BOSS_SPEC_BOUNDS.maxHp.min);
    expect(normalized.boss.phase2Multiplier).toBe(
      BOSS_SPEC_BOUNDS.phase2Multiplier.max,
    );
    expect(normalized.attacks[0]).toMatchObject({
      telegraphMs: BOSS_SPEC_BOUNDS.telegraphMs.min,
      damage: BOSS_SPEC_BOUNDS.damage.max,
    });
    expect(normalized.attacks[1]).toMatchObject({
      telegraphMs: BOSS_SPEC_BOUNDS.telegraphMs.max,
      damage: BOSS_SPEC_BOUNDS.damage.min,
    });
    expect(isBossSpec(normalized)).toBe(true);
  });

  it.each([
    ["palette", (input: Record<string, any>) => (input.boss.palette[1] = "orange")],
    ["phase threshold", (input: Record<string, any>) => (input.boss.phaseTwoAt = 0.1)],
  ])("rejects an invalid %s", (_caseName, mutate) => {
    const input = copyDefault();
    mutate(input);

    expect(() => normalizeBossSpec(input)).toThrow(BossSpecValidationError);
  });
});
