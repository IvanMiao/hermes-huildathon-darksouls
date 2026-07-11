import { existsSync } from "node:fs";
import { HermesStudioManager } from "./studioManager";
import { mirrorRunToConvex } from "./convexEvidence";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const inputText = process.argv.slice(2).join(" ").trim();
if (!inputText) {
  console.error('Usage: npm run studio -- "your tweet text"');
  process.exitCode = 1;
} else {
  const result = await new HermesStudioManager().start(inputText);
  let evidence: "disabled" | "mirrored" | "failed" = "disabled";
  try {
    evidence = (await mirrorRunToConvex(result)).mode;
  } catch (error) {
    evidence = "failed";
    console.error(`Convex evidence mirror failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const retries = result.events.filter(({ type }) => type === "retry_routed");
  console.log(JSON.stringify({
    runId: result.runId,
    status: result.status,
    runDirectory: result.runDirectory,
    archetype: result.recipe.archetype,
    boss: `${result.recipe.boss.boss.name}, ${result.recipe.boss.boss.title}`,
    qaPassed: result.qaReport.passed,
    convexEvidence: evidence,
    retries: retries.map(({ owner }) => owner),
  }, null, 2));
}
