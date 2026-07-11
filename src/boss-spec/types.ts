export const ATTACK_TYPES = ["sweep", "charge", "nova"] as const;
export type AttackType = (typeof ATTACK_TYPES)[number];

export const VOICE_TRIGGERS = [
  "phase_two_enter",
  "boss_defeated",
  "phase_two_or_defeat",
] as const;
export type VoiceTrigger = (typeof VOICE_TRIGGERS)[number];

export const ARENA_THEMES = [
  "gothic-library",
  "ruined-cathedral",
  "void-sanctum",
] as const;
export type ArenaTheme = (typeof ARENA_THEMES)[number];

export interface BossAttack {
  type: AttackType;
  telegraphMs: number;
  damage: number;
}

export interface BossSpec {
  slug: string;
  title: string;
  boss: {
    name: string;
    title: string;
    palette: [string, string, string];
    maxHp: number;
    phaseTwoAt: number;
    phase2Multiplier: number;
    lines: {
      intro: string;
      phaseTwo: string;
      defeat: string;
    };
  };
  attacks: [BossAttack, BossAttack, BossAttack];
  voice: {
    trigger: VoiceTrigger;
    text: string;
    url: string;
  };
  arena: {
    theme: ArenaTheme;
    fog: string;
  };
}
