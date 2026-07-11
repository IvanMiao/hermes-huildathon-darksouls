import { createHash } from "node:crypto";
import { DEFAULT_BOSS_SPEC } from "../src/boss-spec/defaultBossSpec";
import type { BossSpec } from "../src/boss-spec/types";
import {
  ARTIFACT_SCHEMA_VERSION,
  type EncounterSpec,
  type ProductionBrief,
  type ThemeSpec,
} from "./contracts";

export interface SpecialistAdapter<T> {
  readonly agentRuntime: "local_fixture" | "hermes_specialist";
  generate(brief: ProductionBrief): Promise<T>;
  repair(
    brief: ProductionBrief,
    previous: T,
    feedback: readonly string[],
  ): Promise<T>;
  fallback(brief: ProductionBrief): T;
}

export interface StudioAdapters {
  creative: SpecialistAdapter<ThemeSpec>;
  encounter: SpecialistAdapter<EncounterSpec>;
}

function hashInput(inputText: string): string {
  return createHash("sha256").update(inputText).digest("hex").slice(0, 12);
}

export function createProductionBrief(inputText: string): ProductionBrief {
  const cleanInput = inputText.trim();
  if (!cleanInput) {
    throw new Error("An internet moment is required.");
  }

  const inputHash = hashInput(cleanInput);
  const seed = Number.parseInt(inputHash.slice(0, 8), 16) >>> 0;
  const tones = ["gothic", "ritual", "void"] as const;

  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    inputText: cleanInput,
    inputHash,
    seed,
    conflict: `Turn '${cleanInput.slice(0, 120)}' into a readable duel about fear and certainty.`,
    normalizedIntent: /(?:must|deadline|before anyone can react|no turning back)/i.test(cleanInput)
      ? "An unstoppable command closes the available space."
      : /(?:truth|reveal|paradox|admit|absolutely right)/i.test(cleanInput)
        ? "A revelation reverses the meaning of safety."
        : "A direct challenge becomes a readable duel.",
    tone: tones[seed % tones.length] ?? "gothic",
    voiceRequested: !/\b(?:silent|silence|mute)\b/i.test(cleanInput),
  };
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "untitled-omen";
}

function generatedTheme(brief: ProductionBrief): ThemeSpec {
  if (/i smell fear/i.test(brief.inputText)) {
    return {
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      normalizedIntent: brief.normalizedIntent,
      slug: "i-smell-fear",
      title: "I SMELL FEAR",
      boss: {
        name: "FABLE",
        title: "ORACLE OF THE LAST ASSENT",
        palette: ["#17131f", "#d97745", "#ede1cf"],
        lines: {
          intro: "Your fear arrived before you did.",
          phaseTwo: "You are absolutely right!",
          defeat: "Then let agreement end with me.",
        },
      },
      arena: { theme: "gothic-library", fog: "#4a241c" },
      lore: "An oracle binds every doubt into scripture and calls obedience peace.",
      motif: "sealed mouths beneath an orange halo",
      cameraMood: "oppressive",
      summary: "A polite oracle weaponizes certainty inside a ruined library.",
    };
  }

  const variants = {
    gothic: {
      name: "VESPER",
      title: "KEEPER OF THE UNANSWERED BELL",
      palette: ["#14131b", "#9e4c3f", "#ded4c4"] as [string, string, string],
      theme: "ruined-cathedral" as const,
      fog: "#351c24",
      motifs: ["broken bells", "wax seals", "ash scripture"] as [string, string, string],
    },
    ritual: {
      name: "CANTOR",
      title: "WITNESS OF THE FINAL VOW",
      palette: ["#161018", "#c36c3d", "#e5d7bd"] as [string, string, string],
      theme: "gothic-library" as const,
      fog: "#452019",
      motifs: ["knotted vows", "ember censers", "hollow choir"] as [string, string, string],
    },
    void: {
      name: "NULL",
      title: "SAINT OF THE LAST ECHO",
      palette: ["#0e1019", "#6f4a8e", "#d8d4e4"] as [string, string, string],
      theme: "void-sanctum" as const,
      fog: "#171326",
      motifs: ["empty halos", "black mirrors", "vanished names"] as [string, string, string],
    },
  };
  const variant = variants[brief.tone];
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    normalizedIntent: brief.normalizedIntent,
    slug: `${slugify(brief.inputText)}-${brief.inputHash.slice(0, 4)}`,
    title: brief.inputText.slice(0, 80).toUpperCase(),
    boss: {
      name: variant.name,
      title: variant.title,
      palette: variant.palette,
      lines: {
        intro: "Every word leaves a wound.",
        phaseTwo: "Now hear what certainty costs.",
        defeat: "The echo outlived its saint.",
      },
    },
    arena: { theme: variant.theme, fog: variant.fog },
    lore: `The ${variant.name.toLowerCase()} made a sacrament from one passing internet moment.`,
    motif: variant.motifs.join(", "),
    cameraMood: brief.tone === "ritual" ? "ceremonial" : "watchful",
    summary: `${variant.name} turns the source text into a ${brief.tone} trial.`,
  };
}

