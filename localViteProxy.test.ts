import { describe, expect, it } from "vitest";
import {
  createLocalApiProxy,
  createLocalEvidenceProxy,
} from "./vite.config";

describe("local Vite API proxy", () => {
  it("keeps the runner token on the server and injects it as a bearer header", () => {
    const proxy = createLocalApiProxy("shared-runner-token");

    expect(proxy).toMatchObject({
      target: "http://127.0.0.1:8787",
      headers: { Authorization: "Bearer shared-runner-token" },
    });
  });

  it("does not send an authorization header when local auth is disabled", () => {
    const proxy = createLocalApiProxy();

    expect(proxy.headers).toBeUndefined();
  });

  it("routes local evidence reads to the configured Pages deployment", () => {
    expect(createLocalEvidenceProxy("https://soulloom.pages.dev/")).toEqual({
      target: "https://soulloom.pages.dev",
      changeOrigin: true,
    });
    expect(createLocalEvidenceProxy()).toBeUndefined();
  });
});
