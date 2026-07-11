import { expect, test, type Page } from "@playwright/test";

async function waitForDebugBridge(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).__SOULLOOM__));
}

async function trigger(page: Page, scenario: string): Promise<void> {
  await page.evaluate((nextScenario) => {
    (window as any).__SOULLOOM__.trigger(nextScenario);
  }, scenario);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/playground");
  await waitForDebugBridge(page);
});

test("loads a crisp Three.js scene without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.reload();
  await waitForDebugBridge(page);

  await expect(page.locator("#game canvas")).toBeVisible();
  const canvasSize = await page.locator("#game canvas").evaluate((canvas) => ({
    backingWidth: (canvas as HTMLCanvasElement).width,
    backingHeight: (canvas as HTMLCanvasElement).height,
    cssWidth: canvas.clientWidth,
    cssHeight: canvas.clientHeight,
  }));

  expect(canvasSize.backingWidth).toBeGreaterThanOrEqual(canvasSize.cssWidth);
  expect(canvasSize.backingHeight).toBeGreaterThanOrEqual(canvasSize.cssHeight);
  expect(errors).toEqual([]);
});

test("accepts keyboard movement, strike, and dodge input", async ({ page }) => {
  const game = page.locator("#game");
  await game.focus();
  const startPosition = await page.locator("[data-scene-ui]").getAttribute("data-player-position");

  await page.keyboard.down("KeyD");
  await page.waitForTimeout(180);
  await page.keyboard.up("KeyD");
  await expect(page.locator("[data-scene-ui]")).not.toHaveAttribute(
    "data-player-position",
    startPosition ?? "",
  );

  await page.keyboard.press("KeyJ");
  await page.keyboard.press("Space");
  await expect(page.locator("[data-scene-ui]")).toHaveAttribute(
    "data-player-invulnerable",
    "true",
  );
});

test("QA can inspect every release-critical state", async ({ page }) => {
  await page.evaluate(() => (window as any).__SOULLOOM__.pause());

  await trigger(page, "intro");
  await expect(page.locator(".battle-intro")).toBeVisible();

  for (const [scenario, label] of [
    ["sweep", "CENSURE OF THE FAITHFUL"],
    ["charge", "ABSOLUTE PROCESSION"],
    ["nova", "CHOIR OF CONSENT"],
  ] as const) {
    await trigger(page, scenario);
    await expect(page.locator(".attack-callout")).toHaveText(label);
    const attackType = await page.evaluate(() => (
      (window as any).__SOULLOOM__.getSnapshot().combat.boss.attack?.type
    ));
    expect(attackType).toBe(scenario);
  }

  await trigger(page, "phase_two");
  await expect(page.locator(".phase-mark")).toHaveText("II");
  await expect(page.locator(".event-callout")).toContainText("absolutely right");

  await trigger(page, "defeat");
  await expect(page.locator(".result-title")).toHaveText("YOU HAVE BEEN UNWRITTEN");
  await trigger(page, "restart");
  await expect(page.locator(".battle-result")).toBeHidden();

  await trigger(page, "victory");
  await expect(page.locator(".result-title")).toHaveText("THE ORACLE FALLS SILENT");
});

test("captures the deterministic sweep release frame", async ({ page }) => {
  await page.evaluate(() => {
    (window as any).__SOULLOOM__.pause();
    (window as any).__SOULLOOM__.dismissIntro();
  });
  await trigger(page, "sweep");
  await page.evaluate(() => (window as any).__SOULLOOM__.step(350));
  await page.waitForFunction(() => (
    (window as any).__SOULLOOM__.getSnapshot().combat.boss.attack?.elapsed >= 0.3
  ));

  await expect(page.locator("#game")).toHaveScreenshot("sweep-release-frame.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

test("loads and exposes the Procession and Revelation package rules", async ({ page }) => {
  await page.goto("/playground?recipe=procession");
  await waitForDebugBridge(page);
  await expect(page.locator("[data-scene-ui]")).toHaveAttribute(
    "data-archetype",
    "procession",
  );
  await page.evaluate(() => {
    (window as any).__SOULLOOM__.pause();
    (window as any).__SOULLOOM__.trigger("phase_two");
    (window as any).__SOULLOOM__.step(2_000);
  });
  await page.waitForFunction(() => (
    (window as any).__SOULLOOM__.getSnapshot().combat.arena.radius < 5.15
  ));

  await page.goto("/playground?recipe=revelation");
  await waitForDebugBridge(page);
  await page.evaluate(() => {
    (window as any).__SOULLOOM__.pause();
    (window as any).__SOULLOOM__.trigger("phase_two");
    (window as any).__SOULLOOM__.trigger("nova");
  });
  await expect(page.locator("[data-scene-ui]")).toHaveAttribute(
    "data-archetype",
    "revelation",
  );
  await expect(page.locator(".event-callout")).toContainText("OUTER RING");
});

test("opens only a published run with its release-gated recipe", async ({ page }) => {
  await page.goto("/games/fixture-encounter-repair");
  await waitForDebugBridge(page);
  await expect(page.locator("[data-scene-ui]")).toHaveAttribute(
    "data-archetype",
    "procession",
  );

  await page.goto("/games/unpassed-run");
  await expect(page.locator("#game canvas")).toHaveCount(0);
  await expect(page.locator("body")).toContainText("RELEASE BLOCKED");
});
