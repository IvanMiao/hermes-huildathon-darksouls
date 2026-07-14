import { timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type {
  AnyArtifactEnvelope,
  StudioEvent,
} from "./contracts";

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_INPUT_CHARACTERS = 2_000;
const MAX_RETAINED_JOBS = 100;
const JOB_RETENTION_MS = 60 * 60 * 1_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/;

export type StudioAgentMode = "hermes" | "local";
export type StudioJobState = "queued" | "running" | "completed" | "failed";

export interface CompletedStudioRun {
  runId: string;
  status: "published" | "release_blocked";
  agentMode: StudioAgentMode;
  qaPassed: boolean;
  fallbacks: number;
  convexEvidence: "disabled" | "mirrored" | "failed";
  gameUrl: string | null;
  controlRoomUrl: string;
}

export interface StudioJobView {
  requestId: string;
  runId: string;
  inputText: string;
  state: StudioJobState;
  statusUrl: string;
  controlRoomUrl: string;
  submittedAt: string;
  updatedAt: string;
  events: StudioEvent[];
  artifacts: AnyArtifactEnvelope[];
  result?: CompletedStudioRun;
  error?: string;
}

interface StudioJob extends StudioJobView {
  idempotencyKey: string;
  expiresAt: number;
  subscribers: Set<ServerResponse>;
}

export interface StudioApiServerOptions {
  agentMode: StudioAgentMode;
  apiToken?: string;
  produce: (
    inputText: string,
    progress: StudioProductionProgress,
  ) => Promise<CompletedStudioRun>;
  now?: () => number;
  createRequestId?: () => string;
  logError?: (error: unknown) => void;
}

export interface StudioProductionProgress {
  runId: string;
  onEvent: (event: StudioEvent) => void;
  onArtifact: (artifact: AnyArtifactEnvelope) => void;
}

export interface StudioApiServer {
  server: Server;
  close: () => Promise<void>;
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Readonly<Record<string, string>> = {},
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.byteLength;
    if (receivedBytes > MAX_REQUEST_BYTES) {
      throw new Error("Request body exceeds 32 KB.");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function inputTextFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("inputText" in body)) {
    return null;
  }
  const inputText = (body as { inputText?: unknown }).inputText;
  if (typeof inputText !== "string") {
    return null;
  }
  const trimmed = inputText.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_INPUT_CHARACTERS
    ? trimmed
    : null;
}

function bearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  return token.length > 0 ? token : null;
}

function tokenMatches(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.byteLength === expectedBuffer.byteLength
    && timingSafeEqual(actualBuffer, expectedBuffer);
}

