import { describe, expect, it, vi } from "vitest";
import {
  handleCloudflareEvidenceRequest,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type D1ResultLike,
  type R2BucketLike,
  type R2ObjectBodyLike,
} from "./evidenceApi";

type StoredRow = Record<string, string | number | null>;

class FakeD1Statement implements D1PreparedStatementLike {
  private values: Array<string | number | null> = [];

  constructor(
    private readonly database: FakeD1,
    private readonly query: string,
  ) {}

  bind(...values: Array<string | number | null>): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    const runId = String(this.values[0]);
    if (this.query.includes("FROM generated_audio")) {
      return (this.database.audio.get(runId) as T | undefined) ?? null;
    }
    if (this.query.includes("FROM studio_runs")) {
      return (this.database.runs.get(runId) as T | undefined) ?? null;
    }
    throw new Error(`Unsupported test SELECT: ${this.query}`);
  }

  async run(): Promise<D1ResultLike> {
    const runId = String(this.values[0]);
    if (this.query.includes("INSERT INTO generated_audio")) {
      const existing = this.database.audio.get(runId) ?? {
        voice_json: null,
        music_json: null,
      };
      if (this.query.includes("(run_id, voice_json")) {
        existing.voice_json = String(this.values[1]);
      } else {
        existing.music_json = String(this.values[1]);
      }
      this.database.audio.set(runId, existing);
      return { success: true };
    }
    if (this.query.includes("INSERT INTO studio_runs")) {
      this.database.runs.set(runId, {
        run_id: runId,
        status: String(this.values[1]),
        input_text: String(this.values[2]),
        recipe_json: String(this.values[3]),
        events_json: String(this.values[4]),
        artifacts_json: String(this.values[5]),
        qa_report_json: String(this.values[6]),
        voice_json: this.values[7] ?? null,
        music_json: this.values[8] ?? null,
        mirrored_at: Number(this.values[9]),
      });
      return { success: true };
    }
    throw new Error(`Unsupported test mutation: ${this.query}`);
  }
}

class FakeD1 implements D1DatabaseLike {
  readonly runs = new Map<string, StoredRow>();
  readonly audio = new Map<string, StoredRow>();

  prepare(query: string): D1PreparedStatementLike {
    return new FakeD1Statement(this, query);
  }
}

class FakeR2 implements R2BucketLike {
  readonly objects = new Map<string, {
    bytes: Uint8Array;
    contentType: string;
    cacheControl?: string;
  }>();

  async put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown> {
    this.objects.set(key, {
      bytes: new Uint8Array(value),
      contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
      ...(options?.httpMetadata?.cacheControl
        ? { cacheControl: options.httpMetadata.cacheControl }
        : {}),
    });
    return {};
  }

  async get(
    key: string,
    options?: { range?: Headers },
  ): Promise<R2ObjectBodyLike | null> {
    if (options === undefined && arguments.length > 1) {
      throw new Error("R2 full reads must omit the options argument.");
    }
    const stored = this.objects.get(key);
    if (!stored) return null;
    const rangeHeader = options?.range?.get("range");
    const rangeMatch = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
    const offset = rangeMatch ? Number(rangeMatch[1]) : 0;
    const requestedEnd = rangeMatch?.[2]
      ? Number(rangeMatch[2])
      : stored.bytes.byteLength - 1;
    const end = Math.min(requestedEnd, stored.bytes.byteLength - 1);
    const bytes = rangeMatch ? stored.bytes.slice(offset, end + 1) : stored.bytes;
    return {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      size: stored.bytes.byteLength,
      httpEtag: '"test-etag"',
      range: { offset, length: bytes.byteLength },
      writeHttpMetadata(headers) {
        headers.set("Content-Type", stored.contentType);
        if (stored.cacheControl) headers.set("Cache-Control", stored.cacheControl);
      },
    };
  }
}

const integrationToken = "integration-token";

function environment() {
  return {
    SOULLOOM_DB: new FakeD1(),
    SOULLOOM_ARTIFACTS: new FakeR2(),
    STUDIO_INTEGRATION_TOKEN: integrationToken,
    ELEVENLABS_API_KEY: "elevenlabs-key",
    ELEVENLABS_VOICE_ID: "voice-id",
  };
}

