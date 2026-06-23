import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { a11yRoutes } from "@reddoorla/maintenance/configs/playwright-a11y";

// The `/dev/*` routes exist specifically as stable axe-core targets (the
// /dev/a11y-fixtures page self-describes as one). `@axe-core/playwright` was
// installed for exactly this but no test ever ran it — this wires up that
// coverage: every a11yRoute must report zero axe violations.
//
// On failure we assert against a readable summary (rule id + help + node count)
// rather than the raw violation objects, so the diff names the problem instead
// of dumping DOM.
test.describe("axe-core accessibility (dev fixtures)", () => {
  for (const route of a11yRoutes) {
    test(`${route.name} (${route.path}) has no axe violations`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "networkidle" });

      // a11yRoutes is shared across the fleet; not every site implements every
      // fixture route (e.g. /dev/animate-in). Skip-with-reason a missing route
      // rather than silently auditing the 404 page and reporting a false pass.
      test.skip(
        response?.status() === 404,
        `${route.path} is not present on this site (shared a11yRoutes config)`,
      );

      const { violations } = await new AxeBuilder({ page }).analyze();

      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)).toEqual([]);
    });
  }
});
