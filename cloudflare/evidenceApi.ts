import type {
  MusicArtifactData,
  StudioRunResult,
  VoiceArtifactData,
} from "../runner/contracts";
import type { GameRecipeV0 } from "../src/game-recipe/types";
import {
  generateMusicAudio,
  generateVoiceAudio,
  type BossMusicDirection,
} from "./audioGeneration";

const SAFE_RUN_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const MAX_JSON_CHARACTERS = 2_000_000;
const AUDIO_CACHE_CONTROL = "public, max-age=31536000, immutable";

type D1Value = string | number | null;

export interface D1ResultLike {
  success: boolean;
}

export interface D1PreparedStatementLike {
  bind(...values: D1Value[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  run(): Promise<D1ResultLike>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface R2ObjectBodyLike {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  range?: { offset: number; length: number };
  writeHttpMetadata(headers: Headers): void;
}

export interface R2BucketLike {
  get(
    key: string,
    options?: { range?: Headers },
  ): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
    },
  ): Promise<unknown>;
}

export interface CloudflareEvidenceEnvironment {
  SOULLOOM_DB?: D1DatabaseLike;
  SOULLOOM_ARTIFACTS?: R2BucketLike;
  STUDIO_INTEGRATION_TOKEN?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
}

interface StoredRunRow {
  run_id: string;
  status: "published" | "release_blocked";
  input_text: string;
  recipe_json: string;
  events_json: string;
  artifacts_json: string;
  qa_report_json: string;
  voice_json: string | null;
  music_json: string | null;
  mirrored_at: number;
}

interface StoredAudioRow {
  voice_json: string | null;
  music_json: string | null;
}

interface RunDocument extends Omit<StudioRunResult, "runDirectory"> {
  inputText: string;
  voice?: VoiceArtifactData;
  music?: MusicArtifactData;
}

interface AudioRequest {
  voiceText: string;
  direction: BossMusicDirection;
}

type ProviderFetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface EvidenceApiOptions {
  providerFetcher?: ProviderFetcher;
  now?: () => number;
}

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function decodePathSegment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function toVoiceEvidence(value: unknown): VoiceArtifactData | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.storageId !== "string"
    || typeof value.url !== "string"
    || typeof value.text !== "string"
    || value.model !== "eleven_multilingual_v2"
    || value.source !== "elevenlabs_generated"
  ) {
    return undefined;
  }
  return {
    storageId: value.storageId,
    url: value.url,
    text: value.text,
    model: "eleven_multilingual_v2",
    source: "elevenlabs_generated",
    ...(optionalString(value.requestId) ? { requestId: String(value.requestId) } : {}),
    ...(optionalString(value.traceId) ? { traceId: String(value.traceId) } : {}),
    ...(typeof value.characterCost === "number"
      ? { characterCost: value.characterCost }
      : {}),
  };
}

export function toMusicEvidence(value: unknown): MusicArtifactData | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.storageId !== "string"
    || typeof value.url !== "string"
    || typeof value.durationMs !== "number"
    || value.model !== "music_v2"
    || value.source !== "elevenlabs_generated"
    || !isRecord(value.compositionPlan)
  ) {
    return undefined;
  }
  return {
    storageId: value.storageId,
    url: value.url,
    durationMs: value.durationMs,
    model: "music_v2",
    source: "elevenlabs_generated",
    compositionPlan: value.compositionPlan,
    ...(isRecord(value.direction) ? { direction: value.direction } : {}),
    ...(optionalString(value.songId) ? { songId: String(value.songId) } : {}),
    ...(optionalString(value.requestId) ? { requestId: String(value.requestId) } : {}),
    ...(optionalString(value.traceId) ? { traceId: String(value.traceId) } : {}),
  };
}

