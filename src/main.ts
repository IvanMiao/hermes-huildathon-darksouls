import "./style.css";
import type { GameRecipeV0 } from "./game-recipe/types";

interface CloudflarePublishedRun {
  status: "published";
  recipe: GameRecipeV0;
}

function requireAppRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("Missing #app root container");
  }
  return root;
}

function requireGameContainer(): HTMLElement {
  const gameContainer = document.querySelector<HTMLElement>("#game");
  if (!gameContainer) {
    throw new Error("Missing #game scene container");
  }
  return gameContainer;
}

function routeRunId(prefix: string): string | null {
  const match = window.location.pathname.match(new RegExp(`^/${prefix}/([^/]+)/?$`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function mountGame(recipe: GameRecipeV0): Promise<void> {
  const [{ normalizeGameRecipe }, { createBattleScene }] = await Promise.all([
    import("./game-recipe/normalize"),
    import("./game/createBattleScene"),
  ]);
  createBattleScene(normalizeGameRecipe(recipe), requireGameContainer());
}

async function mountDefaultGame(): Promise<void> {
  const [{ DEMO_GAME_RECIPES }] = await Promise.all([
    import("./game-recipe/demoRecipes"),
  ]);
  const requestedArchetype = new URLSearchParams(window.location.search).get("recipe");
  const recipe = requestedArchetype === "procession" || requestedArchetype === "revelation"
    ? DEMO_GAME_RECIPES[requestedArchetype]
    : DEMO_GAME_RECIPES.duel;
  await mountGame(recipe);
}

async function mountStudio(): Promise<void> {
  const [, { mountStudioPage }] = await Promise.all([
    import("./studio/studio.css"),
    import("./studio/mountStudioPage"),
  ]);
  mountStudioPage(requireAppRoot());
}

async function mountControlRoom(runId: string): Promise<void> {
  if (new URLSearchParams(window.location.search).get("job") === "1") {
    const [, { mountLiveControlRoom }] = await Promise.all([
      import("./studio/studio.css"),
      import("./control-room/mountLiveControlRoom"),
    ]);
    mountLiveControlRoom(requireAppRoot(), runId);
    return;
  }
  const [, { findStudioRunFixture }, { mountControlRoom }, { mountReleaseGate }, { toLiveStudioRun }] = await Promise.all([
    import("./studio/studio.css"),
    import("./studio/fixtures"),
    import("./control-room/mountControlRoom"),
    import("./control-room/mountReleaseGate"),
    import("./studio/remoteRun"),
  ]);
  const fixture = findStudioRunFixture(runId);
  if (fixture) {
    mountControlRoom(requireAppRoot(), fixture);
    return;
  }
  const liveRun = toLiveStudioRun(await queryCloudflareRun(runId));
  if (!liveRun) {
    mountReleaseGate(requireAppRoot(), runId);
    return;
  }
  mountControlRoom(requireAppRoot(), liveRun);
}

async function queryCloudflareRun(runId: string): Promise<unknown> {
  try {
    const response = await fetch(
      `/api/evidence/runs/${encodeURIComponent(runId)}`,
      { headers: { Accept: "application/json" } },
    );
    return response.ok ? await response.json() as unknown : null;
  } catch (error) {
    console.warn(`Cloudflare run lookup failed; using local evidence: ${
      error instanceof Error ? error.message : String(error)
    }`);
    return null;
  }
}

async function loadCloudflarePublishedRun(
  runId: string,
): Promise<CloudflarePublishedRun | null> {
  const [{ normalizeGameRecipe }, document] = await Promise.all([
    import("./game-recipe/normalize"),
    queryCloudflareRun(runId),
  ]);
  if (
    typeof document !== "object"
    || document === null
    || !("status" in document)
    || !("recipe" in document)
    || document.status !== "published"
  ) {
    return null;
  }
  try {
    return { status: "published", recipe: normalizeGameRecipe(document.recipe) };
  } catch {
    return null;
  }
}

async function mountPublishedGame(runId: string): Promise<void> {
  const cloudflareRun = await loadCloudflarePublishedRun(runId);
  if (cloudflareRun) {
    await mountGame(cloudflareRun.recipe);
    return;
  }

  const { findStudioRunFixture } = await import("./studio/fixtures");
  const fixture = findStudioRunFixture(runId);
  const wasPublished = fixture?.events.some((event) => event.type === "release_published") ?? false;
  if (!fixture || fixture.status !== "published" || !wasPublished) {
    const [, { mountReleaseGate }] = await Promise.all([
      import("./studio/studio.css"),
      import("./control-room/mountReleaseGate"),
    ]);
    mountReleaseGate(requireAppRoot(), runId);
    return;
  }

  await mountGame(fixture.recipe);
}

async function startRoute(): Promise<void> {
  const pathname = window.location.pathname;
  if (pathname === "/" || pathname === "/studio" || pathname === "/studio/") {
    await mountStudio();
    return;
  }

  if (pathname === "/playground" || pathname === "/playground/") {
    await mountDefaultGame();
    return;
  }

  const controlRoomRunId = routeRunId("control-room");
  if (controlRoomRunId) {
    await mountControlRoom(controlRoomRunId);
    return;
  }

  const gameRunId = routeRunId("games");
  if (gameRunId) {
    await mountPublishedGame(gameRunId);
    return;
  }

  window.location.replace("/");
}

void startRoute();
