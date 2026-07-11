import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createStudioApiServer,
  type CompletedStudioRun,
  type StudioApiServer,
  type StudioJobView,
} from "./studioApiServer";

const servers: StudioApiServer[] = [];

const publishedRun: CompletedStudioRun = {
  runId: "live-run",
  status: "published",
  agentMode: "hermes",
  qaPassed: true,
  fallbacks: 0,
  convexEvidence: "mirrored",
  gameUrl: "/games/live-run",
  controlRoomUrl: "/control-room/live-run",
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map(({ close }) => close()));
});

async function startServer(
  produce: (inputText: string) => Promise<CompletedStudioRun>,
  apiToken?: string,
): Promise<string> {
  const studioServer = createStudioApiServer({
    agentMode: "hermes",
    apiToken,
    produce,
  });
  servers.push(studioServer);
  await new Promise<void>((resolveListen) => {
    studioServer.server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = studioServer.server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function waitForCompletedJob(baseUrl: string, statusUrl: string): Promise<StudioJobView> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}${statusUrl}`);
    const body = await response.json() as StudioJobView;
    if (body.state === "completed" || body.state === "failed") return body;
    await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  }
  throw new Error("Studio job did not complete in time.");
}

describe("studio runner HTTP API", () => {
  it("accepts a job asynchronously and exposes its completed result", async () => {
    const produce = vi.fn(async (inputText: string) => ({
      ...publishedRun,
      runId: inputText,
    }));
    const baseUrl = await startServer(produce);

    const startResponse = await fetch(`${baseUrl}/api/studio/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "request-key-1234",
      },
      body: JSON.stringify({ inputText: "A clock refuses midnight." }),
    });
    expect(startResponse.status).toBe(202);
    const accepted = await startResponse.json() as StudioJobView;
    expect(accepted).toMatchObject({ state: "queued" });

    const completed = await waitForCompletedJob(baseUrl, accepted.statusUrl);
    expect(completed).toMatchObject({
      state: "completed",
      result: { runId: "A clock refuses midnight.", status: "published" },
    });
    expect(produce).toHaveBeenCalledOnce();
  });

  it("returns the same job for a repeated idempotency key", async () => {
    const produce = vi.fn(async () => publishedRun);
    const baseUrl = await startServer(produce);
    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "same-request-key",
      },
      body: JSON.stringify({ inputText: "A clock refuses midnight." }),
    } as const;

    const first = await fetch(`${baseUrl}/api/studio/runs`, request);
    const firstBody = await first.json() as StudioJobView;
    const repeated = await fetch(`${baseUrl}/api/studio/runs`, request);
    const repeatedBody = await repeated.json() as StudioJobView;

    expect(repeated.status).toBe(200);
    expect(repeatedBody.requestId).toBe(firstBody.requestId);
    await waitForCompletedJob(baseUrl, firstBody.statusUrl);
    expect(produce).toHaveBeenCalledOnce();
  });

  it("rejects concurrent jobs and allows health checks without credentials", async () => {
    let resolveProduction: ((result: CompletedStudioRun) => void) | undefined;
    const production = new Promise<CompletedStudioRun>((resolve) => {
      resolveProduction = resolve;
    });
    const baseUrl = await startServer(() => production, "secret-token");
    const headers = {
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    };

    const first = await fetch(`${baseUrl}/api/studio/runs`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "first-request-key" },
      body: JSON.stringify({ inputText: "First" }),
    });
    const firstBody = await first.json() as StudioJobView;
    await fetch(`${baseUrl}${firstBody.statusUrl}`, { headers });

    const second = await fetch(`${baseUrl}/api/studio/runs`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": "second-request-key" },
      body: JSON.stringify({ inputText: "Second" }),
    });
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("5");

    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({ busy: true, agentMode: "hermes" });
    resolveProduction?.(publishedRun);
    await waitForCompletedJobWithToken(baseUrl, firstBody.statusUrl, "secret-token");
  });

  it("requires the configured bearer token and validates input boundaries", async () => {
    const baseUrl = await startServer(async () => publishedRun, "secret-token");
    const unauthorized = await fetch(`${baseUrl}/api/studio/runs`, {
      method: "POST",
      headers: { "Idempotency-Key": "request-key-1234" },
      body: JSON.stringify({ inputText: "Hello" }),
    });
    expect(unauthorized.status).toBe(401);

    const invalid = await fetch(`${baseUrl}/api/studio/runs`, {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Idempotency-Key": "request-key-1234",
      },
      body: JSON.stringify({ inputText: " " }),
    });
    expect(invalid.status).toBe(400);
  });
});

async function waitForCompletedJobWithToken(
  baseUrl: string,
  statusUrl: string,
  token: string,
): Promise<StudioJobView> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`${baseUrl}${statusUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as StudioJobView;
    if (body.state === "completed" || body.state === "failed") return body;
    await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  }
  throw new Error("Studio job did not complete in time.");
}
