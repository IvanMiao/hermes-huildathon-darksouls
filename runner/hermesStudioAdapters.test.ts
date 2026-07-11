import { describe, expect, it, vi } from "vitest";
import { createHermesStudioAdapters } from "./hermesStudioAdapters";
import {
  createLocalStudioAdapters,
  createProductionBrief,
} from "./specialists";

async function createValidDraft(inputText: string) {
  const brief = createProductionBrief(inputText);
  const local = createLocalStudioAdapters();
  const [creative, encounter] = await Promise.all([
    local.creative.generate(brief),
    local.encounter.generate(brief),
  ]);
  return { brief, creative, encounter };
}

describe("Hermes studio adapters", () => {
  it("runs Creative and Encounter as independent Hermes specialist calls", async () => {
    const { brief, creative, encounter } = await createValidDraft("I smell fear.");
    const invoke = vi.fn(async (prompt: string) => JSON.stringify(
      prompt.includes("ARTIFACT_KIND: ThemeSpec") ? creative : encounter,
    ));
    const adapters = createHermesStudioAdapters({ invoke });

    const [actualCreative, actualEncounter] = await Promise.all([
      adapters.creative.generate(brief),
      adapters.encounter.generate(brief),
    ]);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls.every(([prompt]) => !prompt.includes("delegate_task"))).toBe(true);
    expect(actualCreative).toEqual(creative);
    expect(actualEncounter).toEqual(encounter);
    expect(adapters.creative.agentRuntime).toBe("hermes_specialist");
  });

  it("accepts fenced JSON but still validates the artifact contracts", async () => {
    const { brief, creative } = await createValidDraft("A bell remembers us.");
    const invoke = vi.fn(async (_prompt: string) => `\`\`\`json\n${JSON.stringify(creative)}\n\`\`\``);
    const adapters = createHermesStudioAdapters({ invoke });

    await expect(adapters.creative.generate(brief)).resolves.toEqual(creative);
  });

  it("rejects invalid Hermes output so the Manager can label its fallback", async () => {
    const brief = createProductionBrief("A bell remembers us.");
    const adapters = createHermesStudioAdapters({
      invoke: async () => JSON.stringify({}),
    });

    await expect(adapters.encounter.generate(brief)).rejects.toThrow(
      "EncounterSpec schema validation failed",
    );
  });

  it("reports null Hermes specialist output as an invalid artifact", async () => {
    const brief = createProductionBrief("A bell remembers us.");
    const adapters = createHermesStudioAdapters({ invoke: async () => "null" });

    await expect(adapters.creative.generate(brief)).rejects.toThrow(
      "ThemeSpec schema validation failed",
    );
  });

  it("routes QA feedback through a single Hermes specialist repair", async () => {
    const { brief, encounter } = await createValidDraft(
      "Agreement should arrive before anyone can react.",
    );
    const repaired = {
      ...encounter,
      phaseTwoOrder: ["charge", "charge", "sweep", "nova"] as const,
    };
    const invoke = vi.fn(async (_prompt: string) => JSON.stringify({ artifact: repaired }));
    const adapters = createHermesStudioAdapters({ invoke });

    await expect(adapters.encounter.repair(
      brief,
      encounter,
      ["Procession requires an adjacent charge chain."],
    )).resolves.toEqual(repaired);
    expect(invoke.mock.calls[0]?.[0]).toContain("repairing a failed QA area");
  });
});
