import { describe, expect, it, vi } from "vitest";
import { startStudioRun } from "./studioApi";

const result = {
  runId: "live-run",
  status: "published" as const,
  gameUrl: "/games/live-run",
  controlRoomUrl: "/control-room/live-run",
};

describe("Studio API client", () => {
  it("polls an accepted production until Hermes completes", async () => {
    const requestId = "12345678-1234-1234-1234-123456789abc";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({
        requestId,
        state: "queued",
        statusUrl: `/api/studio/runs/${requestId}`,
      }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({
        requestId,
        state: "running",
        statusUrl: `/api/studio/runs/${requestId}`,
      }))
      .mockResolvedValueOnce(Response.json({
        requestId,
        state: "completed",
        statusUrl: `/api/studio/runs/${requestId}`,
        result,
      }));
    const states: string[] = [];

    await expect(startStudioRun("I smell fear.", {
      fetcher,
      pollIntervalMs: 0,
      onStateChange: (state) => states.push(state),
    })).resolves.toEqual(result);

    expect(states).toEqual(["queued", "running"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const firstRequest = fetcher.mock.calls[0];
    expect(firstRequest?.[0]).toBe("/api/studio/runs");
    expect(new Headers(firstRequest?.[1]?.headers).get("idempotency-key")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("surfaces a failed job and accepts the old synchronous response", async () => {
    const requestId = "12345678-1234-1234-1234-123456789abc";
    const failedFetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({
        requestId,
        state: "queued",
        statusUrl: `/api/studio/runs/${requestId}`,
      }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({
        requestId,
        state: "failed",
        statusUrl: `/api/studio/runs/${requestId}`,
        error: "Hermes could not start.",
      }));
    await expect(startStudioRun("I smell fear.", {
      fetcher: failedFetcher,
      pollIntervalMs: 0,
    })).rejects.toThrow("Hermes could not start.");

    const synchronousFetcher = vi.fn(async () => Response.json(result, { status: 201 }));
    await expect(startStudioRun("I smell fear.", {
      fetcher: synchronousFetcher,
    })).resolves.toEqual(result);
  });
});
