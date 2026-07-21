import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mirrorRunToCloudflare } from "./cloudflareEvidence";
import { HermesStudioManager } from "./studioManager";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })));
});

async function createResult(runId: string) {
  const runsRoot = await mkdtemp(join(tmpdir(), "soulloom-cloudflare-evidence-"));
  temporaryRoots.push(runsRoot);
  return new HermesStudioManager({ runsRoot }).start(
    "A cathedral bell challenges the last witness.",
    { runId },
  );
}

describe("Cloudflare audio evidence mirror", () => {
  it("binds D1/R2 audio URLs and records release evidence", async () => {
    const result = await createResult("cloudflare-evidence-run");
    let mirroredDocument: unknown;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/audio")) {
        expect(init?.method).toBe("POST");
        return Response.json({
          voice: {
            storageId: "runs/cloudflare-evidence-run/voice.mp3",
            url: "https://soulloom.example/api/evidence/artifacts/cloudflare-evidence-run/voice.mp3",
            text: result.recipe.boss.voice.text,
            model: "eleven_multilingual_v2",
            requestId: "voice-request-id",
            traceId: "voice-trace-id",
            characterCost: 27,
            source: "elevenlabs_generated",
          },
          music: {
            storageId: "runs/cloudflare-evidence-run/music.mp3",
            url: "https://soulloom.example/api/evidence/artifacts/cloudflare-evidence-run/music.mp3",
            durationMs: 30_000,
            model: "music_v2",
            songId: "song-id",
            requestId: "music-request-id",
            traceId: "music-trace-id",
            source: "elevenlabs_generated",
            compositionPlan: { chunks: [{ text: "[Invocation]", duration_ms: 3_000 }] },
          },
        });
      }
      expect(init?.method).toBe("PUT");
      mirroredDocument = JSON.parse(String(init?.body)) as unknown;
      return Response.json({ mode: "mirrored" });
    });
    const observedEvents: string[] = [];
    const observedArtifacts: string[] = [];

    const mirrored = await mirrorRunToCloudflare(result, {
      evidenceUrl: "https://soulloom.example",
      integrationToken: "integration-token",
      fetcher,
      onEvent: (event) => observedEvents.push(`${event.actor}:${event.type}`),
      onArtifact: (artifact) => observedArtifacts.push(artifact.kind),
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(mirrored.recipe).toMatchObject({
      boss: {
        voice: {
          url: "https://soulloom.example/api/evidence/artifacts/cloudflare-evidence-run/voice.mp3",
        },
      },
      presentation: {
        music: {
          url: "https://soulloom.example/api/evidence/artifacts/cloudflare-evidence-run/music.mp3",
          durationMs: 30_000,
        },
      },
    });
    expect(mirroredDocument).toMatchObject({
      runId: "cloudflare-evidence-run",
      voice: { storageId: "runs/cloudflare-evidence-run/voice.mp3" },
      music: { storageId: "runs/cloudflare-evidence-run/music.mp3" },
    });
    expect(observedArtifacts).toEqual(["VoiceArtifact", "MusicArtifact"]);
    expect(observedEvents).toEqual([
      "Audio Producer:task_started",
      "Audio Producer:artifact_written",
      "Audio Producer:artifact_written",
      "Audio Producer:task_completed",
    ]);
  });

  it("mirrors blocked runs without billing the audio provider", async () => {
    const publishedResult = await createResult("cloudflare-blocked-run");
    const result = { ...publishedResult, status: "release_blocked" as const };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      return Response.json({ mode: "mirrored" });
    });

    const mirrored = await mirrorRunToCloudflare(result, {
      evidenceUrl: "https://soulloom.example",
      integrationToken: "integration-token",
      fetcher,
    });

    expect(result.status).toBe("release_blocked");
    expect(mirrored.mode).toBe("mirrored");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
