import { loadEnv, type ProxyOptions } from "vite";
import { defineConfig } from "vitest/config";

export function createLocalApiProxy(apiToken?: string): ProxyOptions {
  const token = apiToken?.trim();
  return {
    target: "http://127.0.0.1:8787",
    ...(token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {}),
  };
}

export function createLocalEvidenceProxy(evidenceUrl?: string): ProxyOptions | undefined {
  const target = evidenceUrl?.trim().replace(/\/$/, "");
  if (!target) return undefined;
  const protocol = new URL(target).protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new Error("CLOUDFLARE_EVIDENCE_URL must use HTTP or HTTPS.");
  }
  return {
    target,
    changeOrigin: true,
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const apiToken = process.env.SOULLOOM_RUNNER_API_TOKEN
    ?? environment.SOULLOOM_RUNNER_API_TOKEN;
  const evidenceProxy = createLocalEvidenceProxy(
    process.env.CLOUDFLARE_EVIDENCE_URL
      ?? environment.CLOUDFLARE_EVIDENCE_URL,
  );

  return {
    base: "/",
    server: {
      proxy: {
        ...(evidenceProxy ? { "/api/evidence": evidenceProxy } : {}),
        "/api": createLocalApiProxy(apiToken),
      },
    },
    test: {
      environment: "node",
      include: [
        "src/**/*.test.ts",
        "runner/**/*.test.ts",
        "cloudflare/**/*.test.ts",
        "localViteProxy.test.ts",
      ],
    },
  };
});
