import { existsSync } from "node:fs";
import { mirrorRunToConvex } from "./convexEvidence";
import { createStudioRuntime } from "./runtime";
import { createStudioApiServer, type CompletedStudioRun } from "./studioApiServer";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const port = Number.parseInt(process.env.SOULLOOM_RUNNER_PORT ?? "8787", 10);
const { agentMode, manager } = createStudioRuntime();
async function produce(inputText: string): Promise<CompletedStudioRun> {
  const result = await manager.start(inputText);
  let convexEvidence: "disabled" | "mirrored" | "failed" = "disabled";
  try {
    convexEvidence = (await mirrorRunToConvex(result)).mode;
  } catch (error) {
    convexEvidence = "failed";
    console.error(`Convex evidence mirror failed: ${
      error instanceof Error ? error.message : String(error)
    }`);
  }
  const fallbacks = result.artifacts.filter(({ source }) => (
    source.mode === "cached_fallback" || source.mode === "default_fallback"
  )).length;
  return {
    runId: result.runId,
    status: result.status,
    agentMode,
    qaPassed: result.qaReport.passed,
    fallbacks,
    convexEvidence,
    gameUrl: result.status === "published" ? `/games/${result.runId}` : null,
    controlRoomUrl: `/control-room/${result.runId}`,
  };
}

const { server } = createStudioApiServer({
  agentMode,
  apiToken: process.env.SOULLOOM_RUNNER_API_TOKEN,
  produce,
  logError: console.error,
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Soulloom Hermes runner listening on http://127.0.0.1:${port} (${agentMode}).`);
  if (!process.env.SOULLOOM_RUNNER_API_TOKEN) {
    console.warn("SOULLOOM_RUNNER_API_TOKEN is unset; use this mode only for loopback development.");
  }
});
