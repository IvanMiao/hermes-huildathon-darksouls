export type GeneratedArenaVisual = "astral_ruins" | "obsidian_garden";
export type GeneratedPlayerVisual = "starforged_witness" | "thorn_wanderer";
export type GeneratedBossVisual = "orrery_beast" | "iron_seraph";

export type BattleVisualProfile =
  | { family: "fable" }
  | {
      family: "generated";
      arena: GeneratedArenaVisual;
      player: GeneratedPlayerVisual;
      boss: GeneratedBossVisual;
    };

interface VisualRecipeIdentity {
  runId: string;
  boss: { boss: { name: string } };
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function choose<T>(values: readonly T[], seed: number, shift: number): T {
  const choice = values[(seed >>> shift) % values.length];
  if (choice === undefined) throw new Error("Visual choice list cannot be empty.");
  return choice;
}

export function resolveBattleVisualProfile(
  recipe: VisualRecipeIdentity,
): BattleVisualProfile {
  if (recipe.boss.boss.name.trim().toUpperCase() === "FABLE") {
    return { family: "fable" };
  }

  const seed = stableHash(recipe.runId);
  return {
    family: "generated",
    arena: choose(["astral_ruins", "obsidian_garden"], seed, 0),
    player: choose(["starforged_witness", "thorn_wanderer"], seed, 8),
    boss: choose(["orrery_beast", "iron_seraph"], seed, 16),
  };
}
