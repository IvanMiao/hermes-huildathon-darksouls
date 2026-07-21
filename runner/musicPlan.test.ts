import { describe, expect, it, vi } from "vitest";
import {
  BOSS_MUSIC_DURATION_MS,
  composeBossMusicWithRetry,
  createBossMusicCompositionPlan,
} from "../cloudflare/audioGeneration";

describe("generated boss music plan", () => {
  it("matches the runtime section contract and remains explicitly original", () => {
    const plan = createBossMusicCompositionPlan({
      bossName: "VESPER",
      bossTitle: "KEEPER OF THE UNANSWERED BELL",
      motif: "broken bells beneath a closing ring",
      cameraMood: "oppressive",
      archetype: "procession",
      arenaTheme: "ruined-cathedral",
    });

    expect(plan.chunks.map(({ duration_ms }) => duration_ms)).toEqual([
      3_000,
      11_000,
      3_000,
      10_000,
      3_000,
    ]);
    expect(plan.chunks.reduce((total, chunk) => total + chunk.duration_ms, 0))
      .toBe(BOSS_MUSIC_DURATION_MS);
    expect(plan.chunks[0]?.positive_styles).toContain(
      "original dark mythic fantasy boss score",
    );
    expect(plan.chunks[0]?.negative_styles).toContain(
      "franchise themes or quoted soundtrack material",
    );
    expect(JSON.stringify(plan)).toContain(
      "an original three-note processional motif with a displaced final beat",
    );
    expect(JSON.stringify(plan)).not.toContain("broken bells beneath a closing ring");
    expect(JSON.stringify(plan)).not.toContain("VESPER");
    expect(JSON.stringify(plan)).not.toContain("KEEPER OF THE UNANSWERED BELL");
  });
});

describe("ElevenLabs boss music request", () => {
  it("retries a transient server failure before returning the generated audio", async () => {
    const responses = [
      new Response('{"status":"internal_server_error"}', { status: 500 }),
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    ];
    const fetcher = vi.fn(async () => responses.shift() ?? new Response(null, { status: 500 }));
    const wait = vi.fn(async () => undefined);

    const response = await composeBossMusicWithRetry(
      "test-api-key",
      { chunks: [] },
      { fetcher, wait },
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
