import { test, expect } from "@playwright/test";

// The industry pages sit on the board's five-column grid ("Sales Funnel v2" in
// RD Sales Funnel LP: 5 stretch columns, 20px gutter). Two rounds of feedback
// shaped it, and this spec guards both:
//
// - Tim's MarkUp round on /boise, pins 1-3: the rows were written in fixed px
//   (a 240px rail, a 760px content column) and stopped dead while the page
//   around them grew — 391px of dead space at 1512. So the grid must SCALE
//   with ContentWidth.
// - Tim, 2026-09-23: the fix for that ran every row to the page gutter, but
//   the board keeps prose to columns 2–4 and leaves column 5 empty. Only the
//   logo grid and the FAQ list run to column 5.
//
// So the assertion is the grid itself, derived from the container at every
// width: the rail is one column, content starts on column 2, and ends on
// column 4 or 5 depending on the slice. The featured-project plate and the
// hero's intro are not RailRows but sit on the same lines, and they are the
// two that drifted before — the plate's 260px padding outlived the rail it
// was copied from — so they are measured here too.
type Row = {
  label: string;
  type: string;
  railW: number | null;
  left: number;
  right: number;
  col: number;
};

const PATHS = ["/medtech", "/boise"] as const;

// 1024 is the narrowest width where the rail exists at all; 1920 is past
// ContentWidth's 1440 cap.
const WIDTHS = [1024, 1200, 1512, 1920];

// Slices whose content runs to the right margin (grid columns 2–5).
const WIDE = new Set(["accordion", "logo_grid", "featured_project"]);

const GUTTER = 20;

const MEASURE = `(() => {
  const GUTTER = ${GUTTER};
  const out = [];
  const containerOf = (el) => el.closest('div[class*="max-w-[1220px]"]');
  const push = (type, label, container, box, railW) => {
    const c = container.getBoundingClientRect();
    out.push({
      label, type, railW,
      left: box.left - c.left,
      right: box.right - c.left,
      col: (c.width - 4 * GUTTER) / 5,
    });
  };
  document.querySelectorAll("[data-rail-row]").forEach((grid) => {
    const container = containerOf(grid);
    if (!container) return;
    const cells = [...grid.children];
    const label = grid.querySelector(".type-kicker");
    const type = grid.closest("[data-slice-type]")?.getAttribute("data-slice-type") ?? "?";
    push(
      type,
      ((label && label.textContent) || "(unlabelled)").trim().replace(/\\s+/g, " ").slice(0, 30),
      container,
      cells[cells.length - 1].getBoundingClientRect(),
      cells[0].getBoundingClientRect().width,
    );
  });
  document.querySelectorAll('[data-slice-type="featured_project"]').forEach((s) => {
    const plate = s.querySelector('div[class*="lg:pl-"]');
    const container = plate && containerOf(plate);
    if (!container) return;
    const r = plate.getBoundingClientRect();
    const pl = parseFloat(getComputedStyle(plate).paddingLeft);
    push("featured_project", "(featured project plate)", container, { left: r.left + pl, right: r.right }, null);
  });
  document.querySelectorAll('[data-slice-type="industry_hero"]').forEach((s) => {
    const intro = s.querySelector('[class*="lg:col-start-5"]');
    const container = intro && containerOf(intro);
    if (!container) return;
    push("industry_hero", "(hero intro)", container, intro.getBoundingClientRect(), null);
  });
  return out;
})()`;

for (const path of PATHS) {
  for (const width of WIDTHS) {
    test(`industry sections sit on the five-column grid — ${path} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await page.waitForSelector("[data-rail-row]");

      const rows = await page.evaluate<Row[]>(MEASURE);

      // Nothing measured would pass every assertion below it. Both pages carry
      // at least five rail rows, a featured project and a hero.
      expect(rows.filter((r) => r.railW !== null).length).toBeGreaterThanOrEqual(5);
      expect(rows.some((r) => r.type === "featured_project" && r.railW === null)).toBe(true);
      expect(rows.some((r) => r.type === "industry_hero")).toBe(true);

      for (const row of rows) {
        const { col } = row;
        // Column n (1-based) starts at (n-1)(col+gutter) and ends at
        // n·col + (n-1)·gutter. 1px for sub-pixel track rounding.
        const start = (n: number) => (n - 1) * (col + GUTTER);
        const end = (n: number) => n * col + (n - 1) * GUTTER;

        if (row.type === "industry_hero") {
          expect(
            Math.abs(row.left - start(5)),
            `the hero intro starts at ${row.left.toFixed(1)}, column 5 at ${start(5).toFixed(1)}`,
          ).toBeLessThanOrEqual(1);
          continue;
        }

        expect(
          Math.abs(row.left - start(2)),
          `${row.label} (${row.type}) starts at ${row.left.toFixed(1)}, column 2 at ${start(2).toFixed(1)}`,
        ).toBeLessThanOrEqual(1);

        const lastCol = WIDE.has(row.type) ? 5 : 4;
        expect(
          Math.abs(row.right - end(lastCol)),
          `${row.label} (${row.type}) ends at ${row.right.toFixed(1)}, column ${lastCol} at ${end(lastCol).toFixed(1)}`,
        ).toBeLessThanOrEqual(1);

        if (row.railW !== null) {
          expect(
            Math.abs(row.railW - col),
            `${row.label}'s rail is ${row.railW.toFixed(1)}px, a column is ${col.toFixed(1)}px`,
          ).toBeLessThanOrEqual(1);
        }
      }
    });
  }
}
