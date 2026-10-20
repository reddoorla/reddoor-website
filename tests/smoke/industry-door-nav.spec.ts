import { test, expect, type Page } from "@playwright/test";

const PATH = "/medtech";

const scrollToHeroBottomMinus = (page: Page, offset: number) =>
  expect(async () => {
    const target = await page.evaluate((offset) => {
      const hero = document.querySelector('[data-slice-type="industry_hero"]');
      if (!hero) throw new Error("no industry_hero on the page");
      const y = Math.round(hero.getBoundingClientRect().bottom + window.scrollY - offset);
      window.scrollTo(0, y);
      return y;
    }, offset);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => window.scrollY)).toBe(target);
  }).toPass({ timeout: 10_000 });

test.describe("industry door nav", () => {
  test("the hero carries the door 40px tall, 20px from the top, level with Get Started", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PATH);
    await page.locator("html[data-hydrated]").waitFor();
    const nav = page.locator("[data-door-nav]");
    const door = nav.getByRole("img", { name: "Reddoor Creative" });
    await expect(door).toBeVisible();
    const doorBox = await door.boundingBox();
    const ctaBox = await nav.getByRole("link", { name: "Get Started" }).boundingBox();
    expect(doorBox?.height).toBe(40);
    expect(doorBox?.y).toBe(20);
    expect(ctaBox?.y).toBe(20);
    await expect(nav.getByRole("link", { name: "Portfolio" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
    await expect(page.getByText("Reddoor Creative", { exact: true })).toHaveCount(0);
  });

  test(
    "the hero carries the door and the main links in place of the normal nav",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(PATH);
      await page.locator("html[data-hydrated]").waitFor();
      const nav = page.locator("[data-door-nav]");
      await expect(nav.getByRole("img", { name: "Reddoor Creative" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Portfolio" })).toHaveAttribute(
        "href",
        "/portfolio",
      );
      await expect(nav.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
      await expect(nav.getByRole("link", { name: "Portfolio" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
      const cta = nav.getByRole("link", { name: "Get Started" });
      await expect(cta).toBeVisible();
      await expect(cta).toHaveAttribute("href", "/contact#inquire");
      await expect(page.getByText("Reddoor Creative", { exact: true })).toHaveCount(0);
    },
  );

  test(
    "the normal nav comes back once the hero has scrolled away",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      // Arriving on a hash skips the layout's scroll to the top 600ms after
      // load, which would otherwise undo the scroll below.
      await page.goto(`${PATH}#main-content`);
      await page.locator("html[data-hydrated]").waitFor();
      await page.evaluate(() => {
        const hero = document.querySelector('[data-slice-type="industry_hero"]');
        if (!hero) throw new Error("no industry_hero on the page");
        window.scrollTo(0, Math.round(hero.getBoundingClientRect().bottom + window.scrollY + 50));
      });
      await expect(page.getByText("Reddoor Creative", { exact: true })).toBeVisible();
      await expect(page.locator("[data-door-nav]")).toHaveCount(0);
    },
  );

  test(
    "the normal nav stays away while the hero is under it and comes back after",
    { tag: "@nightly" },
    async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(PATH);
      await page.locator("html[data-hydrated]").waitFor();
      const normalNav = page.getByText("Reddoor Creative", { exact: true });

      await scrollToHeroBottomMinus(page, 200);
      await expect(normalNav).toHaveCount(0);

      await scrollToHeroBottomMinus(page, -50);
      await expect(normalNav).toBeVisible();
      await expect(page.locator("[data-door-nav]")).toHaveCount(0);
      expect((await normalNav.boundingBox())?.y).toBeLessThan(48);

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator("[data-door-nav]")).toBeVisible();
      await expect(normalNav).toHaveCount(0);
    },
  );

  test("on a phone the door sits with the menu button, which opens the menu", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await page.locator("html[data-hydrated]").waitFor();
    const nav = page.locator("[data-door-nav]");
    const doorBox = await nav.getByRole("img", { name: "Reddoor Creative" }).boundingBox();
    expect(doorBox?.height).toBe(40);
    expect(doorBox?.y).toBe(20);
    await expect(nav.getByRole("link", { name: "Portfolio" })).toBeHidden();
    const menu = nav.getByRole("button", { name: "Open menu" });
    const menuBox = await menu.boundingBox();
    expect(Math.abs((menuBox?.y ?? 0) + (menuBox?.height ?? 0) / 2 - 40)).toBeLessThanOrEqual(1);
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  });

  test("on a phone the door's menu button opens the menu", { tag: "@smoke" }, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await page.locator("html[data-hydrated]").waitFor();
    const nav = page.locator("[data-door-nav]");
    await expect(nav.getByRole("img", { name: "Reddoor Creative" })).toBeVisible();
    await nav.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  });
});
