import { test, expect } from "@playwright/test";

// Tim's MarkUp round on /boise, pins 1-3: "this width is fixed but doesn't
// match the structure of the rest of the website. It seems like it should have
// a minimum and then shrink to this width. If you scroll down, the three
// columns, the logos are in. Kind of do that."
//
// He was describing dead space. The rail grid was written in pixels — a 240px
// rail and a 760px (or 1004px) content column — so a row stopped at 1000px
// inside a container that is 1391px wide at 1512, leaving 391px empty on the
// right, while every other page on the site grows into it. The grid is now
// proportional, so the assertion is simply that a row reaches the same right
// edge as the container everything else is measured against.
//
// This is the guard that would have caught the defect in the first place: it is
// about the row's relationship to ContentWidth, which is what Tim could see,
// rather than any particular number of pixels.
type Row = { label: string; shortBy: number; railPct: number };

const PATHS = ["/medtech", "/boise"] as const;

// 1024 is the narrowest width where the rail exists at all; 1920 is past
// ContentWidth's 1440 cap, where a fixed row's dead space was worst.
const WIDTHS = [1024, 1200, 1512, 1920];

const MEASURE = `(() => {
  const rows = [];
  document.querySelectorAll('div[class*="lg:grid-cols-[20%"]').forEach((grid) => {
    const container = grid.closest('div[class*="max-w-[1220px]"]');
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const cells = [...grid.children];
    const content = cells[cells.length - 1].getBoundingClientRect();
    const rail = cells[0].getBoundingClientRect();
    const label = grid.querySelector(".type-kicker");
    rows.push({
      label: (label ? label.textContent : "" || "").trim().replace(/\\s+/g, " ").slice(0, 30) || "(unlabelled)",
      shortBy: Math.round(cRect.right - content.right),
      railPct: Math.round((rail.width / cRect.width) * 100),
    });
  });
  return rows;
})()`;

for (const path of PATHS) {
  for (const width of WIDTHS) {
    test(`industry rows fill the page gutter — ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.waitForSelector('div[class*="lg:grid-cols-[20%"]');

      const rows = await page.evaluate<Row[]>(MEASURE);

      // Nothing measured would pass every assertion below it.
      expect(rows.length).toBeGreaterThanOrEqual(5);

      for (const row of rows) {
        // 1px for sub-pixel column rounding. Before this change the same
        // measurement was 391px at 1512 and 440px at 1920.
        expect(
          Math.abs(row.shortBy),
          `${row.label} stops ${row.shortBy}px short of the page gutter`,
        ).toBeLessThanOrEqual(1);

        // The rail stays a fifth at every width — the proportion the board's
        // own 240px encodes at ContentWidth's 1220px cap.
        expect(row.railPct, `${row.label}'s rail is ${row.railPct}% of the row`).toBe(20);
      }
    });
  }
}