function generatedEncounter(brief: ProductionBrief): EncounterSpec {
  const unsafeProcession = /(?:before anyone can react|instant|no warning)/i.test(
    brief.inputText,
  );
  const archetype = /(?:must|deadline|before anyone can react|no turning back)/i.test(
    brief.inputText,
  )
    ? "procession"
    : /(?:truth|reveal|paradox|admit|absolutely right)/i.test(brief.inputText)
      ? "revelation"
      : "duel";
  const aggressive = brief.seed % 2 === 0;
  const lowNovelty = brief.inputText.trim().split(/\s+/).length < 3;
  const packageRules = archetype === "procession"
    ? {
        arenaRule: "closing_ring" as const,
        phaseOneOrder: ["sweep", "charge", "nova"] as EncounterSpec["phaseOneOrder"],
        phaseTwoOrder: (unsafeProcession
          ? ["charge", "sweep", "nova"]
          : ["charge", "charge", "sweep", "nova"]) as EncounterSpec["phaseTwoOrder"],
        phaseTwoRule: "charge_chain" as const,
      }
    : archetype === "revelation"
      ? {
          arenaRule: "inner_sanctuary" as const,
          phaseOneOrder: ["sweep", "charge", "nova"] as EncounterSpec["phaseOneOrder"],
          phaseTwoOrder: ["nova", "sweep", "charge"] as EncounterSpec["phaseTwoOrder"],
          phaseTwoRule: "outer_safe_nova" as const,
        }
      : {
          arenaRule: "open_ring" as const,
          phaseOneOrder: ["sweep", "charge", "nova"] as EncounterSpec["phaseOneOrder"],
          phaseTwoOrder: ["sweep", "charge", "nova"] as EncounterSpec["phaseTwoOrder"],
          phaseTwoRule: "haste" as const,
        };
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    archetype,
    selection: {
      reason: `${brief.normalizedIntent} Selected the ${archetype} encounter grammar.`,
      reused: lowNovelty,
      ...(lowNovelty
        ? { reuseReason: "Source input has low mechanical novelty." }
        : {}),
    },
    ...packageRules,
    maxHp: aggressive ? 840 : 900,
    phaseTwoAt: 0.5,
    phase2Multiplier: aggressive ? 1.32 : 1.22,
    attacks: [
      { type: "sweep", telegraphMs: aggressive ? 650 : 720, damage: 18 },
      { type: "charge", telegraphMs: aggressive ? 780 : 900, damage: 24 },
      {
        type: "nova",
        telegraphMs: aggressive ? 1_000 : 1_200,
        damage: 30,
      },
    ],
    difficulty: aggressive ? "aggressive" : "measured",
    designIntent: "Teach sweep, test spacing with charge, then demand a decisive nova dodge.",
    summary: unsafeProcession
      ? "Procession draft lacks the required charge chain and must be rejected."
      : `${archetype} changes attack order and spatial rules within the fixed combat grammar.`,
  };
}

function fallbackTheme(brief: ProductionBrief): ThemeSpec {
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    normalizedIntent: brief.normalizedIntent,
    slug: `${slugify(brief.inputText)}-fallback`,
    title: brief.inputText.slice(0, 80).toUpperCase(),
    boss: {
      name: DEFAULT_BOSS_SPEC.boss.name,
      title: DEFAULT_BOSS_SPEC.boss.title,
      palette: [...DEFAULT_BOSS_SPEC.boss.palette],
      lines: { ...DEFAULT_BOSS_SPEC.boss.lines },
    },
    arena: { ...DEFAULT_BOSS_SPEC.arena },
    lore: "A cached house encounter carries the moment when live direction is unavailable.",
    motif: "ivory scripture, orange halo, sealed gate",
    cameraMood: "oppressive",
    summary: "Default Soulloom creative direction (fallback).",
  };
}

function fallbackEncounter(): EncounterSpec {
  return {
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    archetype: "duel",
    selection: {
      reason: "The verified house Duel is the safe fallback encounter.",
      reused: true,
      reuseReason: "Live encounter generation was unavailable or invalid.",
    },
    arenaRule: "open_ring",
    phaseOneOrder: ["sweep", "charge", "nova"],
    phaseTwoOrder: ["sweep", "charge", "nova"],
    phaseTwoRule: "haste",
    maxHp: DEFAULT_BOSS_SPEC.boss.maxHp,
    phaseTwoAt: DEFAULT_BOSS_SPEC.boss.phaseTwoAt,
    phase2Multiplier: DEFAULT_BOSS_SPEC.boss.phase2Multiplier,
    attacks: DEFAULT_BOSS_SPEC.attacks.map((attack) => ({ ...attack })) as BossSpec["attacks"],
    difficulty: "measured",
    designIntent: "Use the verified house encounter when live encounter design is unavailable.",
    summary: "Default Soulloom combat specification (fallback).",
  };
}

export function createLocalStudioAdapters(): StudioAdapters {
  return {
    creative: {
      agentRuntime: "local_fixture",
      async generate(brief) {
        return generatedTheme(brief);
      },
      async repair(brief) {
        return generatedTheme(brief);
      },
      fallback: fallbackTheme,
    },
    encounter: {
      agentRuntime: "local_fixture",
      async generate(brief) {
        return generatedEncounter(brief);
      },
      async repair(_brief, previous, feedback) {
        const safeTelegraphs = previous.attacks.map((attack) => ({
          ...attack,
          telegraphMs: Math.max(attack.telegraphMs, attack.type === "nova" ? 900 : 600),
        })) as BossSpec["attacks"];
        const phaseTwoOrder = previous.archetype === "procession"
          ? ["charge", "charge", "sweep", "nova"] as EncounterSpec["phaseTwoOrder"]
          : previous.phaseTwoOrder;
        return {
          ...previous,
          attacks: safeTelegraphs,
          phaseTwoOrder,
          designIntent: `${previous.designIntent} Repair: ${feedback.join(" ")}`,
          summary: "Unsafe timing repaired; all three attacks now preserve a dodge window.",
        };
      },
      fallback: fallbackEncounter,
    },
  };
}
