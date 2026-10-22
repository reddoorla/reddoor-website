import { test, expect } from "@playwright/test";

// Tim, 2026-10-22: "on all the confirmation pages the headline is misaligned
// to the body copy below." Every booking page puts its headline on the site's
// content column (`md:ml-[20%]` inside ContentWidth, as /contact and the
// portfolio do) and its body in the `md:w-4/5` column beside a `md:w-1/5`
// kicker. The funnel's row also carried `gap-8`, which pushed the body 32px
// right of the headline at every desktop width (322.5 vs 354.5 at 1440).
//
// So the assertion is that the two share a left edge, on every state
// /preview/funnel renders. /contact is the control: the same template, and
// the page the site's grid was taken from.
//
// Untagged on purpose: a geometry pin belongs to the scaffold tier.

const WIDTHS = [390, 768, 1024, 1440, 1920];

async function edges(page: import("@playwright/test").Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".bg-paper")].flatMap((band) => {
      const head = band.querySelector("h1, h4");
      const row = band.nextElementSibling;
      const body = row?.querySelector(".funnel-body") ?? row?.querySelector(".md\\:w-4\\/5");
      if (!head || !body) return [];
      return [
        {
          label: head.textContent?.trim() ?? "",
          head: head.getBoundingClientRect().left,
          body: body.getBoundingClientRect().left,
        },
      ];
    }),
  );
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("/contact (control): headline and body share a left edge", async ({ page }) => {
      await page.goto("/contact");
      const rows = await edges(page);
      expect(rows.length).toBe(1);
      expect(rows[0].body).toBeCloseTo(rows[0].head, 0);
    });

    test("/preview/funnel: every state's headline and body share a left edge", async ({ page }) => {
      await page.goto("/preview/funnel");
      const rows = await edges(page);
      // Thirteen states today; at least the four page components must show.
      expect(rows.length).toBeGreaterThanOrEqual(4);
      for (const r of rows) {
        expect(r.body, `"${r.label}": body ${r.body} vs headline ${r.head}`).toBeCloseTo(r.head, 0);
      }
    });
  });
}