function publicJob(job: StudioJob): StudioJobView {
  return {
    requestId: job.requestId,
    runId: job.runId,
    inputText: job.inputText,
    state: job.state,
    statusUrl: job.statusUrl,
    controlRoomUrl: job.controlRoomUrl,
    submittedAt: job.submittedAt,
    updatedAt: job.updatedAt,
    events: structuredClone(job.events),
    artifacts: structuredClone(job.artifacts),
    ...(job.result ? { result: job.result } : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

function writeSnapshot(response: ServerResponse, job: StudioJob): void {
  if (!response.writableEnded && !response.destroyed) {
    response.write(`event: snapshot\ndata: ${JSON.stringify(publicJob(job))}\n\n`);
  }
}

export function createStudioApiServer(options: StudioApiServerOptions): StudioApiServer {
  const now = options.now ?? Date.now;
  const createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
  const jobs = new Map<string, StudioJob>();
  const requestsByIdempotencyKey = new Map<string, string>();
  let activeRequestId: string | null = null;

  function pruneJobs(): void {
    const currentTime = now();
    for (const [requestId, job] of jobs) {
      if (job.expiresAt <= currentTime && requestId !== activeRequestId) {
        jobs.delete(requestId);
        requestsByIdempotencyKey.delete(job.idempotencyKey);
      }
    }
    if (jobs.size <= MAX_RETAINED_JOBS) return;
    const completedJobs = [...jobs.values()]
      .filter((job) => job.requestId !== activeRequestId)
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    for (const job of completedJobs.slice(0, jobs.size - MAX_RETAINED_JOBS)) {
      jobs.delete(job.requestId);
      requestsByIdempotencyKey.delete(job.idempotencyKey);
    }
  }

  function updateJob(job: StudioJob, update: Partial<StudioJob>): void {
    Object.assign(job, update, {
      updatedAt: new Date(now()).toISOString(),
      expiresAt: now() + JOB_RETENTION_MS,
    });
    for (const subscriber of job.subscribers) {
      writeSnapshot(subscriber, job);
    }
  }

  async function produce(job: StudioJob, inputText: string): Promise<void> {
    activeRequestId = job.requestId;
    updateJob(job, { state: "running" });
    try {
      const result = await options.produce(inputText, {
        runId: job.runId,
        onEvent: (event) => {
          job.events.push(structuredClone(event));
          updateJob(job, {});
        },
        onArtifact: (artifact) => {
          job.artifacts.push(structuredClone(artifact));
          updateJob(job, {});
        },
      });
      updateJob(job, { state: "completed", result });
    } catch (error) {
      options.logError?.(error);
      updateJob(job, {
        state: "failed",
        error: "Studio production failed. Check the runner logs for details.",
      });
    } finally {
      activeRequestId = null;
      pruneJobs();
    }
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        agentMode: options.agentMode,
        busy: activeRequestId !== null,
      });
      return;
    }

    if (options.apiToken && !tokenMatches(bearerToken(request), options.apiToken)) {
      sendJson(response, 401, { error: "Unauthorized." }, {
        "WWW-Authenticate": "Bearer",
      });
      return;
    }

    const streamMatch = url.pathname.match(
      /^\/api\/studio\/runs\/([0-9a-f-]{36})\/stream$/,
    );
    if (request.method === "GET" && streamMatch?.[1] && JOB_ID_PATTERN.test(streamMatch[1])) {
      pruneJobs();
      const job = jobs.get(streamMatch[1]);
      if (!job) {
        sendJson(response, 404, { error: "Studio job not found." });
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      });
      response.flushHeaders();
      job.subscribers.add(response);
      writeSnapshot(response, job);
      request.once("close", () => {
        job.subscribers.delete(response);
      });
      return;
    }

    const jobMatch = url.pathname.match(/^\/api\/studio\/runs\/([0-9a-f-]{36})$/);
    if (request.method === "GET" && jobMatch?.[1] && JOB_ID_PATTERN.test(jobMatch[1])) {
      pruneJobs();
      const job = jobs.get(jobMatch[1]);
      if (!job) {
        sendJson(response, 404, { error: "Studio job not found." });
        return;
      }
      sendJson(response, 200, publicJob(job));
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/studio/runs") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    const idempotencyKey = request.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      sendJson(response, 400, {
        error: "Idempotency-Key must contain 8 to 128 letters, numbers, underscores, or hyphens.",
      });
      return;
    }

    pruneJobs();
    const existingRequestId = requestsByIdempotencyKey.get(idempotencyKey);
    const existingJob = existingRequestId ? jobs.get(existingRequestId) : undefined;
    if (existingJob) {
      sendJson(response, 200, publicJob(existingJob));
      return;
    }
    if (activeRequestId) {
      sendJson(response, 429, { error: "The Studio is already producing a run." }, {
        "Retry-After": "5",
      });
      return;
    }

    try {
      const inputText = inputTextFrom(await readJsonBody(request));
      if (!inputText) {
        sendJson(response, 400, {
          error: `inputText must contain 1 to ${MAX_INPUT_CHARACTERS.toLocaleString("en-US")} characters.`,
        });
        return;
      }
      const requestId = createRequestId();
      const timestamp = new Date(now()).toISOString();
      const job: StudioJob = {
        requestId,
        runId: requestId,
        inputText,
        idempotencyKey,
        state: "queued",
        statusUrl: `/api/studio/runs/${requestId}`,
        controlRoomUrl: `/control-room/${requestId}?job=1`,
        submittedAt: timestamp,
        updatedAt: timestamp,
        events: [],
        artifacts: [],
        expiresAt: now() + JOB_RETENTION_MS,
        subscribers: new Set(),
      };
      jobs.set(requestId, job);
      requestsByIdempotencyKey.set(idempotencyKey, requestId);
      activeRequestId = requestId;
      sendJson(response, 202, publicJob(job), { Location: job.statusUrl });
      setImmediate(() => void produce(job, inputText));
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Invalid request body.",
      });
    }
  });

  return {
    server,
    close: () => new Promise((resolveClose, rejectClose) => {
      for (const job of jobs.values()) {
        for (const subscriber of job.subscribers) subscriber.end();
        job.subscribers.clear();
      }
      server.close((error) => {
        if (error) rejectClose(error);
        else resolveClose();
      });
    }),
  };
}
