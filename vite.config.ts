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

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const apiToken = process.env.SOULLOOM_RUNNER_API_TOKEN
    ?? environment.SOULLOOM_RUNNER_API_TOKEN;

  return {
    base: "/",
    server: {
      proxy: {
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
