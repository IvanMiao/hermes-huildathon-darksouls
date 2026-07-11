import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_RECIPE } from "../game-recipe/defaultGameRecipe";
import type { GameRecipeV0 } from "../game-recipe/types";
import { runReleaseGate } from "./releaseGate";

function processionRecipe(): GameRecipeV0 {
  return {
    ...structuredClone(DEFAULT_GAME_RECIPE),
    runId: "gate-procession",
    archetype: "procession",
    arena: { rule: "closing_ring", theme: "ruined-cathedral" },
    combat: {
      phaseOneOrder: ["sweep", "charge", "nova"],
      phaseTwoOrder: ["charge", "charge", "sweep", "nova"],
      phaseTwoRule: "charge_chain",
    },
  };
}

function revelationRecipe(): GameRecipeV0 {
  return {
    ...structuredClone(DEFAULT_GAME_RECIPE),
    runId: "gate-revelation",
    archetype: "revelation",
    arena: { rule: "inner_sanctuary", theme: "void-sanctum" },
    combat: {
      phaseOneOrder: ["sweep", "charge", "nova"],
      phaseTwoOrder: ["nova", "sweep", "charge"],
      phaseTwoRule: "outer_safe_nova",
    },
  };
}

describe("deterministic release gate", () => {
  it("passes every required path for the default encounter", () => {
    const report = runReleaseGate(DEFAULT_GAME_RECIPE, 2026);

    if (!report.passed) {
      const failures = report.checks
        .filter(({ passed }) => !passed)
        .map(({ artifact, owner, message }) => `${artifact} / ${owner}: ${message}`)
        .join("\n");
      throw new Error(`Release blocked:\n${failures}`);
    }
    expect(report.checks).toHaveLength(6);
    expect(report.checks.every(({ passed }) => passed)).toBe(true);
  });

  it("replays the same result for the same seed", () => {
    const first = runReleaseGate(DEFAULT_GAME_RECIPE, 42);
    const second = runReleaseGate(DEFAULT_GAME_RECIPE, 42);

    expect(second).toEqual(first);
  });

  it("routes an illegal artifact back to an explicit owner", () => {
    const invalid = structuredClone(DEFAULT_GAME_RECIPE) as Record<string, any>;
    invalid.combat.phaseTwoRule = "charge_chain";

    const report = runReleaseGate(invalid);
    const schemaCheck = report.checks.find(({ id }) => id === "legal_recipe");

    expect(report.passed).toBe(false);
    expect(schemaCheck).toMatchObject({
      passed: false,
      artifact: "DraftGameRecipe",
      owner: "Studio Manager",
    });
  });

  it.each([
    ["procession", processionRecipe()],
    ["revelation", revelationRecipe()],
  ])("proves the %s package rule through real controller behavior", (_name, recipe) => {
    const report = runReleaseGate(recipe, 17);
    const packageCheck = report.checks.find(({ id }) => id === "package_rule_active");

    expect(report.passed).toBe(true);
    expect(packageCheck).toMatchObject({ passed: true, owner: "Encounter Designer" });
  });
});
