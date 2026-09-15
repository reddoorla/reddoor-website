import { test, expect, type Page } from "@playwright/test";

// The primer, "What this report is", against the all-pass fixture: Example
// Studio, audited 2026-09-03, 76 named checks, 8 AI crawlers, accessibility
// measured, the journey stage present, two category probes and two fixes, so
// the values the smoke checks all print. The fallbacks are unit-tested on
// `primer()`.
//
// Locally, `.audit-sample.json` at the repo root makes `/dev/audit-report`
// render a real sample instead of the fixture; move it aside for a run.
const NAV = 'nav[aria-label="In this report"]';
const NAV_LINE = 96; // top-24, shared with scroll-mt-24

async function ready(page: Page, width: number, height: number) {
  // Instant anchor jumps: the site's smooth scrolling is gated on reduced
  // motion, and config-level emulation reaches neither matchMedia nor CSS.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await page.goto("/dev/audit-report");
  await page.locator("html[data-hydrated]").waitFor();
}

/** Page-absolute top of an element, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

/** Page-absolute bottom of an element, independent of the current scroll. */
async function pageBottomOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().bottom + window.scrollY,
    selector,
  );
}

/** The background of the nearest painted element, itself included — the band
 *  `selector` visually sits on. */
async function bandBehind(page: Page, selector: string) {
  return page.evaluate((s) => {
    let el: Element | null = document.querySelector(s);
    while (el) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)") {
        return { image: cs.backgroundImage, color: cs.backgroundColor };
      }
      el = el.parentElement;
    }
    return null;
  }, selector);
}

test.describe("report primer", () => {
  test("opens the document with the story of the audit, every number the fixture's own", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    const about = page.locator("#about");
    await expect(about).toHaveCount(1);
    await expect(about.locator("h2")).toHaveText("What this report is");
    await expect(about.locator("p.type-kicker")).toHaveText("In short");
    // Before the first finding, in document order.
    expect(await pageTopOf(page, "#about")).toBeLessThan(await pageTopOf(page, "#ai-says"));

    const text = (await about.innerText()).replace(/\s+/g, " ");
    expect(text).toContain("taken on September 3, 2026");
    expect(text).toContain("ran 76 named checks");
    expect(text).toContain("read your robots.txt as eight AI crawlers would");
    expect(text).toContain("ask an assistant about Example Studio");

    // First in the list, and the list rests level with this heading.
    const nav = page.locator(NAV);
    await expect(nav).toBeVisible();
    const first = nav.locator("a").first();
    await expect(first).toHaveText("What this report is");
    await expect(first).toHaveAttribute("href", "#about");
    const [navBox, h2Box] = await Promise.all([
      nav.boundingBox(),
      about.locator("h2").boundingBox(),
    ]);
    expect(Math.abs(navBox!.y - h2Box!.y)).toBeLessThanOrEqual(1);

    // Nothing current over the hero; the primer once its top is at the nav line.
    await expect(nav.locator("a[aria-current]")).toHaveCount(0);
    // The root layout scrolls to the top 600ms after navigation; wait it out.
    await page.waitForTimeout(700);
    const top = await pageTopOf(page, "#about");
    await page.evaluate((y) => window.scrollTo(0, y), top - NAV_LINE + 8);
    // A scroll that never lands fails here, as a scroll, not below as a
    // missing aria-current.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(top - NAV_LINE);
    await expect(first).toHaveAttribute("aria-current", "location");
  });

  test("below lg it follows the contents list on the same paper, before the first finding", async ({
    page,
  }) => {
    await ready(page, 390, 844);
    await expect(page.locator(NAV)).toBeVisible();
    // One coordinate space, page-absolute, so the order holds at any scroll.
    const aboutHeading = await pageTopOf(page, "#about h2");
    expect(await pageBottomOf(page, NAV)).toBeLessThanOrEqual(aboutHeading);
    expect(aboutHeading).toBeLessThan(await pageTopOf(page, "#ai-says"));

    // The list, the primer and the hero share one paper band; the first
    // finding is the first white one. (The wrapper carries the paper: an
    // earlier build left the list on a white strip between two paper bands.)
    const [behindHero, behindNav, behindAbout, behindAiSays] = await Promise.all([
      bandBehind(page, "h1"),
      bandBehind(page, NAV),
      bandBehind(page, "#about h2"),
      bandBehind(page, "#ai-says h2"),
    ]);
    expect(behindHero).not.toBeNull();
    expect(behindNav).not.toBeNull();
    expect(behindAbout).not.toBeNull();
    expect(behindAiSays).not.toBeNull();
    expect(behindNav!.image).not.toBe("none");
    expect(behindHero!.image).toBe(behindNav!.image);
    expect(behindAbout!.image).toBe(behindNav!.image);
    expect(behindAiSays!.color).toBe("rgb(255, 255, 255)");
  });
});