async function readJson(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > MAX_JSON_CHARACTERS) {
    throw new Error("Request body is too large.");
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function toAudioRequest(value: unknown): AudioRequest | null {
  if (!isRecord(value) || typeof value.voiceText !== "string") return null;
  if (value.voiceText.length === 0 || value.voiceText.length > 500) return null;
  const direction = value.direction;
  if (!isRecord(direction)) return null;
  if (
    typeof direction.bossName !== "string"
    || typeof direction.bossTitle !== "string"
    || typeof direction.motif !== "string"
    || !["watchful", "oppressive", "ceremonial"].includes(String(direction.cameraMood))
    || !["duel", "procession", "revelation"].includes(String(direction.archetype))
    || !["gothic-library", "ruined-cathedral", "void-sanctum"].includes(String(direction.arenaTheme))
  ) {
    return null;
  }
  return {
    voiceText: value.voiceText,
    direction: direction as unknown as BossMusicDirection,
  };
}

function toRunDocument(
  value: unknown,
  runId: string,
  allowLegacyPublishedWithoutMusic = false,
): RunDocument | null {
  if (!isRecord(value)) return null;
  if (
    value.runId !== runId
    || (value.status !== "published" && value.status !== "release_blocked")
    || typeof value.inputText !== "string"
    || value.inputText.length === 0
    || value.inputText.length > 2_000
    || !isRecord(value.recipe)
    || !Array.isArray(value.events)
    || !Array.isArray(value.artifacts)
    || !isRecord(value.qaReport)
  ) {
    return null;
  }
  const voice = toVoiceEvidence(value.voice);
  const music = toMusicEvidence(value.music);
  if (
    value.status === "published"
    && (!voice || (!music && !allowLegacyPublishedWithoutMusic))
  ) {
    return null;
  }
  return {
    runId,
    status: value.status,
    inputText: value.inputText,
    recipe: value.recipe as unknown as GameRecipeV0,
    events: value.events as RunDocument["events"],
    artifacts: value.artifacts as RunDocument["artifacts"],
    qaReport: value.qaReport as unknown as RunDocument["qaReport"],
    ...(voice ? { voice } : {}),
    ...(music ? { music } : {}),
  };
}

function parseJson(value: string | null): unknown {
  if (value === null) return undefined;
  return JSON.parse(value) as unknown;
}

function toPublicRun(row: StoredRunRow): unknown {
  return {
    runId: row.run_id,
    status: row.status,
    inputText: row.input_text,
    recipe: parseJson(row.recipe_json),
    events: parseJson(row.events_json),
    artifacts: parseJson(row.artifacts_json),
    qaReport: parseJson(row.qa_report_json),
    voice: parseJson(row.voice_json),
    music: parseJson(row.music_json),
    mirroredAt: row.mirrored_at,
  };
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return token.length > 0 ? token : null;
}

async function tokenMatches(actual: string | null, expected: string): Promise<boolean> {
  if (!actual) return false;
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  return actualBytes.every((byte, index) => byte === expectedBytes[index]);
}

function artifactKey(runId: string, filename: "voice.mp3" | "music.mp3"): string {
  return `runs/${runId}/${filename}`;
}

function artifactUrl(request: Request, runId: string, filename: string): string {
  return new URL(
    `/api/evidence/artifacts/${encodeURIComponent(runId)}/${filename}`,
    request.url,
  ).toString();
}

async function readStoredAudio(
  database: D1DatabaseLike,
  runId: string,
): Promise<{ voice?: VoiceArtifactData; music?: MusicArtifactData }> {
  const row = await database.prepare(
    "SELECT voice_json, music_json FROM generated_audio WHERE run_id = ?1 LIMIT 1",
  ).bind(runId).first<StoredAudioRow>();
  if (!row) return {};
  return {
    voice: toVoiceEvidence(parseJson(row.voice_json)),
    music: toMusicEvidence(parseJson(row.music_json)),
  };
}

async function saveGeneratedAudio(
  database: D1DatabaseLike,
  runId: string,
  kind: "voice" | "music",
  evidence: VoiceArtifactData | MusicArtifactData,
  now: number,
): Promise<void> {
  const column = kind === "voice" ? "voice_json" : "music_json";
  await database.prepare(`
    INSERT INTO generated_audio (run_id, ${column}, updated_at)
    VALUES (?1, ?2, ?3)
    ON CONFLICT(run_id) DO UPDATE SET
      ${column} = excluded.${column},
      updated_at = excluded.updated_at
  `).bind(runId, JSON.stringify(evidence), now).run();
}

async function generateAudio(
  request: Request,
  environment: Required<Pick<
    CloudflareEvidenceEnvironment,
    "SOULLOOM_DB" | "SOULLOOM_ARTIFACTS" | "ELEVENLABS_API_KEY" | "ELEVENLABS_VOICE_ID"
  >>,
  runId: string,
  input: AudioRequest,
  options: EvidenceApiOptions,
): Promise<Response> {
  const providerFetcher = options.providerFetcher ?? fetch;
  const now = options.now ?? Date.now;
  let { voice, music } = await readStoredAudio(environment.SOULLOOM_DB, runId);

  if (!voice) {
    const generated = await generateVoiceAudio(
      environment.ELEVENLABS_API_KEY,
      environment.ELEVENLABS_VOICE_ID,
      input.voiceText,
      providerFetcher,
    );
    const key = artifactKey(runId, "voice.mp3");
    await environment.SOULLOOM_ARTIFACTS.put(key, generated.bytes, {
      httpMetadata: {
        contentType: generated.contentType,
        cacheControl: AUDIO_CACHE_CONTROL,
      },
    });
    voice = {
      storageId: key,
      url: artifactUrl(request, runId, "voice.mp3"),
      ...generated.evidence,
    };
    await saveGeneratedAudio(environment.SOULLOOM_DB, runId, "voice", voice, now());
  }

  if (!music) {
    const generated = await generateMusicAudio(
      environment.ELEVENLABS_API_KEY,
      input.direction,
      { fetcher: providerFetcher },
    );
    const key = artifactKey(runId, "music.mp3");
    await environment.SOULLOOM_ARTIFACTS.put(key, generated.bytes, {
      httpMetadata: {
        contentType: generated.contentType,
        cacheControl: AUDIO_CACHE_CONTROL,
      },
    });
    music = {
      storageId: key,
      url: artifactUrl(request, runId, "music.mp3"),
      ...generated.evidence,
    };
    await saveGeneratedAudio(environment.SOULLOOM_DB, runId, "music", music, now());
  }

  return jsonResponse(200, { voice, music });
}

async function storeRun(
  database: D1DatabaseLike,
  document: RunDocument,
  now: number,
): Promise<Response> {
  await database.prepare(`
    INSERT INTO studio_runs (
      run_id, status, input_text, recipe_json, events_json, artifacts_json,
      qa_report_json, voice_json, music_json, mirrored_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    ON CONFLICT(run_id) DO UPDATE SET
      status = excluded.status,
      input_text = excluded.input_text,
      recipe_json = excluded.recipe_json,
      events_json = excluded.events_json,
      artifacts_json = excluded.artifacts_json,
      qa_report_json = excluded.qa_report_json,
      voice_json = excluded.voice_json,
      music_json = excluded.music_json,
      mirrored_at = excluded.mirrored_at
  `).bind(
    document.runId,
    document.status,
    document.inputText,
    JSON.stringify(document.recipe),
    JSON.stringify(document.events),
    JSON.stringify(document.artifacts),
    JSON.stringify(document.qaReport),
    document.voice ? JSON.stringify(document.voice) : null,
    document.music ? JSON.stringify(document.music) : null,
    now,
  ).run();
  return jsonResponse(200, { mode: "mirrored", runId: document.runId });
}

async function serveArtifact(
  request: Request,
  bucket: R2BucketLike,
  runId: string,
  filename: "voice.mp3" | "music.mp3",
): Promise<Response> {
  const rangeRequested = request.headers.has("range");
  const key = artifactKey(runId, filename);
  const object = rangeRequested
    ? await bucket.get(key, { range: request.headers })
    : await bucket.get(key);
  if (!object) return jsonResponse(404, { error: "Artifact not found." });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  if (rangeRequested && object.range) {
    const end = object.range.offset + object.range.length - 1;
    headers.set("Content-Range", `bytes ${object.range.offset}-${end}/${object.size}`);
    headers.set("Content-Length", String(object.range.length));
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(object.body, {
    status: rangeRequested && object.range ? 206 : 200,
    headers,
  });
}

async function uploadArtifact(
  request: Request,
  bucket: R2BucketLike,
  runId: string,
  filename: "voice.mp3" | "music.mp3",
): Promise<Response> {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return jsonResponse(400, { error: "Artifact body is empty." });
  }
  const key = artifactKey(runId, filename);
  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType: request.headers.get("content-type") ?? "audio/mpeg",
      cacheControl: AUDIO_CACHE_CONTROL,
    },
  });
  return jsonResponse(200, {
    storageId: key,
    url: artifactUrl(request, runId, filename),
  });
}

