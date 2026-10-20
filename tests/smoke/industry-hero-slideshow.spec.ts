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

// A slide's move as numbers — never compare matrix strings. Every keyframe is
// `scale(s) translate(…) rotate(θ)`, which computes to
// matrix(s·cosθ, s·sinθ, −s·sinθ, s·cosθ, e, f): the scale is √(a² + b²)
// whatever the rotation, and the rotation is atan2(b, a).
const motionOf = (hero: Locator) =>
  hero.evaluate((el) => {
    const motion = el.querySelector("[data-kb-active] .kb-motion");
    if (!motion) return null;
    const { a, b } = new DOMMatrixReadOnly(getComputedStyle(motion).transform);
    return { scale: Math.sqrt(a * a + b * b), rotateDeg: (Math.atan2(b, a) * 180) / Math.PI };
  });

// KenBurns.svelte tilts every keyframe by this much so Firefox resamples the
// image instead of snapping an axis-aligned scale to whole device pixels.
const TILT_DEG = 0.02;

test.describe("industry hero slideshow", () => {
  test(
    "every change crossfades with two slides, and a broken image is skipped",
    { tag: "@nightly" },
    async ({ page, context }) => {
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
        const seen: { to: string; opacity: number; keyframes: string; rotateDeg: number }[] = [];
        let last = el.querySelector("[data-kb-active]")?.getAttribute("data-kb-slide");
        const start = performance.now();
        while (seen.length < 3 && performance.now() - start < 15_000) {
          const now = el.querySelector("[data-kb-active]");
          const slide = now?.getAttribute("data-kb-slide");
          if (now && slide && slide !== last) {
            await new Promise((r) => setTimeout(r, 150));
            const motion = getComputedStyle(now.querySelector(".kb-motion")!);
            const { a, b } = new DOMMatrixReadOnly(motion.transform);
            seen.push({
              to: slide,
              opacity: Number(getComputedStyle(now).opacity),
              keyframes: motion.animationName.replace(/^.*(kb-(?:in|out)-[ab])$/, "$1"),
              rotateDeg: (Math.atan2(b, a) * 180) / Math.PI,
            });
            last = slide;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        return seen;
      });
      expect(changes.map((c) => c.to)).toEqual(["1", "0", "1"]);
      for (const change of changes) expect(change.opacity).toBeLessThan(0.6);
      // These three changes start the three keyframes slide 0's first move (kb-in-a,
      // read in the next test) does not, and each carries the full tilt 150ms in —
      // a tilt on only one end would have interpolated ~4% of the way off it.
      expect(changes.map((c) => c.keyframes).sort()).toEqual(["kb-in-b", "kb-out-a", "kb-out-b"]);
      for (const change of changes) expect(change.rotateDeg).toBeCloseTo(TILT_DEG, 4);
    },
  );

  test(
    "advances through the extra images with a Ken Burns move",
    { tag: "@nightly" },
    async ({ page, context }) => {
      test.setTimeout(60_000);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await serveImages(context);
      await page.goto(PATH);
      const hero = page.locator('[data-slice-type="industry_hero"]');
      await expect(hero.locator("[data-kb-slide]")).toHaveCount(3);
      await expect.poll(() => activeSlide(hero)).toBe("0");
      // Slide 0's move read at two fixed points on its own timeline, never twice
      // in real time: its 4s move starts at first paint, so a read delayed ~3s by
      // load lands a second read on the move held at its end, or after its
      // fade-out has taken it away — a red that says nothing about the move. So:
      // pause it, seek to 1s and 2s, read each, then put it back and let it run.
      // What is left is a stall of over 4s after hydration before this read: slide
      // 0 has faded out and has no move to read, and that fails as `null` below.
      const move = await hero.evaluate((el) => {
        const motion = el.querySelector('[data-kb-slide="0"] .kb-motion');
        const animation = motion?.getAnimations()[0];
        if (!motion || !animation) return null;
        const at = (ms: number) => {
          animation.currentTime = ms;
          const { a, b } = new DOMMatrixReadOnly(getComputedStyle(motion).transform);
          return { scale: Math.sqrt(a * a + b * b), rotateDeg: (Math.atan2(b, a) * 180) / Math.PI };
        };
        const { currentTime, playState } = animation;
        animation.pause();
        const reads = [at(1000), at(2000)];
        animation.currentTime = currentTime;
        if (playState === "running") animation.play();
        const name = getComputedStyle(motion).animationName;
        return { keyframes: name.replace(/^.*(kb-(?:in|out)-[ab])$/, "$1"), reads };
      });
      expect(move, "slide 0 still has its first move to read").not.toBeNull();
      const [early, late] = move!.reads;
      // Slide 0's first move is kb-in-a — the one keyframe the test above never
      // starts — and it zooms 1 → 1.06 over 4s.
      expect(move!.keyframes).toBe("kb-in-a");
      expect(late.scale).toBeGreaterThan(early.scale);
      // The tilt is there while it moves, and the same at both points: every
      // keyframe carries it at both ends, so it never interpolates.
      expect(early.rotateDeg).toBeCloseTo(TILT_DEG, 4);
      expect(late.rotateDeg).toBeCloseTo(TILT_DEG, 4);
      await expect.poll(() => activeSlide(hero), { timeout: INTERVAL_MS + 3000 }).toBe("1");
    },
  );

  test(
    "the pause button stops both the advance and the motion",
    { tag: "@nightly" },
    async ({ page, context }) => {
      test.setTimeout(60_000);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await serveImages(context);
      await page.goto(PATH);
      const hero = page.locator('[data-slice-type="industry_hero"]');
      await expect.poll(() => activeSlide(hero)).toBe("0");
      await page.locator("html[data-hydrated]").waitFor();
      await hero.getByRole("button", { name: "Pause slideshow" }).click();
      await expect(hero.getByRole("button", { name: "Play slideshow" })).toBeVisible();
      const frozen = await motionOf(hero);
      await page.waitForTimeout(INTERVAL_MS + 1500);
      expect(await activeSlide(hero)).toBe("0");
      // Tighter than one millisecond of zoom (0.06 / 4000ms = 1.5e-5 per ms).
      expect((await motionOf(hero))!.scale).toBeCloseTo(frozen!.scale, 5);
    },
  );

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
    // The tilt lives only in the keyframes: the still is neither zoomed nor turned.
    expect(await motionOf(hero)).toEqual({ scale: 1, rotateDeg: 0 });
  });

  test("the pause button pauses the slideshow", { tag: "@smoke" }, async ({ page, context }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await serveImages(context);
    await page.goto(PATH);
    const hero = page.locator('[data-slice-type="industry_hero"]');
    await expect.poll(() => activeSlide(hero)).toBe("0");
    await page.locator("html[data-hydrated]").waitFor();
    await hero.getByRole("button", { name: "Pause slideshow" }).click();
    await expect(hero.getByRole("button", { name: "Play slideshow" })).toBeVisible();
  });

  test(
    "reduced motion shows the first image without moving it, and offers no control",
    { tag: "@smoke" },
    async ({ page, context }) => {
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
    },
  );
});
