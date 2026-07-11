import { DEFAULT_GAME_RECIPE } from "./defaultGameRecipe";
import type { EncounterArchetype, GameRecipeV0 } from "./types";

const PROCESSION_RECIPE = {
  ...structuredClone(DEFAULT_GAME_RECIPE),
  runId: "demo-absolute-procession",
  source: {
    text: "The deadline advances. There is no turning back.",
    normalizedIntent: "An unstoppable command closes the available space.",
  },
  selection: {
    reason: "Command language maps to sustained forward pressure.",
    reused: false,
  },
  archetype: "procession",
  arena: { rule: "closing_ring", theme: "ruined-cathedral" },
  combat: {
    phaseOneOrder: ["sweep", "charge", "nova"],
    phaseTwoOrder: ["charge", "charge", "sweep", "nova"],
    phaseTwoRule: "charge_chain",
  },
  presentation: {
    motif: "a closing ring of extinguished vows",
    cameraMood: "watchful",
  },
} satisfies GameRecipeV0;

const REVELATION_RECIPE = {
  ...structuredClone(DEFAULT_GAME_RECIPE),
  runId: "demo-outer-revelation",
  source: {
    text: "The truth was outside the circle all along.",
    normalizedIntent: "A revelation reverses the meaning of safety.",
  },
  selection: {
    reason: "A reversal maps to a phase-two nova safety inversion.",
    reused: false,
  },
  archetype: "revelation",
  arena: { rule: "inner_sanctuary", theme: "void-sanctum" },
  combat: {
    phaseOneOrder: ["sweep", "charge", "nova"],
    phaseTwoOrder: ["nova", "sweep", "charge"],
    phaseTwoRule: "outer_safe_nova",
  },
  presentation: {
    motif: "an ivory boundary that condemns its own center",
    cameraMood: "ceremonial",
  },
} satisfies GameRecipeV0;

export const DEMO_GAME_RECIPES: Readonly<Record<EncounterArchetype, GameRecipeV0>> = {
  duel: DEFAULT_GAME_RECIPE,
  procession: PROCESSION_RECIPE,
  revelation: REVELATION_RECIPE,
};
