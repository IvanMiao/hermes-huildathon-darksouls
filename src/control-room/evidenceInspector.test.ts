import { describe, expect, it } from "vitest";
import type { AnyArtifactEnvelope, StudioEvent } from "../../runner/contracts";
import { deriveEvidenceInspectorModel } from "./evidenceInspector";

const qaArtifact = {
  id: "run:QAReport:v1",
  runId: "run",
  kind: "QAReport",
  version: 1,
  createdAt: "2026-07-11T12:00:01.000Z",
  actor: "Release QA",
  source: { mode: "generated" },
  data: {
    schemaVersion: "1.0",
    passed: true,
    regression: false,
    seed: 42,
    checks: [{
      id: "legal_recipe",
      passed: true,
      artifact: "DraftGameRecipe",
      owner: "Studio Manager",
      message: "Canonical recipe passed.",
    }],
    ownersToRetry: [],
  },
} satisfies AnyArtifactEnvelope;

describe("Control Room evidence inspector", () => {
  it("shows QA-stage evidence for the selected timeline event", () => {
    const event = {
      sequence: 4,
      runId: "run",
      occurredAt: "2026-07-11T12:00:00.500Z",
      actor: "Release QA",
      type: "qa_stage_completed",
      status: "passed",
      summary: "Recipe contract passed.",
      qaStage: {
        id: "recipe_contract",
        label: "Recipe contract",
        checkIds: ["legal_recipe"],
        passed: true,
        durationMs: 0.42,
      },
    } satisfies StudioEvent;

    expect(deriveEvidenceInspectorModel(event, [qaArtifact])).toMatchObject({
      eyebrow: "QA STAGE · PASS",
      title: "Recipe contract",
      metrics: [
        ["Duration", "0.42 ms"],
        ["Checks", "legal_recipe"],
        ["Evidence", "DraftGameRecipe"],
      ],
    });
  });

  it("resolves an artifact written event to the exact artifact version", () => {
    const event = {
      sequence: 8,
      runId: "run",
      occurredAt: "2026-07-11T12:00:01.000Z",
      actor: "Release QA",
      type: "artifact_written",
      status: "passed",
      summary: "QAReport v1 recorded.",
      artifact: { kind: "QAReport", version: 1 },
    } satisfies StudioEvent;

    const model = deriveEvidenceInspectorModel(event, [qaArtifact]);
    expect(model.title).toBe("QAReport v1");
    expect(model.qaChecks).toEqual([
      expect.objectContaining({ id: "legal_recipe", passed: true }),
    ]);
  });
});
