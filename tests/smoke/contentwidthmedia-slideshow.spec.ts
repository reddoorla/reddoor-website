import { test, expect, type Page } from "@playwright/test";

// The slice simulator can't resolve Prismic content relationships, so
// /dev/slideshow-fixture renders the real ContentWidthMedia slice with a gallery
// item resolved as `fetchLinks: ["gallery.images"]` would deliver it. These
// tests exercise the slideshow render path end to end.
const FIXTURE = "/dev/slideshow-fixture";
const SECTION = '[data-slice-type="content_width_image"]';

// The carousel detects reduced motion via window.matchMedia (JS), and
// Playwright's `reducedMotion` emulation doesn't reach matchMedia in this setup.
// Stub matchMedia directly so we can drive that code path deterministically in
// both directions.
async function forceReducedMotion(page: Page, reduce: boolean) {
  await page.addInitScript((reduce: boolean) => {
    const real = window.matchMedia.bind(window);
    const stub = (q: string): MediaQueryList =>
      ({
        matches: reduce,
        media: q,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
    window.matchMedia = (q: string) => (q.includes("prefers-reduced-motion") ? stub(q) : real(q));
  }, reduce);
}

test.describe("ContentWidthMedia slideshow item", () => {
  test("renders the gallery as a carousel with working controls", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      // Ignore failed-resource noise (external Unsplash images); assert only on
      // the component's own runtime errors.
      if (m.type() === "error" && !/Failed to load resource|net::|ERR_/i.test(m.text())) {
        consoleErrors.push(m.text());
      }
    });

    await forceReducedMotion(page, false); // motion allowed → autoplay + pause control
    await page.goto(FIXTURE, { waitUntil: "load" });

    const section = page.locator(SECTION);
    await expect(section).toBeVisible();

    // Gallery images render inside the carousel (the infinite loop triples the
    // 3-image track), so there are well more than the 3 source images.
    await expect.poll(() => section.locator("img").count()).toBeGreaterThanOrEqual(3);

    // Prev/next are visible on a wide (>=400px container) cell.
    await expect(section.getByRole("button", { name: "Previous slide" })).toBeVisible();
    await expect(section.getByRole("button", { name: "Next slide" })).toBeVisible();

    // Play/pause (the WCAG 2.2.2 pause mechanism) is present and toggles.
    const pause = section.getByRole("button", { name: "Pause slideshow" });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(section.getByRole("button", { name: "Play slideshow" })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  test("omits the pause control under reduced motion (WCAG 2.2.2)", async ({ page }) => {
    await forceReducedMotion(page, true);
    await page.goto(FIXTURE, { waitUntil: "load" });

    const section = page.locator(SECTION);
    await expect(section).toBeVisible();

    // Images still render as a static carousel...
    await expect.poll(() => section.locator("img").count()).toBeGreaterThanOrEqual(3);

    // ...but nothing auto-advances, so there is no misleading no-op pause button.
    await expect(section.getByRole("button", { name: /slideshow/ })).toHaveCount(0);
  });

  test.describe("on a narrow cell", () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test("hides arrows below the container threshold (auto-run, chrome-less)", async ({ page }) => {
      await forceReducedMotion(page, false);
      await page.goto(FIXTURE, { waitUntil: "load" });

      const section = page.locator(SECTION);
      await expect(section).toBeVisible();
      // Below the @min-[400px] container threshold the arrows collapse to
      // display:none so a small cell runs clean without chrome.
      await expect(section.getByRole("button", { name: "Next slide" })).toBeHidden();
    });
  });
});
