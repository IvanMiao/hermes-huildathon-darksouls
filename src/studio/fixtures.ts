import { DEFAULT_BOSS_SPEC } from "../boss-spec/defaultBossSpec";
import type { BossSpec } from "../boss-spec/types";
import { DEFAULT_GAME_RECIPE } from "../game-recipe/defaultGameRecipe";
import type { GameRecipeV0 } from "../game-recipe/types";
import type {
  ArtifactKind,
  ArtifactSource,
  QAOwner,
  StudioActor,
  StudioEvent,
} from "../../runner/contracts";

export interface StudioArtifactFixture {
  kind: ArtifactKind;
  version: number;
  actor: StudioActor;
  source: ArtifactSource;
  summary: string;
  data: unknown;
}

export interface QAProofCheck {
  id: string;
  passed: boolean;
  owner: QAOwner;
  message: string;
}

export interface StudioRunFixture {
  runId: string;
  label: string;
  evidenceKind?: "fixture" | "live";
  inputText: string;
  status: "published" | "release_blocked";
  recipe: GameRecipeV0;
  events: StudioEvent[];
  artifacts: StudioArtifactFixture[];
  qaReports: ReadonlyArray<{
    version: number;
    eventSequence: number;
    passed: boolean;
    regression: boolean;
    checks: readonly QAProofCheck[];
  }>;
}

const DIRECT_RUN_ID = "fixture-direct-pass";
const REPAIR_RUN_ID = "fixture-encounter-repair";

function event(
  runId: string,
  sequence: number,
  occurredAt: string,
  actor: StudioActor,
  type: StudioEvent["type"],
  status: StudioEvent["status"],
  summary: string,
  details: Pick<StudioEvent, "artifact" | "owner"> = {},
): StudioEvent {
  return { runId, sequence, occurredAt, actor, type, status, summary, ...details };
}

const DIRECT_BOSS_SPEC: BossSpec = {
  ...DEFAULT_BOSS_SPEC,
  boss: {
    ...DEFAULT_BOSS_SPEC.boss,
    maxHp: 840,
    phase2Multiplier: 1.32,
    lines: {
      ...DEFAULT_BOSS_SPEC.boss.lines,
      intro: "Your fear arrived before you did.",
    },
  },
  attacks: [
    { type: "sweep", telegraphMs: 650, damage: 18 },
    { type: "charge", telegraphMs: 780, damage: 24 },
    { type: "nova", telegraphMs: 1_000, damage: 30 },
  ],
  voice: {
    ...DEFAULT_BOSS_SPEC.voice,
  },
};

const REPAIR_BOSS_SPEC: BossSpec = {
  slug: "agreement-should-arrive-before-anyone-can-react-5650",
  title: "AGREEMENT SHOULD ARRIVE BEFORE ANYONE CAN REACT.",
  boss: {
    name: "VESPER",
    title: "KEEPER OF THE UNANSWERED BELL",
    palette: ["#14131b", "#9e4c3f", "#ded4c4"],
    maxHp: 840,
    phaseTwoAt: 0.5,
    phase2Multiplier: 1.32,
    lines: {
      intro: "Every word leaves a wound.",
      phaseTwo: "Now hear what certainty costs.",
      defeat: "The echo outlived its saint.",
    },
  },
  attacks: [
    { type: "sweep", telegraphMs: 650, damage: 18 },
    { type: "charge", telegraphMs: 780, damage: 24 },
    { type: "nova", telegraphMs: 1_000, damage: 30 },
  ],
  voice: {
    trigger: "phase_two_or_defeat",
    text: "Now hear what certainty costs.",
    url: `/runs/${REPAIR_RUN_ID}/voice.mp3`,
  },
  arena: { theme: "ruined-cathedral", fog: "#351c24" },
};

const DIRECT_RECIPE: GameRecipeV0 = {
  ...structuredClone(DEFAULT_GAME_RECIPE),
  runId: DIRECT_RUN_ID,
  source: {
    text: "I smell fear.",
    normalizedIntent: "A direct challenge becomes a readable duel.",
  },
  selection: {
    reason: "A direct challenge becomes a readable duel. Selected the duel encounter grammar.",
    reused: false,
  },
  boss: DIRECT_BOSS_SPEC,
};

