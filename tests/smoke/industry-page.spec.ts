import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// /medtech is the first `industry` document — a landing page assembled from 12
// slices that all render through the shared RailRow grid.
//
// /dev/a11y-fixtures already audits each of these slices in isolation, but a
// landing page is mostly a *composition* problem: heading order only exists
// across the stack, and a duplicate-key or fallback bug only shows up on the
// real document. These tests audit the assembled page instead.
const PATH = "/medtech";

// The axe gate that runs in CI (and Lighthouse) only ever sees a mobile
// viewport, so desktop-only markup branches have historically slipped through.
// Both viewports are audited here deliberately.
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1024 },
];

// Playwright's `reducedMotion: "reduce"` sets the CSS media feature but does
// NOT show up in `window.matchMedia(...).matches`, which is what the animateIn
// action reads. Without this stub animateIn runs its 2400ms opacity fade and
// axe measures text mid-transition: `text-primary` reads as #e04d52 rather than
// #D71920 and fails contrast, purely as an artifact of when the audit ran.
// Stubbing matchMedia makes animateIn a no-op so the audit sees the settled
// page — which is the state the contrast requirement is actually about.
async function stubReducedMotion(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      /prefers-reduced-motion/.test(query)
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList)
        : real(query);
  });
}

for (const vp of VIEWPORTS) {
  test(`${PATH} has no axe violations (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await stubReducedMotion(page);
    await page.goto(PATH, { waitUntil: "networkidle" });

    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)).toEqual([]);
  });
}

test(`${PATH} renders every slice in the document, in order`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const rendered = await page
    .locator("[data-slice-type]")
    .evaluateAll((els) =>
      els.map(
        (el) => `${el.getAttribute("data-slice-type")}/${el.getAttribute("data-slice-variation")}`,
      ),
    );

  // Mirrors the slice zone of the published `medtech` document. A slice that
  // fails to render drops out of the DOM silently, so this asserts the whole
  // list rather than a count.
  expect(rendered).toEqual([
    "industry_hero/default",
    "lead_text/rail",
    "text_columns/serviceList",
    "lead_text/rail",
    "text_columns/iconColumns",
    "case_study/default",
    "logo_grid/default",
    "testimonial/default",
    "featured_project/default",
    "value_block/expandable",
    "accordion/rail",
    "cta_banner/default",
  ]);
});

test(`${PATH} has exactly one h1 and no heading-level jumps`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((els) =>
    els.map((el) => ({
      level: Number(el.tagName[1]),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
    })),
  );

  expect(levels.filter((h) => h.level === 1)).toHaveLength(1);

  const jumps = levels
    .filter((h, i) => i > 0 && h.level > levels[i - 1].level + 1)
    .map((h) => `h${h.level} after h${levels[levels.indexOf(h) - 1].level}: "${h.text}"`);
  expect(jumps).toEqual([]);
});

// A CONTENT guard, not a markup one. Prismic fills a declared thumbnail the
// instant its asset uploads, using a crop anchored top-left (`rect=0,0,w,h`) —
// so an uncropped `mobile` thumbnail is indistinguishable from a deliberate one
// as far as `isFilled` is concerned, and shipping it means the phone gets the
// empty left third of a landscape photo. That regressed all nine backdrops
// once: Caltex rendered as bare background with the iMac outside the frame.
//
// The rule this encodes is narrow and checkable: whatever field wins, a phone
// must never be served Prismic's untouched auto-crop. It fails if someone
// clears `active_background_mobile` before framing the `mobile` thumbnail —
// which is precisely the order that breaks.
test(`${PATH} never serves an untouched auto-crop as the phone backdrop`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const backdrops = page.locator('[data-slice-type="logo_grid"] picture img');
  await backdrops.first().scrollIntoViewIfNeeded();

  // Every backdrop is `absolute inset-0`, so they all enter the viewport at
  // once — but they are `loading="lazy"`, and a cold dev server can take a
  // while to serve them. Poll rather than assume a fixed wait.
  await expect
    .poll(
      () =>
        backdrops.evaluateAll(
          (els) => els.filter((el) => !!(el as HTMLImageElement).currentSrc).length,
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  const autoCropped = await backdrops.evaluateAll((els) =>
    els
      .map((el) => (el as HTMLImageElement).currentSrc)
      .filter((src) => /[?&]rect=0(?:,|%2C)0(?:,|%2C)/.test(src))
      .map((src) => src.split("/").pop()?.split("?")[0] ?? src),
  );

  expect(autoCropped).toEqual([]);
});

test(`${PATH} ends on its own CTA slice, not the marketing footer CTA`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  // Industry pages carry their own cta_banner slice, so the [uid] route's
  // built-in marketing CTA is suppressed and the page doesn't end on two CTAs.
  // (The site footer's own "Meet with Us" link is part of the layout and stays.)
  await expect(page.getByRole("heading", { name: /isn.t it time to arm your brand/i })).toHaveCount(
    0,
  );
  await expect(page.locator('[data-slice-type="cta_banner"]')).toBeVisible();
});

test(`${PATH} renders the framework as a numbered list, not icons`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  const framework = page.locator('[data-slice-variation="iconColumns"]');
  const steps = framework.locator("ol > li");
  await expect(steps).toHaveCount(3);

  // The board replaced the per-step icons with numbers; a leftover <img> would
  // mean the slice is still rendering the (still-modelled) `icon` field.
  await expect(framework.locator("img")).toHaveCount(0);

  // Numbers are derived from position, so this also pins that ordering.
  await expect(steps.locator(".step-num")).toHaveText(["01", "02", "03"]);
});

// Whether the arrow is joined is a claim about rendered INK, not about the box
// model — which is exactly why the first attempt at this shipped broken. The
// chevron was one SVG rotated 90°, and `rotate()` moves the glyph inside a box
// whose layout size does not change; the rule was pulled back onto the box and
// still stopped ~8px short of the vertex, so every step read as a rule and a
// detached chevron. No layout assertion would have caught it.
//
// So: walk the ink across the join and require it to be a single unbroken run.
// `headInk` guards the obvious false positive — an arrowhead that never painted
// also leaves exactly one run.
//
// Captured as an ELEMENT screenshot of the arrow, never as a page clip. Page
// coordinates cannot be trusted here: the slices above carry lazily-loaded
// media, and their reflow drags the rail down between computing a clip and
// taking the shot — far enough that the shot lands on empty paper, or that
// scrollIntoView is simply undone and the arrow is below the fold again.
// Screenshotting the element sidesteps all of it. Playwright scrolls it into
// view itself, the image IS the element's box, and every coordinate below is a
// fraction of that box rather than a position on the page.
/**
 * Loads every lazy image and waits for the page to stop growing.
 *
 * This is the root cause of a whole family of flakes in here, and it is worth
 * paying once rather than defending against downstream: the slices above the
 * rail load their media lazily, so the page keeps getting taller while a
 * measurement is in flight. Scroll positions go stale, clips land on empty
 * paper, and an element scrolled into view is below the fold again a moment
 * later. Force the loading first and the rail stops moving.
 */
async function settle(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: 30_000,
    })
    .catch(() => {});
}

async function measureArrow(page: import("@playwright/test").Page, index: number, axis: "x" | "y") {
  const arrow = page.locator('[data-slice-variation="iconColumns"] .step-arrow').nth(index);
  const chevron = arrow.locator(".step-arrow-head:visible");

  // Each chevron fades in on its own stagger, so waiting on the first step's
  // opacity is not enough: measuring step 3 while it is still at 20% reads its
  // stroke as paper and reports a gap that isn't there. Wait per step.
  await expect
    .poll(() => chevron.evaluate((el) => Number(getComputedStyle(el).opacity)), {
      timeout: 15_000,
    })
    .toBe(1);

  // Sizes, not positions — these hold however far the page has drifted.
  const size = await arrow.evaluate((el) => {
    const head = [...el.querySelectorAll(".step-arrow-head")].find(
      (n) => getComputedStyle(n).display !== "none",
    )!;
    const a = el.getBoundingClientRect();
    const h = head.getBoundingClientRect();
    return { w: a.width, h: a.height, chevW: h.width, chevH: h.height };
  });
  const shot = await arrow.screenshot();

  // Nothing below re-reads the page — every coordinate is a fraction of the
  // element's own box, so image and geometry cannot come from different layouts.
  return page.evaluate(
    async ({ b64, size, axis }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      // Scale, not devicePixelRatio: the element is measured in CSS px but
      // rendered at whatever the context's scale factor is.
      const s = canvas.width / size.w;
      // Red dominance rather than an exact match — a 1.5px stroke lands on the
      // device grid partially covered, so its pixels are blends toward paper.
      const ink = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
        const i = (y * canvas.width + x) * 4;
        return px[i] - px[i + 1] > 45 && px[i] - px[i + 2] > 30;
      };
      const along = axis === "x";
      // Where the chevron sits inside the arrow: hard against the leading end,
      // centred on the other axis — which is what the flex row/column does.
      const box = along
        ? {
            x: size.w - size.chevW,
            y: (size.h - size.chevH) / 2,
            w: size.chevW,
            h: size.chevH,
          }
        : {
            x: (size.w - size.chevW) / 2,
            y: size.h - size.chevH,
            w: size.chevW,
            h: size.chevH,
          };
      // The rule, the chevron's vertex and the arrow all share a centre line.
      const fixed = Math.round((along ? box.y + box.h / 2 : box.x + box.w / 2) * s);
      // The window IS the join, so walk all of it.
      const from = 0;
      const to = along ? canvas.width : canvas.height;

      let segments = 0;
      let gap = 0;
      let run = false;
      let lastInk = -1;
      for (let t = from; t < to; t++) {
        const hit = along
          ? ink(t, fixed) || ink(t, fixed - 1) || ink(t, fixed + 1)
          : ink(fixed, t) || ink(fixed - 1, t) || ink(fixed + 1, t);
        if (hit) {
          if (!run) {
            segments++;
            if (lastInk >= 0) gap = Math.max(gap, (t - lastInk - 1) / s);
          }
          lastInk = t;
        }
        run = hit;
      }

      let headInk = 0;
      for (let y = Math.round(box.y * s); y < Math.round((box.y + box.h) * s); y++)
        for (let x = Math.round(box.x * s); x < Math.round((box.x + box.w) * s); x++)
          if (ink(x, y)) headInk++;

      return { segments, gap: +gap.toFixed(2), headInk };
    },
    { b64: shot.toString("base64"), size, axis },
  );
}

for (const vp of VIEWPORTS) {
  test(`${PATH} draws each step arrow as one unbroken stroke (${vp.name})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(PATH, { waitUntil: "domcontentloaded" });
    await settle(page);

    const grid = page.locator('[data-slice-variation="iconColumns"] ol');
    await grid.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

    // measureArrow waits for each step's own chevron to finish arriving —
    // measuring before that reads the rule on its own, which looks like a
    // flawless join.
    //
    // Mobile stacks the rail and points the arrows down; desktop turns the row.
    const axis = vp.name === "desktop" ? "x" : "y";
    for (let i = 0; i < 3; i++) {
      const { segments, gap, headInk } = await measureArrow(page, i, axis);
      expect(headInk, `step ${i + 1}: the chevron never painted`).toBeGreaterThan(0);
      expect({ step: i + 1, segments, gap }).toEqual({ step: i + 1, segments: 1, gap: 0 });
    }
  });
}

