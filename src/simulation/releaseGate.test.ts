import { describe, expect, it } from "vitest";
import { DEFAULT_BOSS_SPEC } from "../boss-spec/defaultBossSpec";
import { runReleaseGate } from "./releaseGate";

describe("deterministic release gate", () => {
  it("passes every required path for the default encounter", () => {
    const report = runReleaseGate(DEFAULT_BOSS_SPEC, 2026);

    if (!report.passed) {
      const failures = report.checks
        .filter(({ passed }) => !passed)
        .map(({ artifact, owner, message }) => `${artifact} / ${owner}: ${message}`)
        .join("\n");
      throw new Error(`Release blocked:\n${failures}`);
    }
    expect(report.checks).toHaveLength(5);
    expect(report.checks.every(({ passed }) => passed)).toBe(true);
  });

  it("replays the same result for the same seed", () => {
    const first = runReleaseGate(DEFAULT_BOSS_SPEC, 42);
    const second = runReleaseGate(DEFAULT_BOSS_SPEC, 42);

    expect(second).toEqual(first);
  });

  it("routes an illegal artifact back to an explicit owner", () => {
    const invalid = structuredClone(DEFAULT_BOSS_SPEC) as Record<string, any>;
    invalid.attacks[2] = { ...invalid.attacks[0] };

    const report = runReleaseGate(invalid);
    const schemaCheck = report.checks.find(({ id }) => id === "legal_spec");

    expect(report.passed).toBe(false);
    expect(schemaCheck).toMatchObject({
      passed: false,
      artifact: "DraftBossSpec",
      owner: "Studio Manager",
    });
  });
});
