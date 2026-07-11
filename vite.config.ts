import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "runner/**/*.test.ts", "cloudflare/**/*.test.ts"],
  },
});
