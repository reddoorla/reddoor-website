import { test, expect } from "@playwright/test";

const PATHS = ["/medtech", "/boise"] as const;
const WIDTHS = [360, 390];

for (const width of WIDTHS) {
  test.describe(`industry pages at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const path of PATHS) {
      test(
        `${path} is no wider than the viewport`,
        { tag: width === 360 ? "@smoke" : [] },
        async ({ page }) => {
          await page.goto(path);
          const { scrollWidth, innerWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
        },
      );

      test(`${path} hero intro sits on the band below the photo`, async ({ page }) => {
        await page.goto(path);
        const hero = page.locator('[data-slice-type="industry_hero"]').first();
        const media = hero.locator(":scope > div.absolute").first();
        const kicker = hero.locator("p.type-kicker").first();
        await expect(kicker).toBeVisible();
        const mediaBox = await media.boundingBox();
        const kickerBox = await kicker.boundingBox();
        expect(mediaBox).not.toBeNull();
        expect(kickerBox).not.toBeNull();
        expect(kickerBox!.y).toBeGreaterThanOrEqual(mediaBox!.y + mediaBox!.height - 1);
      });
    }
  });
}
