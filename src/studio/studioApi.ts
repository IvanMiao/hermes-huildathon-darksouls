import type {
  AnyArtifactEnvelope,
  StudioEvent,
} from "../../runner/contracts";

export interface StartStudioRunResponse {
  runId: string;
  status: "published" | "release_blocked";
  qaPassed?: boolean;
  convexEvidence?: "disabled" | "mirrored" | "failed";
  gameUrl: string | null;
  controlRoomUrl: string;
}

export type StudioJobState = "queued" | "running" | "completed" | "failed";

export interface StudioJobResponse {
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
  result?: StartStudioRunResponse;
  error?: string;
}

export interface StartStudioRunOptions {
  fetcher?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onStateChange?: (state: "queued" | "running") => void;
}

const STATUS_URL_PATTERN = /^\/api\/studio\/runs\/[0-9a-f-]{36}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStartStudioRunResponse(value: unknown): value is StartStudioRunResponse {
  if (!isRecord(value)) return false;
  return typeof value.runId === "string"
    && (value.status === "published" || value.status === "release_blocked")
    && (typeof value.gameUrl === "string" || value.gameUrl === null)
    && typeof value.controlRoomUrl === "string";
}

function isStudioJobResponse(value: unknown): value is StudioJobResponse {
  if (!isRecord(value)) return false;
  return typeof value.requestId === "string"
    && typeof value.runId === "string"
    && typeof value.inputText === "string"
    && ["queued", "running", "completed", "failed"].includes(String(value.state))
    && typeof value.statusUrl === "string"
    && typeof value.controlRoomUrl === "string"
    && typeof value.submittedAt === "string"
    && typeof value.updatedAt === "string"
    && Array.isArray(value.events)
    && Array.isArray(value.artifacts);
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === "string" ? body.error : fallback;
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolveWait, rejectWait) => {
    if (signal?.aborted) {
      rejectWait(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeout = globalThis.setTimeout(resolveWait, milliseconds);
    signal?.addEventListener("abort", () => {
      globalThis.clearTimeout(timeout);
      rejectWait(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function startStudioRun(
  inputText: string,
  options: StartStudioRunOptions = {},
): Promise<StartStudioRunResponse> {
  const fetcher = options.fetcher ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const timeoutMs = options.timeoutMs ?? 3 * 60_000;
  const startedAt = Date.now();
  let job = await createStudioRun(inputText, {
    fetcher,
    signal: options.signal,
  });
  if (job.state === "completed" && job.result) return job.result;

  while (true) {
    if (job.state === "completed") {
      if (!isStartStudioRunResponse(job.result)) {
        throw new Error("The completed Hermes job has no valid production result.");
      }
      return job.result;
    }
    if (job.state === "failed") {
      throw new Error(job.error ?? "The Hermes production failed.");
    }
    options.onStateChange?.(job.state);
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error("Hermes production timed out. The job may still be running in the Studio.");
    }
    await wait(pollIntervalMs, options.signal);
    job = await readStudioJob(job.statusUrl, {
      fetcher,
      signal: options.signal,
    });
  }
}

interface StudioRequestOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

export async function createStudioRun(
  inputText: string,
  options: StudioRequestOptions = {},
): Promise<StudioJobResponse> {
  const fetcher = options.fetcher ?? fetch;
  const idempotencyKey = crypto.randomUUID();
  const startResponse = await fetcher("/api/studio/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ inputText }),
    signal: options.signal,
  });
  const acceptedBody = await responseBody(startResponse);
  if (!startResponse.ok) {
    throw new Error(errorMessage(acceptedBody, "The Hermes runner rejected this production."));
  }
  // Accept the original synchronous server response during rolling deployments.
  if (isStartStudioRunResponse(acceptedBody)) {
    const timestamp = new Date().toISOString();
    return {
      requestId: acceptedBody.runId,
      runId: acceptedBody.runId,
      inputText,
      state: "completed",
      statusUrl: "",
      controlRoomUrl: acceptedBody.controlRoomUrl,
      submittedAt: timestamp,
      updatedAt: timestamp,
      events: [],
      artifacts: [],
      result: acceptedBody,
    };
  }
  if (!isStudioJobResponse(acceptedBody) || !STATUS_URL_PATTERN.test(acceptedBody.statusUrl)) {
    throw new Error("The Hermes runner returned an invalid job response.");
  }
  return acceptedBody;
}

export async function readStudioJob(
  statusUrl: string,
  options: StudioRequestOptions = {},
): Promise<StudioJobResponse> {
  if (!STATUS_URL_PATTERN.test(statusUrl)) {
    throw new Error("The Hermes runner returned an invalid status URL.");
  }
  const fetcher = options.fetcher ?? fetch;
  const statusResponse = await fetcher(statusUrl, {
      headers: { Accept: "application/json" },
      signal: options.signal,
  });
  const statusBody = await responseBody(statusResponse);
  if (!statusResponse.ok || !isStudioJobResponse(statusBody)) {
    throw new Error(errorMessage(statusBody, "Could not read the Hermes production status."));
  }
  return statusBody;
}

export interface StudioJobStreamOptions {
  onSnapshot: (job: StudioJobResponse) => void;
  onError: () => void;
}

/** Subscribes to same-origin runner snapshots without exposing runner credentials. */
export function streamStudioJob(
  statusUrl: string,
  options: StudioJobStreamOptions,
): () => void {
  if (!STATUS_URL_PATTERN.test(statusUrl)) {
    throw new Error("The Hermes runner returned an invalid status URL.");
  }
  const source = new EventSource(`${statusUrl}/stream`);
  let closed = false;
  source.addEventListener("snapshot", (event) => {
    let value: unknown;
    try {
      value = JSON.parse((event as MessageEvent<string>).data) as unknown;
    } catch {
      return;
    }
    if (!isStudioJobResponse(value)) return;
    options.onSnapshot(value);
    if (value.state === "completed" || value.state === "failed") {
      closed = true;
      source.close();
    }
  });
  source.addEventListener("error", () => {
    if (closed) return;
    closed = true;
    source.close();
    options.onError();
  });
  return () => {
    closed = true;
    source.close();
  };
}
