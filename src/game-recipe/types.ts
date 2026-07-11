import type { ArenaTheme, AttackType, BossSpec } from "../boss-spec/types";

export const ENCOUNTER_ARCHETYPES = ["duel", "procession", "revelation"] as const;
export type EncounterArchetype = (typeof ENCOUNTER_ARCHETYPES)[number];

export const ARENA_RULES = ["open_ring", "closing_ring", "inner_sanctuary"] as const;
export type ArenaRule = (typeof ARENA_RULES)[number];

export const PHASE_TWO_RULES = ["haste", "charge_chain", "outer_safe_nova"] as const;
export type PhaseTwoRule = (typeof PHASE_TWO_RULES)[number];

export const CAMERA_MOODS = ["watchful", "oppressive", "ceremonial"] as const;
export type CameraMood = (typeof CAMERA_MOODS)[number];

export type AttackOrder = [AttackType, ...AttackType[]];

export interface GameRecipeV0 {
  version: 1;
  runId: string;
  source: {
    text: string;
    normalizedIntent: string;
  };
  selection: {
    reason: string;
    reused: boolean;
    reuseReason?: string;
  };
  archetype: EncounterArchetype;
  arena: {
    rule: ArenaRule;
    theme: ArenaTheme;
  };
  combat: {
    phaseOneOrder: AttackOrder;
    phaseTwoOrder: AttackOrder;
    phaseTwoRule: PhaseTwoRule;
  };
  boss: BossSpec;
  presentation: {
    motif: string;
    cameraMood: CameraMood;
  };
}