function authorizedJsonRequest(url: string, method: "POST" | "PUT", body: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${integrationToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Cloudflare D1/R2 evidence API", () => {
  it("generates audio once, stores it in R2, and reuses it by run ID", async () => {
    const bindings = environment();
    const providerFetcher = vi.fn(async (url: string) => {
      const headers = new Headers({ "content-type": "audio/mpeg" });
      headers.set(
        url.includes("text-to-speech") ? "request-id" : "song-id",
        url.includes("text-to-speech") ? "voice-request" : "music-song",
      );
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers });
    });
    const body = {
      voiceText: "The bell remembers.",
      direction: {
        bossName: "VESPER",
        bossTitle: "KEEPER OF THE UNANSWERED BELL",
        motif: "broken bells",
        cameraMood: "oppressive",
        archetype: "procession",
        arenaTheme: "ruined-cathedral",
      },
    };
    const url = "https://soulloom.example/api/evidence/runs/run-one/audio";

    const first = await handleCloudflareEvidenceRequest(
      authorizedJsonRequest(url, "POST", body),
      bindings,
      { providerFetcher, now: () => 123 },
    );
    const firstBody = await first.json() as Record<string, Record<string, unknown>>;
    const second = await handleCloudflareEvidenceRequest(
      authorizedJsonRequest(url, "POST", body),
      bindings,
      { providerFetcher, now: () => 456 },
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(providerFetcher).toHaveBeenCalledTimes(2);
    expect(firstBody.voice).toMatchObject({
      storageId: "runs/run-one/voice.mp3",
      url: "https://soulloom.example/api/evidence/artifacts/run-one/voice.mp3",
    });
    expect(firstBody.music).toMatchObject({
      storageId: "runs/run-one/music.mp3",
      durationMs: 30_000,
    });
    expect(bindings.SOULLOOM_ARTIFACTS.objects.size).toBe(2);

    const voiceUrl = firstBody.voice?.url;
    if (typeof voiceUrl !== "string") throw new Error("Missing generated voice URL.");
    const fullResponse = await handleCloudflareEvidenceRequest(
      new Request(voiceUrl),
      bindings,
    );
    expect(fullResponse.status).toBe(200);
    expect(fullResponse.headers.get("content-range")).toBeNull();

    const rangeResponse = await handleCloudflareEvidenceRequest(
      new Request(voiceUrl, {
        headers: { Range: "bytes=1-2" },
      }),
      bindings,
    );
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get("content-range")).toBe("bytes 1-2/3");
    expect(new Uint8Array(await rangeResponse.arrayBuffer())).toEqual(
      new Uint8Array([2, 3]),
    );
  });

  it("upserts a completed run and serves its durable evidence", async () => {
    const bindings = environment();
    const voice = {
      storageId: "runs/run-two/voice.mp3",
      url: "https://soulloom.example/api/evidence/artifacts/run-two/voice.mp3",
      text: "The bell remembers.",
      model: "eleven_multilingual_v2",
      source: "elevenlabs_generated",
    };
    const music = {
      storageId: "runs/run-two/music.mp3",
      url: "https://soulloom.example/api/evidence/artifacts/run-two/music.mp3",
      durationMs: 30_000,
      model: "music_v2",
      source: "elevenlabs_generated",
      compositionPlan: { chunks: [] },
    };
    const document = {
      runId: "run-two",
      status: "published",
      inputText: "A bell refuses silence.",
      recipe: { source: { text: "A bell refuses silence." } },
      events: [],
      artifacts: [],
      qaReport: { passed: true },
      voice,
      music,
    };

    const stored = await handleCloudflareEvidenceRequest(
      authorizedJsonRequest(
        "https://soulloom.example/api/evidence/runs/run-two",
        "PUT",
        document,
      ),
      bindings,
      { now: () => 987 },
    );
    const loaded = await handleCloudflareEvidenceRequest(
      new Request("https://soulloom.example/api/evidence/runs/run-two"),
      bindings,
    );

    expect(stored.status).toBe(200);
    expect(loaded.status).toBe(200);
    expect(await loaded.json()).toMatchObject({
      runId: "run-two",
      status: "published",
      mirroredAt: 987,
      voice: { storageId: "runs/run-two/voice.mp3" },
    });
  });

  it("keeps evidence writes private", async () => {
    const response = await handleCloudflareEvidenceRequest(
      new Request("https://soulloom.example/api/evidence/runs/run-three", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      environment(),
    );

    expect(response.status).toBe(401);
  });

  it("accepts voice-only published evidence only for an explicit legacy migration", async () => {
    const bindings = environment();
    const document = {
      runId: "legacy-run",
      status: "published",
      inputText: "Legacy evidence.",
      recipe: { source: { text: "Legacy evidence." } },
      events: [],
      artifacts: [],
      qaReport: { passed: true },
      voice: {
        storageId: "runs/legacy-run/voice.mp3",
        url: "https://soulloom.example/api/evidence/artifacts/legacy-run/voice.mp3",
        text: "Legacy evidence.",
        model: "eleven_multilingual_v2",
        source: "elevenlabs_generated",
      },
    };
    const url = "https://soulloom.example/api/evidence/runs/legacy-run";
    const normal = await handleCloudflareEvidenceRequest(
      authorizedJsonRequest(url, "PUT", document),
      bindings,
    );
    const migrationRequest = authorizedJsonRequest(url, "PUT", document);
    migrationRequest.headers.set("X-Soulloom-Legacy-Migration", "1");
    const migrated = await handleCloudflareEvidenceRequest(
      migrationRequest,
      bindings,
    );

    expect(normal.status).toBe(400);
    expect(migrated.status).toBe(200);
  });

  it("rejects malformed encoded run IDs without throwing", async () => {
    const response = await handleCloudflareEvidenceRequest(
      new Request("https://soulloom.example/api/evidence/runs/%"),
      environment(),
    );

    expect(response.status).toBe(404);
  });
});
