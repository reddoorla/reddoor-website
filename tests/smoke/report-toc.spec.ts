import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The contents list, against the all-pass fixture. Every check in that fixture
// passes, but its analyze stage carries two recommendations, so the page
// renders "2 things to fix, in order" and the list has all five entries. The
// omission of "What to fix" on a report with no fixes is covered by the unit
// test on `tocEntries([])`, not here.
//
// The fixture route, not a token route, so the run is not coupled to any one
// prospect's report.
const NAV = 'nav[aria-label="In this report"]';
const NAV_LINE = 96; // top-24, the fixed nav's clearance, shared with scroll-mt-24

async function ready(page: Page, width: number, height: number) {
  // Instant anchor jumps: the site's smooth scrolling is gated on reduced
  // motion, and config-level emulation reaches neither matchMedia nor CSS.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await page.goto("/dev/audit-report");
  await page.locator("html[data-hydrated]").waitFor();
  // The root layout scrolls to the top 600ms after navigation; a scripted
  // scroll inside that window is undone.
  await page.waitForTimeout(700);
}

/** Page-absolute top of an element, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 5);
}

test.describe("report table of contents", () => {
  test("lists the sections that render, in order, each pointing at a live target", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    await expect(page.locator(NAV)).toHaveCount(1);
    const links = page.locator(`${NAV} a`);
    await expect(links).toHaveText([
      "What an AI says about you",
      "What you control",
      "What to fix",
      "What passes, and how we measured",
      "Talk it through",
    ]);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      expect(href).toMatch(/^#[a-z-]+$/);
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test("sits in the rail, sticks under the nav, and marks the current section", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    const nav = page.locator(NAV);
    // The rail cell of the first block: first child of the RailRow grid.
    const railCell = page.locator('#ai-says [class*="lg:grid-cols"] > div').first();
    const [navBox, cellBox] = await Promise.all([nav.boundingBox(), railCell.boundingBox()]);
    expect(navBox).not.toBeNull();
    expect(cellBox).not.toBeNull();
    expect(Math.abs(navBox!.x - cellBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.round(navBox!.width)).toBe(240);
    // With the label above the content, the rail cell holds nothing.
    await expect(railCell).toHaveText("");

    // Nothing is current over the hero.
    await expect(page.locator(`${NAV} a[aria-current]`)).toHaveCount(0);

    // Into "What you control": the nav is stuck at the nav line and that entry
    // is current, the one above is not.
    await scrollTo(page, (await pageTopOf(page, "#control")) - NAV_LINE + 8);
    await expect.poll(async () => Math.round((await nav.boundingBox())!.y)).toBe(NAV_LINE);
    const control = page.locator(`${NAV} a[href="#control"]`);
    const aiSays = page.locator(`${NAV} a[href="#ai-says"]`);
    await expect(control).toHaveAttribute("aria-current", "true");
    await expect(aiSays).not.toHaveAttribute("aria-current", /.*/);
  });

  test("an entry jumps to its section and offers the way back", async ({ page }) => {
    await ready(page, 1280, 800);
    await page.locator(`${NAV} a[href="#passes"]`).click();
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelector("#passes")!.getBoundingClientRect().top),
      )
      .toBeLessThanOrEqual(NAV_LINE + 1);
    await expect(page.getByRole("button", { name: /back to where you were/i })).toBeVisible();
  });

  test("below lg it is one block under the hero, with every label above its content", async ({
    page,
  }) => {
    await ready(page, 390, 844);
    const nav = page.locator(NAV);
    await expect(nav).toHaveCount(1);
    const heroBottom = await page.evaluate(() => {
      const h1 = document.querySelector("h1")!;
      return h1.closest("section")!.getBoundingClientRect().bottom + window.scrollY;
    });
    const firstHeadingTop = await pageTopOf(page, "#ai-says h2");
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y).toBeGreaterThanOrEqual(heroBottom);
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(firstHeadingTop);
    // The first block's label is inside the content column, above the content.
    const label = page.locator("#ai-says h3.type-kicker").first();
    const content = label.locator("xpath=following-sibling::*[1]");
    const [labelBox, contentBox] = await Promise.all([label.boundingBox(), content.boundingBox()]);
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(contentBox!.y);
    expect(Math.abs(labelBox!.x - contentBox!.x)).toBeLessThanOrEqual(1);
  });

  test("the nav is a named landmark and axe is clean around it", async ({ page }) => {
    await ready(page, 1280, 800);
    await expect(page.getByRole("navigation", { name: "In this report" })).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .include(NAV)
      .withTags(["wcag2a", "wcag2aa", "best-practice"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