const REPAIR_RECIPE: GameRecipeV0 = {
  ...structuredClone(DEFAULT_GAME_RECIPE),
  runId: REPAIR_RUN_ID,
  source: {
    text: "Agreement should arrive before anyone can react.",
    normalizedIntent: "An unstoppable command closes the available space.",
  },
  selection: {
    reason: "An unstoppable command closes the available space. Selected the procession encounter grammar.",
    reused: false,
  },
  archetype: "procession",
  arena: { rule: "closing_ring", theme: "ruined-cathedral" },
  combat: {
    phaseOneOrder: ["sweep", "charge", "nova"],
    phaseTwoOrder: ["charge", "charge", "sweep", "nova"],
    phaseTwoRule: "charge_chain",
  },
  boss: REPAIR_BOSS_SPEC,
  presentation: {
    motif: "broken bells, wax seals, ash scripture",
    cameraMood: "watchful",
  },
};

const SHARED_PASS_CHECKS: readonly QAProofCheck[] = [
  {
    id: "legal_recipe",
    passed: true,
    owner: "Studio Manager",
    message: "Canonical GameRecipeV0 schema passed.",
  },
  {
    id: "phase_two_reachable",
    passed: true,
    owner: "Encounter Designer",
    message: "Autoplayer crossed the phase-two threshold exactly through combat damage.",
  },
  {
    id: "death_restart",
    passed: true,
    owner: "Encounter Designer",
    message: "A lethal hit reached defeat and restart restored the initial fight.",
  },
  {
    id: "voice_trigger_reachable",
    passed: true,
    owner: "Audio Producer",
    message: "Configured voice trigger 'phase_two_or_defeat' was reached.",
  },
];

const DIRECT_PASS_CHECKS: readonly QAProofCheck[] = [
  ...SHARED_PASS_CHECKS.slice(0, 2),
  { id: "boss_defeatable", passed: true, owner: "Encounter Designer", message: "Autoplayer defeated the boss in 10.65s." },
  ...SHARED_PASS_CHECKS.slice(2),
  { id: "package_rule_active", passed: true, owner: "Encounter Designer", message: "Duel haste shortened the phase-two telegraph." },
];

const REPAIR_PASS_CHECKS: readonly QAProofCheck[] = [
  ...SHARED_PASS_CHECKS.slice(0, 2),
  { id: "boss_defeatable", passed: true, owner: "Encounter Designer", message: "Autoplayer defeated the boss in 9.97s." },
  ...SHARED_PASS_CHECKS.slice(2),
  { id: "package_rule_active", passed: true, owner: "Encounter Designer", message: "Procession radius shrank monotonically to its safe floor and executed a charge chain." },
];

const directPass: StudioRunFixture = {
  runId: DIRECT_RUN_ID,
  label: "Direct pass",
  inputText: "I smell fear.",
  status: "published",
  recipe: DIRECT_RECIPE,
  events: [
    event(DIRECT_RUN_ID, 1, "2026-07-11T12:49:10.241Z", "Studio Manager", "run_started", "started", "Production started for input cec808beff6e."),
    event(DIRECT_RUN_ID, 2, "2026-07-11T12:49:10.243Z", "Studio Manager", "artifact_written", "passed", "ProductionBrief v1 recorded (generated).", { artifact: { kind: "ProductionBrief", version: 1 } }),
    event(DIRECT_RUN_ID, 3, "2026-07-11T12:49:10.244Z", "Creative Director", "task_started", "started", "Creative Director started ThemeSpec."),
    event(DIRECT_RUN_ID, 4, "2026-07-11T12:49:10.244Z", "Encounter Designer", "task_started", "started", "Encounter Designer started EncounterSpec."),
    event(DIRECT_RUN_ID, 5, "2026-07-11T12:49:10.247Z", "Creative Director", "artifact_written", "passed", "ThemeSpec v1 recorded (generated).", { artifact: { kind: "ThemeSpec", version: 1 } }),
    event(DIRECT_RUN_ID, 6, "2026-07-11T12:49:10.247Z", "Encounter Designer", "artifact_written", "passed", "EncounterSpec v1 recorded (generated).", { artifact: { kind: "EncounterSpec", version: 1 } }),
    event(DIRECT_RUN_ID, 7, "2026-07-11T12:49:10.247Z", "Creative Director", "task_completed", "passed", "Creative Director completed ThemeSpec v1.", { artifact: { kind: "ThemeSpec", version: 1 } }),
    event(DIRECT_RUN_ID, 8, "2026-07-11T12:49:10.248Z", "Encounter Designer", "task_completed", "passed", "Encounter Designer completed EncounterSpec v1.", { artifact: { kind: "EncounterSpec", version: 1 } }),
    event(DIRECT_RUN_ID, 9, "2026-07-11T12:49:10.249Z", "Studio Manager", "artifact_written", "passed", "DraftGameRecipe v1 recorded (generated).", { artifact: { kind: "DraftGameRecipe", version: 1 } }),
    event(DIRECT_RUN_ID, 10, "2026-07-11T12:49:10.249Z", "Release QA", "task_started", "started", "Release QA started."),
    event(DIRECT_RUN_ID, 11, "2026-07-11T12:49:10.254Z", "Release QA", "artifact_written", "passed", "QAReport v1 recorded (generated).", { artifact: { kind: "QAReport", version: 1 } }),
    event(DIRECT_RUN_ID, 12, "2026-07-11T12:49:10.255Z", "Publisher", "release_published", "passed", "Published release from QAReport v1.", { artifact: { kind: "QAReport", version: 1 } }),
  ],
  artifacts: [
    { kind: "ProductionBrief", version: 1, actor: "Studio Manager", source: { mode: "generated" }, summary: "Readable duel about fear and certainty.", data: { inputText: "I smell fear.", tone: "ritual", voiceRequested: true } },
    { kind: "ThemeSpec", version: 1, actor: "Creative Director", source: { mode: "generated" }, summary: "A polite oracle weaponizes certainty inside a ruined library.", data: { motif: "sealed mouths beneath an orange halo", cameraMood: "oppressive" } },
    { kind: "EncounterSpec", version: 1, actor: "Encounter Designer", source: { mode: "generated" }, summary: "Duel preserves the standard readable attack cycle and haste rule.", data: DIRECT_RECIPE.combat },
    { kind: "DraftGameRecipe", version: 1, actor: "Studio Manager", source: { mode: "generated" }, summary: "FABLE Duel recipe assembled for QA.", data: DIRECT_RECIPE },
    { kind: "QAReport", version: 1, actor: "Release QA", source: { mode: "generated" }, summary: "All six deterministic release checks passed.", data: { passed: true, checks: DIRECT_PASS_CHECKS } },
  ],
  qaReports: [{ version: 1, eventSequence: 11, passed: true, regression: false, checks: DIRECT_PASS_CHECKS }],
};

