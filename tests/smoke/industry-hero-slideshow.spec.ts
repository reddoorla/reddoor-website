import { test, expect, type BrowserContext, type Locator } from "@playwright/test";

const PATH = "/dev/a11y-fixtures";
const INTERVAL_MS = 3000;

const svg = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="${fill}"/></svg>`;

async function serveImages(context: BrowserContext) {
  await context.route("**/images.prismic.io/**", (route) => {
    const url = route.request().url();
    const fill = url.includes("/fixture-3.png")
      ? "#2980b9"
      : url.includes("/fixture-2.png")
        ? "#27ae60"
        : "#c0392b";
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(fill) });
  });
}

const activeSlide = (hero: Locator) =>
  hero.evaluate(
    (el) => el.querySelector("[data-kb-active]")?.getAttribute("data-kb-slide") ?? null,
  );

const activeTransform = (hero: Locator) =>
  hero.evaluate((el) => {
    const motion = el.querySelector("[data-kb-active] .kb-motion");
    return motion ? getComputedStyle(motion).transform : null;
  });

test.describe("industry hero slideshow", () => {
  test("every change crossfades with two slides, and a broken image is skipped", async ({
    page,
    context,
  }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await context.route("**/images.prismic.io/**", (route) =>
      route.request().url().includes("/fixture-3.png")
        ? route.fulfill({ status: 404, body: "" })
        : route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg("#27ae60") }),
    );
    await page.goto(PATH);
    const hero = page.locator('[data-slice-type="industry_hero"]');
    await expect.poll(() => activeSlide(hero)).toBe("0");
    const changes = await hero.evaluate(async (el) => {
      const seen: { to: string; opacity: number }[] = [];
      let last = el.querySelector("[data-kb-active]")?.getAttribute("data-kb-slide");
      const start = performance.now();
      while (seen.length < 3 && performance.now() - start < 15_000) {
        const now = el.querySelector("[data-kb-active]");
        const slide = now?.getAttribute("data-kb-slide");
        if (now && slide && slide !== last) {
          await new Promise((r) => setTimeout(r, 150));
          seen.push({ to: slide, opacity: Number(getComputedStyle(now).opacity) });
          last = slide;
        }
        await new Promise((r) => setTimeout(r, 10));
      }
      return seen;
    });
    expect(changes.map((c) => c.to)).toEqual(["1", "0", "1"]);
    for (const change of changes) expect(change.opacity).toBeLessThan(0.6);
  });

  test("advances through the extra images with a Ken Burns move", async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await serveImages(context);
    await page.goto(PATH);
    const hero = page.locator('[data-slice-type="industry_hero"]');
    await expect(hero.locator("[data-kb-slide]")).toHaveCount(3);
    await expect.poll(() => activeSlide(hero)).toBe("0");
    const first = await activeTransform(hero);
    await page.waitForTimeout(1000);
    expect(await activeTransform(hero)).not.toBe(first);
    await expect.poll(() => activeSlide(hero), { timeout: INTERVAL_MS + 3000 }).toBe("1");
  });

  test("the pause button stops both the advance and the motion", async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await serveImages(context);
    await page.goto(PATH);
    const hero = page.locator('[data-slice-type="industry_hero"]');
    await expect.poll(() => activeSlide(hero)).toBe("0");
    await page.locator("html[data-hydrated]").waitFor();
    await hero.getByRole("button", { name: "Pause slideshow" }).click();
    await expect(hero.getByRole("button", { name: "Play slideshow" })).toBeVisible();
    const frozen = await activeTransform(hero);
    await page.waitForTimeout(INTERVAL_MS + 1500);
    expect(await activeSlide(hero)).toBe("0");
    expect(await activeTransform(hero)).toBe(frozen);
  });

  test("reduced motion shows the first image still, with no control", async ({ page, context }) => {
    await serveImages(context);
    await page.goto(PATH);
    const hero = page.locator('[data-slice-type="industry_hero"]');
    await expect.poll(() => activeSlide(hero)).toBe("0");
    await expect(hero.getByRole("button", { name: /slideshow/ })).toHaveCount(0);
    const animation = await hero.evaluate((el) => {
      const motion = el.querySelector("[data-kb-active] .kb-motion");
      return motion ? getComputedStyle(motion).animationName : null;
    });
    expect(animation).toBe("none");
  });
});
