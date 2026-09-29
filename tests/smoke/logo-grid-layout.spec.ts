import { test, expect } from "@playwright/test";

const PATH = "/dev/a11y-fixtures";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="210"><rect width="600" height="210" fill="#2a2f33"/></svg>`;

const measure = () => {
  const cells = [...document.querySelectorAll('[data-slice-type="logo_grid"] ul > li')];
  return cells.map((li) => {
    const img = li.querySelector("img");
    const c = li.getBoundingClientRect();
    const r = img?.getBoundingClientRect();
    return {
      cellCentre: c.x + c.width / 2,
      logoCentre: r ? r.x + r.width / 2 : null,
      logoWidth: r?.width ?? null,
      cellWidth: c.width,
      cellHeight: c.height,
    };
  });
};

test.describe("logo grid layout", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.route("**/images.prismic.io/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH);
    await page.locator("html[data-hydrated]").waitFor();
    await page.locator('[data-slice-type="logo_grid"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-slice-type="logo_grid"] ul > li img')].every(
        (img) => (img as HTMLImageElement).complete,
      ),
    );
  });

  test("every logo is centred in its column", async ({ page }) => {
    const cells = await page.evaluate(measure);
    expect(cells.length).toBe(3);
    for (const cell of cells) {
      expect(cell.logoCentre).not.toBeNull();
      expect(Math.abs((cell.logoCentre ?? 0) - cell.cellCentre)).toBeLessThanOrEqual(1);
    }
  });

  test("a logo width set in Prismic is the width it draws at", async ({ page }) => {
    const cells = await page.evaluate(measure);
    expect(cells[1].logoWidth).toBe(150);
    expect(cells[2].logoWidth).toBe(300);
    expect(cells[0].logoWidth).not.toBe(150);
  });

  for (const width of [390, 768, 1024, 1280]) {
    test(`logo widths scale together when the row is smaller at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('[data-slice-type="logo_grid"]').scrollIntoViewIfNeeded();
      const cells = await page.evaluate(measure);
      const scale = Math.min(1, cells[2].cellWidth / 300, cells[2].cellHeight / 105);
      expect(scale).toBeLessThan(1);
      expect(cells[1].logoWidth).toBeCloseTo(150 * scale, 0);
      expect(cells[2].logoWidth).toBeCloseTo(300 * scale, 0);
      expect((cells[2].logoWidth ?? 0) / (cells[1].logoWidth ?? 1)).toBeCloseTo(2, 2);
    });
  }
});