const repairEvents: StudioEvent[] = [
  event(REPAIR_RUN_ID, 1, "2026-07-11T12:49:10.265Z", "Studio Manager", "run_started", "started", "Production started for input 5650d0fa8cea."),
  event(REPAIR_RUN_ID, 2, "2026-07-11T12:49:10.266Z", "Studio Manager", "artifact_written", "passed", "ProductionBrief v1 recorded (generated).", { artifact: { kind: "ProductionBrief", version: 1 } }),
  event(REPAIR_RUN_ID, 3, "2026-07-11T12:49:10.266Z", "Creative Director", "task_started", "started", "Creative Director started ThemeSpec."),
  event(REPAIR_RUN_ID, 4, "2026-07-11T12:49:10.266Z", "Encounter Designer", "task_started", "started", "Encounter Designer started EncounterSpec."),
  event(REPAIR_RUN_ID, 5, "2026-07-11T12:49:10.267Z", "Creative Director", "artifact_written", "passed", "ThemeSpec v1 recorded (generated).", { artifact: { kind: "ThemeSpec", version: 1 } }),
  event(REPAIR_RUN_ID, 6, "2026-07-11T12:49:10.267Z", "Encounter Designer", "artifact_written", "passed", "EncounterSpec v1 recorded (generated).", { artifact: { kind: "EncounterSpec", version: 1 } }),
  event(REPAIR_RUN_ID, 7, "2026-07-11T12:49:10.267Z", "Creative Director", "task_completed", "passed", "Creative Director completed ThemeSpec v1.", { artifact: { kind: "ThemeSpec", version: 1 } }),
  event(REPAIR_RUN_ID, 8, "2026-07-11T12:49:10.267Z", "Encounter Designer", "task_completed", "passed", "Encounter Designer completed EncounterSpec v1.", { artifact: { kind: "EncounterSpec", version: 1 } }),
  event(REPAIR_RUN_ID, 9, "2026-07-11T12:49:10.268Z", "Studio Manager", "artifact_written", "passed", "DraftGameRecipe v1 recorded (generated).", { artifact: { kind: "DraftGameRecipe", version: 1 } }),
  event(REPAIR_RUN_ID, 10, "2026-07-11T12:49:10.268Z", "Release QA", "task_started", "started", "Release QA started."),
  event(REPAIR_RUN_ID, 11, "2026-07-11T12:49:10.268Z", "Release QA", "artifact_written", "passed", "QAReport v1 recorded (generated).", { artifact: { kind: "QAReport", version: 1 } }),
  event(REPAIR_RUN_ID, 12, "2026-07-11T12:49:10.269Z", "Release QA", "qa_blocked", "failed", "Release blocked by Encounter Designer.", { artifact: { kind: "QAReport", version: 1 } }),
  event(REPAIR_RUN_ID, 13, "2026-07-11T12:49:10.269Z", "Studio Manager", "retry_routed", "info", "Only Encounter Designer was assigned the failed ownership area.", { owner: "Encounter Designer" }),
  event(REPAIR_RUN_ID, 14, "2026-07-11T12:49:10.270Z", "Encounter Designer", "artifact_written", "passed", "EncounterSpec v2 recorded (repair).", { artifact: { kind: "EncounterSpec", version: 2 } }),
  event(REPAIR_RUN_ID, 15, "2026-07-11T12:49:10.270Z", "Release QA", "regression_started", "started", "Regression QA started against the repaired draft."),
  event(REPAIR_RUN_ID, 16, "2026-07-11T12:49:10.270Z", "Studio Manager", "artifact_written", "passed", "DraftGameRecipe v2 recorded (repair).", { artifact: { kind: "DraftGameRecipe", version: 2 } }),
  event(REPAIR_RUN_ID, 17, "2026-07-11T12:49:10.271Z", "Release QA", "task_started", "started", "Regression QA started."),
  event(REPAIR_RUN_ID, 18, "2026-07-11T12:49:10.273Z", "Release QA", "artifact_written", "passed", "QAReport v2 recorded (generated).", { artifact: { kind: "QAReport", version: 2 } }),
  event(REPAIR_RUN_ID, 19, "2026-07-11T12:49:10.273Z", "Publisher", "release_published", "passed", "Published release from QAReport v2.", { artifact: { kind: "QAReport", version: 2 } }),
];

