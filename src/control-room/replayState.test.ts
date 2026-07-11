import { describe, expect, it } from "vitest";
import { normalizeGameRecipe } from "../game-recipe/normalize";
import {
  findStudioRunFixture,
  STUDIO_RUN_FIXTURES,
} from "../studio/fixtures";
import { deriveReplayState } from "./replayState";

const repairFixture = findStudioRunFixture("fixture-encounter-repair");

if (!repairFixture) {
  throw new Error("Missing encounter repair fixture.");
}

describe("deriveReplayState", () => {
  it("keeps every UI fixture on the current P3 GameRecipe contract", () => {
    for (const fixture of STUDIO_RUN_FIXTURES) {
      expect(normalizeGameRecipe(fixture.recipe)).toEqual(fixture.recipe);
      expect(new Set(fixture.artifacts.map(({ kind }) => kind))).toEqual(new Set([
        "ProductionBrief",
        "ThemeSpec",
        "EncounterSpec",
        "DraftGameRecipe",
        "QAReport",
      ]));
    }
  });

  it("replays the same Procession repair recorded by P3", () => {
    const encounterArtifacts = repairFixture.artifacts
      .filter(({ kind }) => kind === "EncounterSpec")
      .map(({ data }) => data as { phaseTwoOrder: string[] });

    expect(encounterArtifacts.map(({ phaseTwoOrder }) => phaseTwoOrder)).toEqual([
      ["charge", "sweep", "nova"],
      ["charge", "charge", "sweep", "nova"],
    ]);
    expect(repairFixture.qaReports[0]?.checks[0]?.message).toBe(
      "Procession must use closing_ring and contain an adjacent charge chain.",
    );
  });

  it("makes the blocked release state first class", () => {
    const state = deriveReplayState(repairFixture, 12);

    expect(state.releaseState).toBe("release_blocked");
    expect(state.qaVersion).toBe(1);
    expect(state.qaChecks).toEqual([
      expect.objectContaining({ passed: false, owner: "Encounter Designer" }),
    ]);
  });

  it("reveals only the targeted repair before regression publishes", () => {
    const state = deriveReplayState(repairFixture, 14);

    expect(state.releaseState).toBe("repairing");
    expect(state.visibleArtifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "EncounterSpec", version: 2 }),
    ]));
    expect(state.visibleArtifacts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "ThemeSpec", version: 2 }),
    ]));
  });

  it("opens the release only after the publish event", () => {
    expect(deriveReplayState(repairFixture, 18).releaseState).toBe("repairing");
    expect(deriveReplayState(repairFixture, 19).releaseState).toBe("published");
  });
});
