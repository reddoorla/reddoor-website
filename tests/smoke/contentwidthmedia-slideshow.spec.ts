import { test, expect, type Page } from "@playwright/test";

// The slice simulator can't resolve Prismic content relationships, so
// /dev/slideshow-fixture renders the real ContentWidthMedia slice with a gallery
// item resolved as `fetchLinks: ["gallery.images"]` would deliver it. These
// tests exercise the slideshow render path end to end.
const FIXTURE = "/dev/slideshow-fixture";
const SECTION = '[data-slice-type="content_width_image"]';

// The carousel detects reduced motion via window.matchMedia (JS), and
// Playwright's `reducedMotion` emulation doesn't reach matchMedia in this setup.
// Stub matchMedia directly so we can drive that code path deterministically.
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
  test("renders the gallery images as a carousel", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      // Ignore failed-resource noise (external Unsplash images); assert only on
      // the component's own runtime errors.
      if (m.type() === "error" && !/Failed to load resource|net::|ERR_/i.test(m.text())) {
        consoleErrors.push(m.text());
      }
    });

    await forceReducedMotion(page, false);
    await page.goto(FIXTURE, { waitUntil: "load" });

    const section = page.locator(SECTION);
    await expect(section).toBeVisible();

    // Gallery images render inside the carousel (the infinite loop triples the
    // 3-image track), so there are well more than the 3 source images.
    await expect.poll(() => section.locator("img").count()).toBeGreaterThanOrEqual(3);

    expect(consoleErrors).toEqual([]);
  });

  test("hides controls while autoplaying, reveals them on hover, keeps them once paused", async ({
    page,
  }) => {
    await forceReducedMotion(page, false); // motion allowed → autoplay runs
    await page.goto(FIXTURE, { waitUntil: "load" });

    const section = page.locator(SECTION);
    const carousel = section.locator(".\\@container").first();
    const next = section.getByRole("button", { name: "Next slide" });
    // The controls' wrapper carries the fade; read its computed opacity.
    const controlsOpacity = () =>
      next.evaluate((el) => getComputedStyle(el.parentElement as HTMLElement).opacity);

    // Auto-advancing → chrome faded out.
    await expect.poll(controlsOpacity).toBe("0");

    // Hovering the carousel reveals the chrome.
    await carousel.hover();
    await expect.poll(controlsOpacity).toBe("1");

    // The revealed pause control works, and once paused the chrome stays put even
    // after the pointer leaves (no longer auto-advancing).
    await section.getByRole("button", { name: "Pause slideshow" }).click();
    await page.mouse.move(5, 5);
    await expect.poll(controlsOpacity).toBe("1");
    await expect(section.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  });

  test("omits the pause control under reduced motion (WCAG 2.2.2)", async ({ page }) => {
    await forceReducedMotion(page, true);
    await page.goto(FIXTURE, { waitUntil: "load" });

    const section = page.locator(SECTION);
    await expect(section).toBeVisible();

    // Images still render as a static carousel...
    await expect.poll(() => section.locator("img").count()).toBeGreaterThanOrEqual(3);

    // ...but nothing auto-advances, so there is no misleading no-op pause button,
    // and the nav arrows stay put (no autoplay chrome to hide behind).
    await expect(section.getByRole("button", { name: /slideshow/ })).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Next slide" })).toBeVisible();
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
