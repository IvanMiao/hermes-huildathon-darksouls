import { describe, expect, it, vi } from "vitest";
import { routeCloudflareRequest } from "./appRouter";

describe("Cloudflare Pages app router", () => {
  it("keeps evidence routes inside Cloudflare storage", async () => {
    const runnerFetcher = vi.fn();
    const response = await routeCloudflareRequest(
      new Request("https://soulloom.pages.dev/api/evidence/runs/run-one"),
      {},
      { runnerFetcher },
    );

    expect(response.status).toBe(503);
    expect(runnerFetcher).not.toHaveBeenCalled();
  });

  it("continues to proxy runner routes through the protected Tunnel", async () => {
    const runnerFetcher = vi.fn(async () => Response.json({ status: "ok" }));
    const response = await routeCloudflareRequest(
      new Request("https://soulloom.pages.dev/api/health"),
      {
        STUDIO_RUNNER_ORIGIN: "https://runner.example.com",
        STUDIO_RUNNER_API_TOKEN: "runner-token",
      },
      { runnerFetcher },
    );

    expect(response.status).toBe(200);
    expect(runnerFetcher).toHaveBeenCalledOnce();
  });
});
