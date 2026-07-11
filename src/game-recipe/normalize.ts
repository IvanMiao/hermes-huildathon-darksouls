import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { gameRecipeV0Schema } from "./schema";
import type { AttackOrder, GameRecipeV0 } from "./types";

const ajv = new Ajv({ allErrors: true, strict: true });
const validateRecipe = ajv.compile(gameRecipeV0Schema) as ValidateFunction<GameRecipeV0>;

export class GameRecipeValidationError extends Error {
  constructor(
    message: string,
    readonly errors: ErrorObject[] = [],
  ) {
    super(message);
    this.name = "GameRecipeValidationError";
  }
}

function hasAdjacentCharge(order: AttackOrder): boolean {
  return order.some((attack, index) => attack === "charge" && order[index + 1] === "charge");
}

function assertPackageSemantics(recipe: GameRecipeV0): void {
  if (recipe.archetype === "duel") {
    if (recipe.arena.rule !== "open_ring" || recipe.combat.phaseTwoRule !== "haste") {
      throw new GameRecipeValidationError(
        "Duel requires arena.rule 'open_ring' and phaseTwoRule 'haste'.",
      );
    }
    return;
  }

  if (recipe.archetype === "procession") {
    if (
      recipe.arena.rule !== "closing_ring"
      || recipe.combat.phaseTwoRule !== "charge_chain"
      || !hasAdjacentCharge(recipe.combat.phaseTwoOrder)
    ) {
      throw new GameRecipeValidationError(
        "Procession requires closing_ring, charge_chain, and adjacent phase-two charges.",
      );
    }
    return;
  }

  if (
    recipe.arena.rule !== "inner_sanctuary"
    || recipe.combat.phaseTwoRule !== "outer_safe_nova"
    || recipe.combat.phaseTwoOrder[0] !== "nova"
  ) {
    throw new GameRecipeValidationError(
      "Revelation requires inner_sanctuary, outer_safe_nova, and a phase-two nova opener.",
    );
  }
}

export function normalizeGameRecipe(input: unknown): GameRecipeV0 {
  if (!validateRecipe(input)) {
    const details = validateRecipe.errors
      ?.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
      .join("; ");
    throw new GameRecipeValidationError(
      `GameRecipeV0 schema validation failed${details ? `: ${details}` : ""}`,
      validateRecipe.errors ?? [],
    );
  }
  assertPackageSemantics(input);
  return structuredClone(input);
}

export function isGameRecipeV0(input: unknown): input is GameRecipeV0 {
  if (!validateRecipe(input)) {
    return false;
  }
  try {
    assertPackageSemantics(input);
    return true;
  } catch {
    return false;
  }
}
