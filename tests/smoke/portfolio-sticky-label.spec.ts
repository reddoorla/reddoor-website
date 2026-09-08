import { test, expect } from "@playwright/test";

// Tim, Discord #rd-website 2026-09-08: "Each project needs immediate context…
// making it a sticky title on the left column as you scroll down." Each
// featured project's name/services/arrow block pins under the fixed nav for
// as long as that project's blocks are on screen, then hands off to the next.

// top-16 under the h-12 nav.
const TOP = 64;

const yOf = async (el: ReturnType<import("@playwright/test").Page["locator"]>) =>
  (await el.boundingBox())?.y ?? Number.NaN;

test.describe("portfolio featured-project sticky label", () => {
  test.beforeEach(async ({ page }) => {
    // Instant scrollTo: the site's smooth scrolling is gated on reduced motion.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("pins under the nav while its project scrolls, then hands off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");

    const group = page.locator('[data-project-group="rubrik-zero-labs"]');
    const rubrik = page.locator('[data-sticky-label="rubrik-zero-labs"]');
    const revogen = page.locator('[data-sticky-label="revogen"]');
    const box = (await group.boundingBox())!;
    const pageTop = box.y + (await page.evaluate(() => window.scrollY));

    // Inside the group: pinned at TOP at two different depths.
    for (const depth of [300, box.height - 400]) {
      await page.evaluate((y) => window.scrollTo(0, y), pageTop + depth);
      await expect.poll(() => yOf(rubrik)).toBeGreaterThan(TOP - 2);
      await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP + 2);
    }

    // The chip is the real link, floating over the content.
    const link = rubrik.getByRole("link", { name: "Go to Rubrik Zero Labs project" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/portfolio/rubrik-zero-labs");

    // Past the group: Rubrik's chip is pushed out and Revogen's has taken over.
    await page.evaluate((y) => window.scrollTo(0, y), pageTop + box.height + 300);
    await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeGreaterThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeLessThan(TOP + 2);
  });

  test("names each featured project exactly once per breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    // Desktop: the pinned chip is the only "Go to Rubrik" link in the featured
    // area — the in-card copy is hidden so the name never shows twice.
    await expect(page.getByRole("link", { name: "Go to Rubrik Zero Labs project" })).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/portfolio");
    await expect(page.locator('[data-sticky-label="rubrik-zero-labs"]')).toBeHidden();
    await expect(page.getByRole("link", { name: "Go to Rubrik Zero Labs project" })).toHaveCount(1);
  });
});
