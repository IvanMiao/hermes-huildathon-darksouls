import { expect, test } from "@playwright/test";

test("starts a live Studio run through the runner API", async ({ page }) => {
  await page.route("**/api/studio/runs", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        runId: "live-hermes-run",
        status: "published",
        gameUrl: "/games/live-hermes-run",
        controlRoomUrl: "/control-room/live-hermes-run",
      }),
    });
  });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /One internet moment in/i })).toBeVisible();
  await expect(page.getByText(/starts a live Manager with parallel Hermes specialists/i)).toBeVisible();
  await expect(page.getByLabel("Tweet text")).toHaveValue("");
  await expect(page.getByText("I smell fear.")).toHaveCount(0);
  await page.getByLabel("Tweet text").fill(
    "Agreement should arrive before anyone can react.",
  );
  await page.getByRole("button", { name: "MAKE IT PLAYABLE" }).click();

  await expect(page).toHaveURL(/\/games\/live-hermes-run$/);
});

test("accepts a tweet screenshot as the source", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("Upload tweet image").check();
  await page.locator("#source-image").setInputFiles({
    name: "tweet.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  await expect(page.locator(".image-preview")).toBeVisible();
  await expect(page.locator(".image-preview")).toContainText("tweet.png");
  await page.getByRole("button", { name: "MAKE IT PLAYABLE" }).click();
  await expect(page).toHaveURL(/source=image$/);
});

test("replays blocked, targeted repair, and published states", async ({ page }) => {
  await page.goto("/control-room/fixture-encounter-repair");
  const replay = page.getByLabel("Replay event sequence");

  await replay.fill("12");
  await expect(page.locator(".release-banner strong")).toHaveText("RELEASE BLOCKED");
  await expect(page.locator(".qa-checks")).toContainText(
    "Procession must use closing_ring and contain an adjacent charge chain",
  );

  await replay.fill("14");
  await expect(page.locator(".release-banner strong")).toHaveText("TARGETED REPAIR");
  await expect(page.locator(".repair-diff")).toContainText("charge → sweep");
  await expect(page.locator(".repair-diff")).toContainText("charge → charge");
  await expect(page.locator(".repair-diff")).toContainText("Encounter Designer only");

  await replay.fill("19");
  await expect(page.locator(".release-banner strong")).toHaveText("SHIPPED");
  await expect(page.getByRole("link", { name: "OPEN BOSS FIGHT" })).toBeVisible();
});

test("opens only published game routes", async ({ page }) => {
  await page.goto("/games/not-published");
  await expect(page.getByRole("heading", { name: "RELEASE BLOCKED" })).toBeVisible();
  await expect(page.locator("#game canvas")).toHaveCount(0);

  await page.goto("/games/fixture-direct-pass");
  await expect(page.locator("#game canvas")).toBeVisible();
});

test("keeps Studio and Control Room within a small viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  for (const route of ["/", "/studio", "/control-room/fixture-encounter-repair"]) {
    await page.goto(route);
    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > window.innerWidth
    ));
    expect(hasHorizontalOverflow).toBe(false);
  }
});
