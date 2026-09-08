import { test, expect, type Locator, type Page } from "@playwright/test";

// Tim, Discord #rd-website 2026-09-08: "Each project needs immediate context…
// making it a sticky title on the left column as you scroll down." Each
// featured project's name/services/arrow block pins high in the viewport for
// as long as that project's blocks are on screen, floats above every page
// layer (but under the fixed nav), then hands off to the next project's block without the two ever touching.

// The label's resting position while pinned: pt-28 inside a top-0 sticky box.
const TOP = 112;
// Smallest vertical gap allowed between an outgoing and an incoming pin.
const MIN_GAP = 24;

const yOf = async (el: Locator) => (await el.boundingBox())?.y ?? Number.NaN;

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
}

/** Page-absolute top of a group, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

test.describe("portfolio featured-project sticky label", () => {
  test.beforeEach(async ({ page }) => {
    // Instant scrollTo: the site's smooth scrolling is gated on reduced motion.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("pins under the nav while its project scrolls, then hands off", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");

    const group = '[data-project-group="rubrik-zero-labs"]';
    const rubrik = page.locator('[data-sticky-label="rubrik-zero-labs"] [data-sticky-chip]');
    const revogen = page.locator('[data-sticky-label="revogen"] [data-sticky-chip]');
    const top = await pageTopOf(page, group);
    const height = (await page.locator(group).boundingBox())!.height;

    // Inside the group: pinned at TOP at two different depths.
    for (const depth of [300, height - 500]) {
      await scrollTo(page, top + depth);
      await expect.poll(() => yOf(rubrik)).toBeGreaterThan(TOP - 2);
      await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP + 2);
    }

    // The chip is the real link, floating over the content.
    const link = rubrik.getByRole("link", { name: "Go to Rubrik Zero Labs project" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/portfolio/rubrik-zero-labs");

    // The arrow sits under the name, flush with its left edge, and the whole
    // thing stays inside the 1/5 gutter the cards leave on the left (Tucker:
    // "whole thing should fit in the 1/5 gutter") — the pin never crosses
    // into the content column.
    const name = rubrik.locator("p").first();
    const wrap = page.locator('[data-sticky-label="rubrik-zero-labs"] > *').first();
    const [nameBox, arrowBox, chipBox, wrapBox] = await Promise.all(
      [name, link, rubrik, wrap].map((l) => l.boundingBox()),
    );
    expect(arrowBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height);
    expect(Math.abs(arrowBox!.x - nameBox!.x)).toBeLessThanOrEqual(1);
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(wrapBox!.x + wrapBox!.width / 5 + 0.5);

    // Past the group: Rubrik's chip is pushed out and Revogen's has taken over.
    await scrollTo(page, top + height + 400);
    await expect.poll(() => yOf(rubrik)).toBeLessThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeGreaterThan(TOP - 2);
    await expect.poll(() => yOf(revogen)).toBeLessThan(TOP + 2);
  });

  test("nothing paints over the pin, even the banners", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    // Rubrik: pinned over the Vimeo banner. Revogen: pinned over the
    // interactive grafts banner — both carry their own stacked layers.
    for (const uid of ["rubrik-zero-labs", "revogen"]) {
      await scrollTo(page, (await pageTopOf(page, `[data-project-group="${uid}"]`)) + 200);
      const chip = page.locator(`[data-sticky-label="${uid}"] [data-sticky-chip]`);
      await expect.poll(() => yOf(chip)).toBeLessThan(TOP + 2);
      const name = chip.locator("p").first();
      const box = (await name.boundingBox())!;
      const topmost = await page.evaluate(
        ([x, y]) =>
          document
            .elementFromPoint(x, y)
            ?.closest("[data-sticky-label]")
            ?.getAttribute("data-sticky-label") ?? null,
        [box.x + box.width / 2, box.y + box.height / 2] as [number, number],
      );
      expect(topmost, `${uid}: the element under the pin's name text`).toBe(uid);
    }
  });

  test("an outgoing pin and the incoming one never touch", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/portfolio");
    const rubrik = page.locator('[data-sticky-label="rubrik-zero-labs"] [data-sticky-chip]');
    const revogen = page.locator('[data-sticky-label="revogen"] [data-sticky-chip]');
    const group = '[data-project-group="rubrik-zero-labs"]';
    const end = (await pageTopOf(page, group)) + (await page.locator(group).boundingBox())!.height;

    // Walk the hand-off in 40px steps and measure whenever both are on screen.
    let seenBoth = 0;
    for (let y = end - 700; y <= end + 300; y += 40) {
      await scrollTo(page, y);
      const [a, b] = await Promise.all([rubrik.boundingBox(), revogen.boundingBox()]);
      if (!a || !b) continue;
      const bothVisible = a.y + a.height > 0 && b.y < 800;
      if (!bothVisible) continue;
      seenBoth++;
      expect(b.y - (a.y + a.height), `gap at scrollY=${y}`).toBeGreaterThanOrEqual(MIN_GAP);
    }
    expect(seenBoth, "the walk must actually catch both pins on screen").toBeGreaterThan(0);
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
