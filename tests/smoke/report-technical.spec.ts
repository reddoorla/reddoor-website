import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// W4, the Technical report, over its invented fixture (`/dev/audit-report/technical`).
// Locally, `.audit-sample.json` at the repo root makes it render that sample
// instead; move it aside for a run.

test.describe("the Technical report fixture", { tag: "@smoke" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("fits a 375px phone with every section open", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/dev/audit-report/technical");
    await page.locator("html[data-hydrated]").waitFor();
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => el.setAttribute("open", ""));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("has no axe violations with every section open", async ({ page }) => {
    await page.goto("/dev/audit-report/technical");
    await page.locator("html[data-hydrated]").waitFor();
    for (const d of await page.locator("details").all())
      await d.evaluate((el) => el.setAttribute("open", ""));
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)).toEqual([]);
  });

  test("sends its buttons to the scheduler, carrying the reference", async ({ page }) => {
    await page.goto("/dev/audit-report/technical");
    const links = page.getByRole("link", { name: "Book a call about the first fixes" });
    await expect(links).toHaveCount(2);
    for (const l of await links.all()) {
      await expect(l).toHaveAttribute("href", "/schedule?ref=technical-0a1b2c3d");
    }
  });
});