const blockedChecks: readonly QAProofCheck[] = [{
  id: "package_rule_active",
  passed: false,
  owner: "Encounter Designer",
  message: "Procession must use closing_ring and contain an adjacent charge chain.",
}];

const encounterRepair: StudioRunFixture = {
  runId: REPAIR_RUN_ID,
  label: "Blocked, then repaired",
  inputText: "Agreement should arrive before anyone can react.",
  status: "published",
  recipe: REPAIR_RECIPE,
  events: repairEvents,
  artifacts: [
    { kind: "ProductionBrief", version: 1, actor: "Studio Manager", source: { mode: "generated" }, summary: "A gothic duel about certainty arriving too quickly.", data: { inputText: "Agreement should arrive before anyone can react.", tone: "gothic", voiceRequested: true } },
    { kind: "ThemeSpec", version: 1, actor: "Creative Director", source: { mode: "generated" }, summary: "VESPER turns the source text into a gothic trial.", data: { motif: "broken bells, wax seals, ash scripture", cameraMood: "watchful" } },
    { kind: "EncounterSpec", version: 1, actor: "Encounter Designer", source: { mode: "generated" }, summary: "Procession draft omits its required charge chain.", data: { ...REPAIR_RECIPE.combat, phaseTwoOrder: ["charge", "sweep", "nova"] } },
    { kind: "DraftGameRecipe", version: 1, actor: "Studio Manager", source: { mode: "generated" }, summary: "Draft Procession assembled without an adjacent charge chain.", data: { ...REPAIR_RECIPE, combat: { ...REPAIR_RECIPE.combat, phaseTwoOrder: ["charge", "sweep", "nova"] } } },
    { kind: "QAReport", version: 1, actor: "Release QA", source: { mode: "generated" }, summary: "Release blocked: Procession package rule is incomplete.", data: { passed: false, checks: blockedChecks } },
    { kind: "EncounterSpec", version: 2, actor: "Encounter Designer", source: { mode: "repair" }, summary: "Procession repaired with an adjacent charge chain.", data: REPAIR_RECIPE.combat },
    { kind: "DraftGameRecipe", version: 2, actor: "Studio Manager", source: { mode: "repair" }, summary: "Repaired GameRecipe assembled for regression QA.", data: REPAIR_RECIPE },
    { kind: "QAReport", version: 2, actor: "Release QA", source: { mode: "generated" }, summary: "Regression passed after the targeted Encounter repair.", data: { passed: true, regression: true, checks: REPAIR_PASS_CHECKS } },
  ],
  qaReports: [
    { version: 1, eventSequence: 11, passed: false, regression: false, checks: blockedChecks },
    { version: 2, eventSequence: 18, passed: true, regression: true, checks: REPAIR_PASS_CHECKS },
  ],
};

export const STUDIO_RUN_FIXTURES: readonly StudioRunFixture[] = [
  directPass,
  encounterRepair,
];

export function findStudioRunFixture(runId: string): StudioRunFixture | undefined {
  return STUDIO_RUN_FIXTURES.find((fixture) => fixture.runId === runId);
}

export function chooseFixtureForInput(inputText: string): StudioRunFixture {
  return /agreement|react|immediate|quick/i.test(inputText)
    ? encounterRepair
    : directPass;
}
