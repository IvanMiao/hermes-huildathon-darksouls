import { describe, expect, it } from "vitest";
import { STUDIO_RUN_FIXTURES } from "./fixtures";
import { toLiveStudioRun } from "./remoteRun";

describe("live Control Room evidence", () => {
  it("converts a mirrored Studio result into replayable evidence", () => {
    const fixture = STUDIO_RUN_FIXTURES[0];
    if (!fixture) throw new Error("Missing Studio fixture.");
    const document = {
      ...fixture,
      artifacts: fixture.artifacts.map((artifact) => ({
        ...artifact,
        data: artifact.kind === "QAReport"
          ? fixture.qaReports.find(({ version }) => version === artifact.version)
          : artifact.data,
      })),
    };

    const liveRun = toLiveStudioRun(document);

    expect(liveRun).not.toBeNull();
    expect(liveRun).toMatchObject({
      runId: fixture.runId,
      evidenceKind: "live",
      status: "published",
    });
    expect(liveRun?.events).toHaveLength(fixture.events.length);
    expect(liveRun?.qaReports.at(-1)?.passed).toBe(true);
  });

  it("rejects malformed public data", () => {
    expect(toLiveStudioRun({ status: "published", recipe: {} })).toBeNull();
  });
});
