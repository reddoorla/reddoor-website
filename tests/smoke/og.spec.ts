import { test, expect } from "@playwright/test";

// Tim, 2026-09-08: every page must carry a real share card, never the 200×141
// debossed logo and never nothing. The endpoint and the wiring are asserted
// separately so a regression names the layer that broke.

test("the endpoint serves a PNG card and 404s an unknown slug", async ({ request }) => {
  const ok = await request.get("/og/site/about.png");
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toContain("image/png");
  const body = await ok.body();
  expect(Array.from(body.subarray(0, 4))).toEqual([137, 80, 78, 71]);

  expect((await request.get("/og/site/nope.png")).status()).toBe(404);
  expect((await request.get("/og/nope/about.png")).status()).toBe(404);
});

for (const [path, card] of [
  ["/about", "/og/site/about.png"],
  ["/contact", "/og/site/contact.png"],
  ["/portfolio", "/og/site/portfolio.png"],
  ["/showcase", "/og/site/showcase.png"],
  ["/this-page-does-not-exist", "/og/site/default.png"],
]) {
  test(`${path} advertises ${card}`, async ({ page }) => {
    await page.goto(path);
    const og = page.locator('meta[property="og:image"]');
    await expect(og).toHaveCount(1);
    const content = await og.getAttribute("content");
    expect(content).toMatch(/^http/);
    expect(content!.endsWith(card)).toBe(true);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
  });
}

test("no page falls back to the debossed logo", async ({ page }) => {
  for (const path of ["/", "/medtech", "/about"]) {
    await page.goto(path);
    const content = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(content).not.toContain("printedReddoor");
  }
});
