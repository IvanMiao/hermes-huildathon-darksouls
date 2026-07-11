import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_GAME_RECIPE } from "../src/game-recipe/defaultGameRecipe";
import { ARTIFACT_SCHEMA_VERSION, type QAReport } from "./contracts";
import { RunStore } from "./runStore";
import { createLocalStudioAdapters } from "./specialists";
import { HermesStudioManager } from "./studioManager";

const temporaryRoots: string[] = [];

async function createRunsRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "soulloom-p3-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

describe("P3 local autonomous studio", () => {
  it("runs Creative and Encounter in parallel and publishes a passing draft", async () => {
    const runsRoot = await createRunsRoot();
    const result = await new HermesStudioManager({ runsRoot }).start(
      "I smell fear.",
      { runId: "direct-pass" },
    );

    expect(result.status).toBe("published");
    expect(result.qaReport.passed).toBe(true);
    expect(result.artifacts.find(({ kind }) => kind === "ThemeSpec")?.source)
      .toMatchObject({ agentRuntime: "local_fixture" });
    await expect(access(join(result.runDirectory, "release.json"))).resolves.toBeUndefined();

    const creativeStarted = result.events.findIndex(
      ({ actor, type }) => actor === "Creative Director" && type === "task_started",
    );
    const encounterStarted = result.events.findIndex(
      ({ actor, type }) => actor === "Encounter Designer" && type === "task_started",
    );
    const firstSpecialistCompleted = result.events.findIndex(
      ({ actor, type }) =>
        (actor === "Creative Director" || actor === "Encounter Designer")
        && type === "task_completed",
    );
    expect(creativeStarted).toBeGreaterThan(-1);
    expect(encounterStarted).toBeGreaterThan(-1);
    expect(firstSpecialistCompleted).toBeGreaterThan(creativeStarted);
    expect(firstSpecialistCompleted).toBeGreaterThan(encounterStarted);

    const eventLines = (await readFile(
      join(result.runDirectory, "events.jsonl"),
      "utf8",
    )).trim().split("\n");
    expect(eventLines).toHaveLength(result.events.length);
    expect(result.events.map(({ sequence }) => sequence)).toEqual(
      result.events.map((_, index) => index + 1),
    );
  });

  it("rejects an invalid Procession, retries only Encounter, then passes regression", async () => {
    const runsRoot = await createRunsRoot();
    const result = await new HermesStudioManager({ runsRoot }).start(
      "Agreement should arrive before anyone can react.",
      { runId: "repair-run" },
    );

    const encounterArtifacts = result.artifacts
      .filter((artifact) => artifact.kind === "EncounterSpec")
      .sort((left, right) => left.version - right.version);
    const themeArtifacts = result.artifacts.filter(({ kind }) => kind === "ThemeSpec");
    const qaArtifacts = result.artifacts
      .filter((artifact) => artifact.kind === "QAReport")
      .sort((left, right) => left.version - right.version);
    const retryEvents = result.events.filter(({ type }) => type === "retry_routed");

    expect(result.status).toBe("published");
    expect(encounterArtifacts).toHaveLength(2);
    expect(encounterArtifacts[0]?.data).toMatchObject({
      archetype: "procession",
      phaseTwoOrder: ["charge", "sweep", "nova"],
    });
    expect(encounterArtifacts[1]?.data).toMatchObject({
      archetype: "procession",
      phaseTwoOrder: ["charge", "charge", "sweep", "nova"],
    });
    expect(themeArtifacts).toHaveLength(1);
    expect(qaArtifacts.map((artifact) => artifact.data.passed)).toEqual([false, true]);
    expect(qaArtifacts[1]?.data).toMatchObject({ regression: true });
    expect(retryEvents.map(({ owner }) => owner)).toEqual(["Encounter Designer"]);
  });

  it("labels a hard-timeout result as a cached fallback", async () => {
    const runsRoot = await createRunsRoot();
    const adapters = createLocalStudioAdapters();
    adapters.creative.generate = async () => new Promise(() => undefined);

    const result = await new HermesStudioManager({
      runsRoot,
      adapters,
      timeoutMs: 5,
    }).start("A silent bell remembers us.", { runId: "timeout-fallback" });
    const theme = result.artifacts.find(({ kind }) => kind === "ThemeSpec");

    expect(result.status).toBe("published");
    expect(theme?.source).toMatchObject({
      mode: "cached_fallback",
      fallbackReason: expect.stringContaining("hard 5ms timeout"),
    });
    expect(result.events).toContainEqual(expect.objectContaining({
      actor: "Creative Director",
      type: "fallback_used",
    }));
  });

  it("labels a timed-out repair as a default fallback", async () => {
    const runsRoot = await createRunsRoot();
    const adapters = createLocalStudioAdapters();
    adapters.encounter.repair = async () => new Promise(() => undefined);

    const result = await new HermesStudioManager({
      runsRoot,
      adapters,
      timeoutMs: 5,
    }).start(
      "Agreement should arrive before anyone can react.",
      { runId: "repair-fallback" },
    );
    const repairedCombat = result.artifacts.find(
      ({ kind, version }) => kind === "EncounterSpec" && version === 2,
    );

    expect(result.status).toBe("published");
    expect(repairedCombat?.source).toMatchObject({
      mode: "default_fallback",
      fallbackReason: expect.stringContaining("hard 5ms timeout"),
    });
  });

  it("refuses to publish an unpassed QA report", async () => {
    const runsRoot = await createRunsRoot();
    const store = await RunStore.create(runsRoot, "blocked-publish");
    const failedReport: QAReport = {
      schemaVersion: ARTIFACT_SCHEMA_VERSION,
      passed: false,
      regression: false,
      seed: 1,
      checks: [{
        id: "package_rule_active",
        passed: false,
        artifact: "EncounterSpec",
        owner: "Encounter Designer",
        message: "Nova has no usable dodge window.",
      }],
      ownersToRetry: ["Encounter Designer"],
    };
    const artifact = await store.writeArtifact({
      kind: "QAReport",
      actor: "Release QA",
      source: { mode: "generated" },
      data: failedReport,
    });

    await expect(store.publish(DEFAULT_GAME_RECIPE, artifact)).rejects.toThrow(
      "QAReport has not passed",
    );
    await expect(access(join(store.runDirectory, "release.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
