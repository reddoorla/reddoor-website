import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The layout wraps <main id="main-content"> in `{#key data.pathname}` and
// crossfades it: `out:fade` over 500ms against `in:fade` with a 700ms delay.
// For as long as the outgoing copy is still mounted, the document holds TWO
// elements carrying the same id and TWO `main` landmarks — `duplicate-id` and
// `landmark-one-main`, both WCAG failures, on every client-side navigation.
//
// This is a site defect, not a test artifact: assistive technology navigates by
// landmark, and a second `main` appearing for half a second is exactly the kind
// of thing a screen-reader user hits and no sighted reviewer ever sees. It also
// explains why schedule.spec.ts's axe checks flake — those tests scan a page
// they have just navigated into, so whether they see one `main` or two depends
// on how fast the machine happened to be.
//
// Deliberately measured with NO reduced-motion emulation: this asserts what a
// visitor with default settings gets.

test("a client-side navigation never exposes two main landmarks", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });

  // Sample across the whole crossfade window rather than at one instant: the
  // overlap is transient, so a single check lands on either side of it by luck.
  const counts: number[] = [];
  const sampling = (async () => {
    for (let i = 0; i < 40; i++) {
      counts.push(await page.locator("main").count());
      await page.waitForTimeout(50);
    }
  })();

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  await sampling;

  expect({ max: Math.max(...counts), saw: [...new Set(counts)].sort() }).toEqual({
    max: 1,
    saw: [1],
  });
});

test("axe finds no violations mid-navigation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  // Mid-crossfade on purpose — the outgoing main is still mounted here.
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations.map((v) => v.id)).toEqual([]);
});