export async function handleCloudflareEvidenceRequest(
  request: Request,
  environment: CloudflareEvidenceEnvironment,
  options: EvidenceApiOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  const runMatch = url.pathname.match(/^\/api\/evidence\/runs\/([^/]+)$/);
  const audioMatch = url.pathname.match(/^\/api\/evidence\/runs\/([^/]+)\/audio$/);
  const artifactMatch = url.pathname.match(
    /^\/api\/evidence\/artifacts\/([^/]+)\/(voice\.mp3|music\.mp3)$/,
  );
  const encodedRunId = runMatch?.[1] ?? audioMatch?.[1] ?? artifactMatch?.[1];
  const runId = decodePathSegment(encodedRunId);
  if (!runId || !SAFE_RUN_ID.test(runId)) {
    return jsonResponse(404, { error: "Not found." });
  }

  if (!environment.SOULLOOM_DB || !environment.SOULLOOM_ARTIFACTS) {
    return jsonResponse(503, { error: "Cloudflare evidence storage is not configured." });
  }

  if (request.method === "GET" && artifactMatch?.[2]) {
    return serveArtifact(
      request,
      environment.SOULLOOM_ARTIFACTS,
      runId,
      artifactMatch[2] as "voice.mp3" | "music.mp3",
    );
  }

  if (request.method === "GET" && runMatch) {
    const row = await environment.SOULLOOM_DB.prepare(`
      SELECT run_id, status, input_text, recipe_json, events_json, artifacts_json,
        qa_report_json, voice_json, music_json, mirrored_at
      FROM studio_runs
      WHERE run_id = ?1
      LIMIT 1
    `).bind(runId).first<StoredRunRow>();
    return row
      ? jsonResponse(200, toPublicRun(row))
      : jsonResponse(404, { error: "Studio run not found." });
  }

  if (!environment.STUDIO_INTEGRATION_TOKEN) {
    return jsonResponse(503, { error: "Cloudflare evidence writes are not configured." });
  }
  if (!await tokenMatches(bearerToken(request), environment.STUDIO_INTEGRATION_TOKEN)) {
    return jsonResponse(401, { error: "Unauthorized." });
  }

  if (request.method === "PUT" && artifactMatch?.[2]) {
    return uploadArtifact(
      request,
      environment.SOULLOOM_ARTIFACTS,
      runId,
      artifactMatch[2] as "voice.mp3" | "music.mp3",
    );
  }

  if (request.method === "POST" && audioMatch) {
    if (!environment.ELEVENLABS_API_KEY || !environment.ELEVENLABS_VOICE_ID) {
      return jsonResponse(503, { error: "ElevenLabs credentials are not configured." });
    }
    try {
      const input = toAudioRequest(await readJson(request));
      if (!input) return jsonResponse(400, { error: "Invalid audio generation request." });
      return await generateAudio(
        request,
        {
          SOULLOOM_DB: environment.SOULLOOM_DB,
          SOULLOOM_ARTIFACTS: environment.SOULLOOM_ARTIFACTS,
          ELEVENLABS_API_KEY: environment.ELEVENLABS_API_KEY,
          ELEVENLABS_VOICE_ID: environment.ELEVENLABS_VOICE_ID,
        },
        runId,
        input,
        options,
      );
    } catch (error) {
      console.error("Cloudflare audio generation failed", error);
      return jsonResponse(502, { error: "Audio generation failed." });
    }
  }

  if (request.method === "PUT" && runMatch) {
    try {
      const document = toRunDocument(
        await readJson(request),
        runId,
        request.headers.get("x-soulloom-legacy-migration") === "1",
      );
      if (!document) return jsonResponse(400, { error: "Invalid studio run document." });
      return await storeRun(
        environment.SOULLOOM_DB,
        document,
        (options.now ?? Date.now)(),
      );
    } catch (error) {
      return jsonResponse(400, {
        error: error instanceof Error ? error.message : "Invalid studio run document.",
      });
    }
  }

  return jsonResponse(404, { error: "Not found." });
}
