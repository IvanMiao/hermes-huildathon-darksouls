import { existsSync } from "node:fs";
import { mirrorRunToConvex } from "./convexEvidence";
import { createStudioRuntime } from "./runtime";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const inputText = process.argv.slice(2).join(" ").trim();
if (!inputText) {
  console.error('Usage: npm run studio -- "your tweet text"');
  process.exitCode = 1;
} else {
  const { agentMode, manager } = createStudioRuntime();
  const result = await manager.start(inputText);
  let evidence: "disabled" | "mirrored" | "failed" = "disabled";
  try {
    evidence = (await mirrorRunToConvex(result)).mode;
  } catch (error) {
    evidence = "failed";
    console.error(`Convex evidence mirror failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const retries = result.events.filter(({ type }) => type === "retry_routed");
  const fallbacks = result.artifacts
    .filter(({ source }) => source.mode.endsWith("fallback"))
    .map(({ actor, kind, source }) => ({
      actor,
      kind,
      reason: source.fallbackReason,
    }));
  console.log(JSON.stringify({
    runId: result.runId,
    status: result.status,
    agentMode,
    runDirectory: result.runDirectory,
    archetype: result.recipe.archetype,
    boss: `${result.recipe.boss.boss.name}, ${result.recipe.boss.boss.title}`,
    qaPassed: result.qaReport.passed,
    convexEvidence: evidence,
    retries: retries.map(({ owner }) => owner),
    fallbacks,
  }, null, 2));
}
