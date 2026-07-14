import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mirrorRunToConvex } from "./convexEvidence";
import { HermesStudioManager } from "./studioManager";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

async function createPublishedResult() {
  const runsRoot = await mkdtemp(join(tmpdir(), "soulloom-audio-evidence-"));
  temporaryRoots.push(runsRoot);
  return new HermesStudioManager({ runsRoot }).start(
    "A cathedral bell challenges the last witness.",
    { runId: "audio-evidence-run" },
  );
}

describe("Convex audio evidence mirror", () => {
  it("generates phase voice and boss music, binds both URLs, and records evidence", async () => {
    const result = await createPublishedResult();
    const mutation = vi.fn(async () => "studio-run-id");
    let actionsInFlight = 0;
    let maxActionsInFlight = 0;
    const action = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      actionsInFlight += 1;
      maxActionsInFlight = Math.max(maxActionsInFlight, actionsInFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      actionsInFlight -= 1;
      if ("text" in args) {
        return {
          storageId: "voice-storage-id",
          url: "https://audio.example/phase-two.mp3",
          text: args.text,
          model: "eleven_multilingual_v2",
          requestId: "voice-request-id",
          traceId: "voice-trace-id",
          characterCost: 27,
          source: "elevenlabs_generated",
        };
      }
      return {
        storageId: "music-storage-id",
        url: "https://audio.example/boss-score.mp3",
        durationMs: 30_000,
        model: "music_v2",
        songId: "song-id",
        requestId: "music-request-id",
        traceId: "music-trace-id",
        source: "elevenlabs_generated",
        compositionPlan: { chunks: [{ text: "[Invocation]", duration_ms: 3_000 }] },
      };
    });
    const observedEvents: string[] = [];
    const observedArtifacts: string[] = [];

    const mirrored = await mirrorRunToConvex(result, {
      convexUrl: "https://convex.example",
      integrationToken: "integration-token",
      client: {
        query: vi.fn(async () => null),
        action,
        mutation,
      },
      onEvent: (event) => observedEvents.push(`${event.actor}:${event.type}`),
      onArtifact: (artifact) => observedArtifacts.push(artifact.kind),
    });

    expect(action).toHaveBeenCalledTimes(2);
    expect(maxActionsInFlight).toBe(1);
    expect(mirrored.recipe).toMatchObject({
      boss: { voice: { url: "https://audio.example/phase-two.mp3" } },
      presentation: {
        music: {
          url: "https://audio.example/boss-score.mp3",
          durationMs: 30_000,
        },
      },
    });
    expect(mirrored.music).toMatchObject({ songId: "song-id", model: "music_v2" });
    expect(observedArtifacts).toEqual(["VoiceArtifact", "MusicArtifact"]);
    expect(observedEvents).toEqual([
      "Audio Producer:task_started",
      "Audio Producer:artifact_written",
      "Audio Producer:artifact_written",
      "Audio Producer:task_completed",
    ]);
    expect(mutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      music: expect.objectContaining({ storageId: "music-storage-id" }),
      artifacts: expect.arrayContaining([
        expect.objectContaining({ kind: "VoiceArtifact" }),
        expect.objectContaining({ kind: "MusicArtifact" }),
      ]),
    }));
  });

  it("reuses audio evidence already stored for the same run", async () => {
    const result = await createPublishedResult();
    const action = vi.fn();
    const existing = {
      voice: {
        storageId: "voice-storage-id",
        url: "https://audio.example/existing-voice.mp3",
        text: result.recipe.boss.voice.text,
        source: "elevenlabs_generated",
      },
      music: {
        storageId: "music-storage-id",
        url: "https://audio.example/existing-music.mp3",
        durationMs: 64_000,
        model: "music_v2",
        source: "elevenlabs_generated",
        compositionPlan: { chunks: [] },
      },
    };

    const mirrored = await mirrorRunToConvex(result, {
      convexUrl: "https://convex.example",
      integrationToken: "integration-token",
      client: {
        query: vi.fn(async () => existing),
        action,
        mutation: vi.fn(async () => "studio-run-id"),
      },
    });

    expect(action).not.toHaveBeenCalled();
    expect(mirrored.recipe.presentation.music.url).toBe(
      "https://audio.example/existing-music.mp3",
    );
  });
});