// Each step runs two beats: the arrow draws, THEN the copy under it fills in.
// Both at once is what this replaced, and the difference only exists mid-flight
// — once the page settles, a version that showed the copy first is pixel-for-
// pixel identical. So it is sampled every frame.
//
// This also pins the subtler half. The hidden state has to apply instantly
// while only the reveal animates: when both carried the transition, the arrow
// spent 860ms visibly un-drawing itself, and a step reaching the viewport
// during that rewind flipped to `in` with the chevron still opaque — nothing
// left to transition, so no transitionend, so the copy fell back to its timer
// rather than following the arrow. `copyFollowedTheArrow` is what catches that:
// the release has to coincide with the chevron landing, not arrive late.
test(`${PATH} draws each arrow before its copy fills in`, async ({ page }) => {
  test.setTimeout(90_000);
  // The suite runs reduced-motion, under which this sequence correctly does not
  // exist at all: both the draw and the fill bail out and the step renders
  // finished. Opt this one test back into motion, or it asserts nothing.
  //
  // (Playwright's `reducedMotion` DOES reach window.matchMedia on 1.62 —
  // verified here. The note above stubReducedMotion says otherwise and is out
  // of date; that stub is now belt-and-braces rather than load-bearing.)
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  // Sampling starts before the rail is reached so no transition is missed.
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__rec = {} as Record<number, unknown>;
    const t0 = performance.now();
    const tick = () => {
      const rec = w.__rec as Record<number, Record<string, unknown>>;
      document.querySelectorAll(".step").forEach((el, i) => {
        const r = (rec[i] ??= { start: null, armed: null, released: null, copyEarly: false });
        const now = performance.now() - t0;
        const body = el.querySelector(".step-body") as HTMLElement | null;
        const chevron = [...el.querySelectorAll(".step-arrow-head")].find(
          (n) => getComputedStyle(n).display !== "none",
        );
        if (el.getAttribute("data-draw") === "in" && r.start === null) r.start = now;
        if (r.start !== null && r.armed === null && chevron)
          if (Number(getComputedStyle(chevron).opacity) === 1) r.armed = now;
        // `data-copy` flips the moment the copy is released, whatever the fill
        // then costs — so this measures the handoff, not the fade.
        if (r.released === null && el.getAttribute("data-copy") === "in") r.released = now;
        // Was the copy already fully on screen while the arrow was drawing?
        if (r.start !== null && r.armed === null && body)
          if (Number(getComputedStyle(body).opacity) === 1) r.copyEarly = true;
      });
      w.__raf = requestAnimationFrame(tick);
    };
    tick();
  });

  const steps = page.locator(".step");
  const count = await steps.count();
  for (let i = 0; i < count; i++) {
    await steps
      .nth(i)
      .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    // Room for the staggered draw (~1.2s at the last step) and the 1s fill.
    await page.waitForTimeout(4000);
  }

  const rec = (await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    cancelAnimationFrame(w.__raf as number);
    return w.__rec;
  })) as Record<
    number,
    { start: number | null; armed: number | null; released: number | null; copyEarly: boolean }
  >;

  const verdicts = Array.from({ length: count }, (_, i) => {
    const r = rec[i];
    const step = `step ${i + 1}`;
    if (!r || r.start === null) return `${step}: arrow never drew`;
    if (r.armed === null) return `${step}: chevron never landed`;
    if (r.released === null) return `${step}: copy never appeared`;
    if (r.copyEarly) return `${step}: copy was already visible during the draw`;
    // One frame of slack: both are observed by sampling, not by the clock.
    if (r.released < r.armed - 16) return `${step}: copy released before the chevron landed`;
    // Following the arrow means landing with it, not on the 2500ms fallback.
    if (r.released > r.armed + 600)
      return `${step}: copy lagged the chevron by ${Math.round(r.released - r.armed)}ms`;
    return `${step}: ok`;
  });

  expect(verdicts).toEqual(Array.from({ length: count }, (_, i) => `step ${i + 1}: ok`));
});

test(`${PATH} does not announce the decorative step numbers`, async ({ page }) => {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });

  // The <ol> already conveys the sequence. If the number + arrow were exposed
  // too, every step would be read as "01 The Diagnosis" inside an
  // already-numbered list. Asserted on the head rather than the rendered text
  // because aria-hidden content still shows up in textContent.
  const heads = page.locator('[data-slice-variation="iconColumns"] ol > li .step-head');
  await expect(heads).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(heads.nth(i)).toHaveAttribute("aria-hidden", "true");
  }
});
