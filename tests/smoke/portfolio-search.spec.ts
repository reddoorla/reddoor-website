import { test, expect, type Page } from "@playwright/test";

const ARCHIVE_LINKS = '#projectsDiv a[href^="/portfolio/"]';

// Cards are CSS-hidden (opacity-0 + absolute), not removed from the DOM, so
// count "shown" cards by excluding any whose wrapper carries the opacity-0 class.
async function shownCardCount(page: Page): Promise<{ total: number; shown: number }> {
  const links = page.locator(ARCHIVE_LINKS);
  const total = await links.count();
  const hidden = await links.evaluateAll(
    (els) => els.filter((el) => (el as HTMLElement).closest('[class*="opacity-0"]')).length,
  );
  return { total, shown: total - hidden };
}

async function firstProjectTitle(page: Page): Promise<string> {
  const title = (await page.locator(`${ARCHIVE_LINKS} p`).first().textContent())?.trim();
  expect(title, "read a project title from the first archive card").toBeTruthy();
  return title!;
}

// Titles of the currently-shown archive cards, in display order (excludes
// CSS-hidden cards). Index 0 is the first card in the rendered order.
async function visibleTitlesInOrder(page: Page): Promise<string[]> {
  return page.locator(ARCHIVE_LINKS).evaluateAll((els) =>
    els
      .filter((el) => !(el as HTMLElement).closest('[class*="opacity-0"]'))
      .map((el) => el.querySelector("p")?.textContent?.trim() ?? "")
      .filter(Boolean),
  );
}

test.describe("portfolio archive search", () => {
  test("filters the grid by title and clears", async ({ page }) => {
    // networkidle ensures Svelte has fully hydrated and bind:value is wired up.
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page.locator("footer")).toBeVisible();

    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();

    const { total } = await shownCardCount(page);
    expect(total, "archive has multiple project cards").toBeGreaterThan(1);

    // Searching a real title narrows the grid but keeps the matching card.
    const title = await firstProjectTitle(page);
    await search.fill(title);
    await page.waitForTimeout(400); // ~250ms debounce + Fuse
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();
    const narrowed = await shownCardCount(page);
    expect(narrowed.shown, "matching card stays shown").toBeGreaterThan(0);
    expect(narrowed.shown, "non-matching cards hidden").toBeLessThan(total);

    // Clear restores the full grid (target the input's × by testid to avoid the
    // no-results "Clear search" button's matching accessible name).
    await page.getByTestId("portfolio-search-clear").click();
    await page.waitForTimeout(400);
    const cleared = await shownCardCount(page);
    expect(cleared.shown, "all cards shown after clear").toBe(total);
  });

  test("tolerates a typo and shows a no-results state", async ({ page }) => {
    // networkidle ensures Svelte has fully hydrated and bind:value is wired up.
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();

    // Drop the last character to simulate a typo; fuzzy match should still hit.
    const title = await firstProjectTitle(page);
    const typo = title.slice(0, Math.max(2, title.length - 1));
    await search.fill(typo);
    await page.waitForTimeout(400);
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();
    const fuzzy = await shownCardCount(page);
    expect(fuzzy.shown, "typo still matches via fuzzy search").toBeGreaterThan(0);

    // Gibberish yields the no-results message.
    await search.fill("zzqqxhjklvwxyz");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("portfolio-search-empty")).toBeVisible();
  });

  test("ranks the best match first while searching", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page.getByTestId("portfolio-search")).toBeVisible();

    const titles = await visibleTitlesInOrder(page);
    expect(titles.length, "need multiple projects to test ordering").toBeGreaterThan(1);

    // Pick a project that is NOT currently first, so relevance ordering has to
    // move it to the front. Its exact title is its own best match.
    const target = titles[titles.length - 1];
    expect(target, "target differs from the current first card").not.toBe(titles[0]);

    await page.getByTestId("portfolio-search").fill(target);
    await page.waitForTimeout(400);

    const ordered = await visibleTitlesInOrder(page);
    expect(ordered[0], "exact-title match is ranked first").toBe(target);
  });
});
