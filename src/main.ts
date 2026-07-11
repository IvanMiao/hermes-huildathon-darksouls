import "./style.css";
import type { GameRecipeV0 } from "./game-recipe/types";

interface ConvexPublishedRun {
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
  const liveRun = toLiveStudioRun(await queryConvexRun(runId));
  if (!liveRun) {
    mountReleaseGate(requireAppRoot(), runId);
    return;
  }
  mountControlRoom(requireAppRoot(), liveRun);
}

async function queryConvexRun(runId: string): Promise<unknown> {
  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) return null;

  try {
    const [{ ConvexHttpClient }, { makeFunctionReference }] = await Promise.all([
      import("convex/browser"),
      import("convex/server"),
    ]);
    const client = new ConvexHttpClient(convexUrl);
    const getRun = makeFunctionReference<"query">("studio:getRun");
    return await client.query(getRun, { runId });
  } catch (error) {
    console.warn(`Convex run lookup failed; using local evidence: ${
      error instanceof Error ? error.message : String(error)
    }`);
    return null;
  }
}

async function loadConvexPublishedRun(runId: string): Promise<ConvexPublishedRun | null> {
  const [{ isGameRecipeV0 }, document] = await Promise.all([
    import("./game-recipe/normalize"),
    queryConvexRun(runId),
  ]);
  if (
    typeof document !== "object"
    || document === null
    || !("status" in document)
    || !("recipe" in document)
    || document.status !== "published"
    || !isGameRecipeV0(document.recipe)
  ) {
    return null;
  }
  return { status: "published", recipe: document.recipe };
}

async function mountPublishedGame(runId: string): Promise<void> {
  const convexRun = await loadConvexPublishedRun(runId);
  if (convexRun) {
    await mountGame(convexRun.recipe);
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
