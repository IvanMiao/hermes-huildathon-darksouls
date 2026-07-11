import type { BossSpec } from "./types";

export const FABLE_PHASE_TWO_VOICE_URL = "https://cheery-goat-595.eu-west-1.convex.cloud/api/storage/476b52d1-3547-492a-bc0a-e91221fedd78";

export const DEFAULT_BOSS_SPEC = {
  slug: "i-smell-fear",
  title: "I SMELL FEAR",
  boss: {
    name: "FABLE",
    title: "ORACLE OF THE LAST ASSENT",
    palette: ["#17131f", "#d97745", "#ede1cf"],
    maxHp: 900,
    phaseTwoAt: 0.5,
    phase2Multiplier: 1.25,
    lines: {
      intro: "I smell fear.",
      phaseTwo: "You are absolutely right!",
      defeat: "Then let agreement end with me.",
    },
  },
  attacks: [
    { type: "sweep", telegraphMs: 700, damage: 18 },
    { type: "charge", telegraphMs: 900, damage: 25 },
    { type: "nova", telegraphMs: 1_300, damage: 32 },
  ],
  voice: {
    trigger: "phase_two_or_defeat",
    text: "You are absolutely right!",
    url: FABLE_PHASE_TWO_VOICE_URL,
  },
  arena: {
    theme: "gothic-library",
    fog: "#4a241c",
  },
} satisfies BossSpec;
