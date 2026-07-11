import { describe, expect, it, vi } from "vitest";
import { proxyRunnerRequest, type RunnerProxyEnvironment } from "./runnerProxy";

const environment: RunnerProxyEnvironment = {
  STUDIO_RUNNER_ORIGIN: "https://runner.example.com",
  STUDIO_RUNNER_API_TOKEN: "runner-secret",
  CF_ACCESS_CLIENT_ID: "access-id",
  CF_ACCESS_CLIENT_SECRET: "access-secret",
};

describe("Cloudflare runner proxy", () => {
  it("forwards only the production API contract with server-side credentials", async () => {
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json({ state: "queued" }, {
      status: 202,
      headers: { Location: "/api/studio/runs/request-id" },
    }));
    const request = new Request("https://soulloom.pages.dev/api/studio/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "request-key-1234",
      },
      body: JSON.stringify({ inputText: "A clock refuses midnight." }),
    });

    const response = await proxyRunnerRequest(request, environment, fetcher);

    expect(response.status).toBe(202);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://runner.example.com/api/studio/runs");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer runner-secret");
    expect(headers.get("cf-access-client-id")).toBe("access-id");
    expect(headers.get("cf-access-client-secret")).toBe("access-secret");
    expect(headers.get("idempotency-key")).toBe("request-key-1234");
  });

  it("fails closed when secrets are missing or the route is outside the allowlist", async () => {
    const unconfigured = await proxyRunnerRequest(
      new Request("https://soulloom.pages.dev/api/health"),
      {},
    );
    expect(unconfigured.status).toBe(503);

    const disallowed = await proxyRunnerRequest(
      new Request("https://soulloom.pages.dev/api/admin", { method: "POST" }),
      environment,
    );
    expect(disallowed.status).toBe(404);
  });

  it("passes the live event stream through without the JSON timeout contract", async () => {
    const fetcher = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response("event: snapshot\ndata: {}\n\n", {
      headers: { "Content-Type": "text/event-stream" },
    }));
    const response = await proxyRunnerRequest(
      new Request(
        "https://soulloom.pages.dev/api/studio/runs/12345678-1234-1234-1234-123456789abc/stream",
        { headers: { Accept: "text/event-stream" } },
      ),
      environment,
      fetcher,
    );

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("accept")).toBe("text/event-stream");
  });
});
