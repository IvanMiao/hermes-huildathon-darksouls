import { expect, test } from "@playwright/test";

test("starts a live Studio run through the runner API", async ({ page }) => {
  const requestId = "12345678-1234-1234-1234-123456789abc";
  await page.route("**/api/studio/runs", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({
        requestId,
        runId: requestId,
        inputText: "Agreement should arrive before anyone can react.",
        state: "queued",
        statusUrl: `/api/studio/runs/${requestId}`,
        controlRoomUrl: `/control-room/${requestId}?job=1`,
        submittedAt: "2026-07-11T12:00:00.000Z",
        updatedAt: "2026-07-11T12:00:00.000Z",
        events: [],
        artifacts: [],
      }),
    });
  });
  let statusReads = 0;
  await page.route("**/api/studio/runs/*", async (route) => {
    statusReads += 1;
    const completed = statusReads > 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestId,
        runId: requestId,
        inputText: "Agreement should arrive before anyone can react.",
        state: completed ? "completed" : "running",
        statusUrl: `/api/studio/runs/${requestId}`,
        controlRoomUrl: `/control-room/${requestId}?job=1`,
        submittedAt: "2026-07-11T12:00:00.000Z",
        updatedAt: completed ? "2026-07-11T12:00:02.000Z" : "2026-07-11T12:00:01.000Z",
        events: [{
          runId: requestId,
          sequence: 1,
          occurredAt: "2026-07-11T12:00:01.000Z",
          actor: "Studio Manager",
          type: "run_started",
          status: "started",
          summary: "Production started.",
        }],
        artifacts: [],
        ...(completed ? {
          result: {
            runId: requestId,
            status: "published",
            qaPassed: true,
            cloudflareEvidence: "mirrored",
            gameUrl: `/games/${requestId}`,
            controlRoomUrl: `/control-room/${requestId}`,
          },
        } : {}),
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

  await expect(page).toHaveURL(new RegExp(`/control-room/${requestId}\\?job=1$`));
  await expect(page.getByRole("heading", { name: "Building your boss fight" })).toBeVisible();
  await expect(page.locator(".release-banner strong")).toHaveText("HERMES IS PRODUCING");
  await expect(page.locator(".release-banner strong")).toHaveText("BOSS FIGHT READY");
  await expect(page.getByRole("link", { name: "OPEN BOSS FIGHT" })).toBeVisible();
  await expect(page.locator("#game canvas")).toHaveCount(0);
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
  await expect(page.locator("[data-region='evidence-inspector']")).toContainText(
    "Procession must use closing_ring and contain an adjacent charge chain",
  );

  await replay.fill("14");
  await expect(page.locator(".release-banner strong")).toHaveText("TARGETED REPAIR");
  await expect(page.locator("[data-region='evidence-inspector']")).toContainText("EncounterSpec v2");
  await expect(page.locator("[data-region='evidence-inspector']")).toContainText("charge");

  await page.locator(".timeline-event").nth(10).click();
  await expect(page.locator("[data-region='evidence-inspector']")).toContainText("QAReport v1");

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
