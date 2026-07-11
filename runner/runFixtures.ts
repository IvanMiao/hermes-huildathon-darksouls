import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HermesStudioManager } from "./studioManager";

interface FixtureScenario {
  id: string;
  input: string;
}

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));
const scenarios = JSON.parse(
  await readFile(join(fixtureDirectory, "fixtures/scenarios.json"), "utf8"),
) as FixtureScenario[];

const manager = new HermesStudioManager();
const fixtureBatch = Date.now().toString(36);
for (const scenario of scenarios) {
  const result = await manager.start(scenario.input, {
    runId: `fixture-${scenario.id}-${fixtureBatch}`,
  });
  console.log(`${scenario.id}: ${result.status} → ${result.runDirectory}`);
}
