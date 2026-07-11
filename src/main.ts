import "./style.css";
import type { GameRecipeV0 } from "./game-recipe/types";

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
  const [, { findStudioRunFixture }, { mountControlRoom }, { mountReleaseGate }] = await Promise.all([
    import("./studio/studio.css"),
    import("./studio/fixtures"),
    import("./control-room/mountControlRoom"),
    import("./control-room/mountReleaseGate"),
  ]);
  const fixture = findStudioRunFixture(runId);
  if (!fixture) {
    mountReleaseGate(requireAppRoot(), runId);
    return;
  }
  mountControlRoom(requireAppRoot(), fixture);
}

async function mountPublishedGame(runId: string): Promise<void> {
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
  if (pathname === "/studio" || pathname === "/studio/") {
    await mountStudio();
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

  // The existing root route remains the deterministic battle sandbox used by P2.
  await mountDefaultGame();
}

void startRoute();
