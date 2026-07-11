import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_RECIPE } from "./defaultGameRecipe";
import { GameRecipeValidationError, normalizeGameRecipe } from "./normalize";
import type { GameRecipeV0 } from "./types";

function recipeWith(overrides: Partial<GameRecipeV0>): GameRecipeV0 {
  return {
    ...structuredClone(DEFAULT_GAME_RECIPE),
    ...overrides,
  };
}

describe("GameRecipeV0", () => {
  it("accepts the default Duel recipe", () => {
    expect(normalizeGameRecipe(DEFAULT_GAME_RECIPE)).toEqual(DEFAULT_GAME_RECIPE);
  });

  it("requires a reason when an archetype is reused", () => {
    const invalid = recipeWith({ selection: { reason: "Low novelty.", reused: true } });
    expect(() => normalizeGameRecipe(invalid)).toThrow(GameRecipeValidationError);
  });

  it("rejects a package whose rules do not match its archetype", () => {
    const invalid = recipeWith({
      archetype: "procession",
      arena: { rule: "open_ring", theme: "gothic-library" },
      combat: {
        phaseOneOrder: ["sweep", "charge", "nova"],
        phaseTwoOrder: ["charge", "charge", "nova"],
        phaseTwoRule: "charge_chain",
      },
    });
    expect(() => normalizeGameRecipe(invalid)).toThrow("Procession requires closing_ring");
  });

  it("requires Procession to contain a real charge chain", () => {
    const invalid = recipeWith({
      archetype: "procession",
      arena: { rule: "closing_ring", theme: "gothic-library" },
      combat: {
        phaseOneOrder: ["sweep", "charge", "nova"],
        phaseTwoOrder: ["charge", "sweep", "nova"],
        phaseTwoRule: "charge_chain",
      },
    });
    expect(() => normalizeGameRecipe(invalid)).toThrow("adjacent phase-two charges");
  });

  it("requires Revelation phase two to open with nova", () => {
    const invalid = recipeWith({
      archetype: "revelation",
      arena: { rule: "inner_sanctuary", theme: "void-sanctum" },
      combat: {
        phaseOneOrder: ["sweep", "charge", "nova"],
        phaseTwoOrder: ["sweep", "nova", "charge"],
        phaseTwoRule: "outer_safe_nova",
      },
    });
    expect(() => normalizeGameRecipe(invalid)).toThrow("phase-two nova opener");
  });
});
