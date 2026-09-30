import { test, expect } from "@playwright/test";

const A4_CONTENT_WIDTH = 673;

test.describe("report print sheet", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: A4_CONTENT_WIDTH, height: 1000 });
    await page.emulateMedia({ media: "print" });
    await page.goto("/dev/audit-report/print");
    await page.locator("html[data-hydrated]").waitFor();
  });

  test("carries none of the site's nav or footer", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
    await expect(page.getByText("HQ MAILING ADDRESS")).toHaveCount(0);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator(".sheet footer")).toHaveCount(1);
  });

  test("opens on its own title block", async ({ page }) => {
    await expect(page.locator(".sheet header h1")).toBeVisible();
    const text = (await page.locator("main").innerText()).trim();
    expect(text).toMatch(/^AEO \/ SEO Audit Report for:/i);
  });

  test("sets its own type rather than the site's", async ({ page }) => {
    const type = await page.evaluate(() => {
      const px = (el: Element, prop: "fontSize" | "lineHeight") =>
        parseFloat(getComputedStyle(el)[prop]);
      const plain = [...document.querySelectorAll(".sheet p")].filter((el) =>
        [...el.classList].every((c) => c.startsWith("svelte-")),
      );
      const h3 = [...document.querySelectorAll(".sheet h3")];
      return {
        drift: plain.map((el) => px(el, "fontSize") - px(el.parentElement!, "fontSize")),
        h3LineRatios: h3.map((el) => px(el, "lineHeight") / px(el, "fontSize")),
      };
    });
    expect(type.drift.length).toBeGreaterThan(0);
    expect(new Set(type.drift)).toEqual(new Set([0]));
    expect(type.h3LineRatios.length).toBeGreaterThan(0);
    for (const ratio of type.h3LineRatios) expect(ratio).toBeLessThan(2);
  });
});
