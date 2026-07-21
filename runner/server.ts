import { existsSync } from "node:fs";
import { mirrorRunToCloudflare } from "./cloudflareEvidence";
import { createStudioRuntime } from "./runtime";
import {
  createStudioApiServer,
  type CompletedStudioRun,
  type StudioProductionProgress,
} from "./studioApiServer";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const port = Number.parseInt(process.env.SOULLOOM_RUNNER_PORT ?? "8787", 10);
const { agentMode, manager } = createStudioRuntime();
async function produce(
  inputText: string,
  progress: StudioProductionProgress,
): Promise<CompletedStudioRun> {
  const result = await manager.start(inputText, {
    runId: progress.runId,
    onEvent: progress.onEvent,
    onArtifact: progress.onArtifact,
  });
  let cloudflareEvidence: "disabled" | "mirrored" | "failed" = "disabled";
  try {
    cloudflareEvidence = (await mirrorRunToCloudflare(result, {
      onEvent: progress.onEvent,
      onArtifact: progress.onArtifact,
    })).mode;
  } catch (error) {
    cloudflareEvidence = "failed";
    console.error(`Cloudflare evidence mirror failed: ${
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
    cloudflareEvidence,
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
