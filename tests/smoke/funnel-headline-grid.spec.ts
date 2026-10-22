import { test, expect } from "@playwright/test";

// Tim, 2026-10-22: "on all the confirmation pages the headline is misaligned
// to the body copy below." Every booking and confirmation page puts its
// headline on the site's content column (`md:ml-[20%]` inside ContentWidth,
// as /contact and the portfolio do) and its body in the `md:w-4/5` column
// beside a `md:w-1/5` kicker. Their row also carried `gap-8`, which pushed the
// body 32px right of the headline at every desktop width (322.5 vs 354.5 at
// 1440).
//
// So the assertion is that the two share a left edge, on every state
// /preview/funnel renders and on the other pages built from the same
// template. /contact is the control: the same template, and the page the
// site's grid was taken from.
//
// Untagged on purpose: a geometry pin belongs to the scaffold tier.

const WIDTHS = [390, 768, 1024, 1440, 1920];

// Path, and the fewest hero-over-body rows it must yield, so a selector that
// stops matching fails instead of passing with nothing measured.
const PAGES: [string, number][] = [
  ["/contact", 1],
  // Thirteen states: four on /schedule, /not-a-fit, four each for cancel and
  // reschedule.
  ["/preview/funnel", 13],
  // /schedule with Tim's photo under the kicker, which the builtin copy lacks.
  ["/dev/funnel-photo", 1],
  ["/calendar/AAAAAAAAAAAA", 1],
  ["/meeting-outcome", 1],
  ["/email/unsubscribed", 1],
  ["/email/resubscribed", 1],
];

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

    for (const [path, min] of PAGES) {
      test(`${path}: headline and body share a left edge`, async ({ page }) => {
        await page.goto(path);
        const rows = await edges(page);
        expect(rows.length).toBeGreaterThanOrEqual(min);
        for (const r of rows) {
          expect(r.body, `"${r.label}": body ${r.body} vs headline ${r.head}`).toBeCloseTo(
            r.head,
            0,
          );
        }
      });
    }
  });
}
