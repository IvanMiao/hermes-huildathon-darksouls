import { HermesStudioManager } from "./studioManager";

const inputText = process.argv.slice(2).join(" ").trim();
if (!inputText) {
  console.error('Usage: npm run studio -- "I smell fear."');
  process.exitCode = 1;
} else {
  const result = await new HermesStudioManager().start(inputText);
  const retries = result.events.filter(({ type }) => type === "retry_routed");
  console.log(JSON.stringify({
    runId: result.runId,
    status: result.status,
    runDirectory: result.runDirectory,
    archetype: result.recipe.archetype,
    boss: `${result.recipe.boss.boss.name}, ${result.recipe.boss.boss.title}`,
    qaPassed: result.qaReport.passed,
    retries: retries.map(({ owner }) => owner),
  }, null, 2));
}
