import { DEFAULT_BOSS_SPEC } from "../boss-spec/defaultBossSpec";
import type { GameRecipeV0 } from "./types";

export const DEFAULT_GAME_RECIPE = {
  version: 1,
  runId: "default-i-smell-fear",
  source: {
    text: "I smell fear.",
    normalizedIntent: "A direct challenge that turns fear into a duel.",
  },
  selection: {
    reason: "The source is a direct confrontation between one challenger and one oracle.",
    reused: false,
  },
  archetype: "duel",
  arena: {
    rule: "open_ring",
    theme: "gothic-library",
  },
  combat: {
    phaseOneOrder: ["sweep", "charge", "nova"],
    phaseTwoOrder: ["sweep", "charge", "nova"],
    phaseTwoRule: "haste",
  },
  boss: DEFAULT_BOSS_SPEC,
  presentation: {
    motif: "sealed mouths beneath an orange halo",
    cameraMood: "oppressive",
  },
} satisfies GameRecipeV0;
