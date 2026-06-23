import { test, expect, type Page } from "@playwright/test";

const ARCHIVE_LINKS = '#projectsDiv a[href^="/portfolio/"]';

// Only matching cards are rendered now (the View Transitions rework dropped the
// keep-everything-mounted CSS-hide pattern), so the rendered count IS the
// visible count.
async function archiveCount(page: Page): Promise<number> {
  return page.locator(ARCHIVE_LINKS).count();
}

// Titles of the rendered archive cards, in display order. Index 0 is the first card.
async function archiveTitles(page: Page): Promise<string[]> {
  return page
    .locator(ARCHIVE_LINKS)
    .evaluateAll((els) =>
      els.map((el) => el.querySelector("p")?.textContent?.trim() ?? "").filter(Boolean),
    );
}

// Debounce (250ms) + the ~650ms view transition; a fixed settle keeps the
// DOM-count reads deterministic.
const SETTLE = 700;

test.describe("portfolio archive search", () => {
  test("filters the grid by title and clears", async ({ page }) => {
    // networkidle ensures Svelte has fully hydrated and bind:value is wired up.
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page.locator("footer")).toBeVisible();

    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();

    const full = await archiveCount(page);
    expect(full, "archive has multiple project cards").toBeGreaterThan(1);

    // Searching a real title narrows the grid but keeps the matching card.
    const title = (await archiveTitles(page))[0];
    expect(title, "read a project title").toBeTruthy();
    await search.fill(title);
    await page.waitForTimeout(SETTLE);
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();
    const narrowed = await archiveCount(page);
    expect(narrowed, "matching card stays shown").toBeGreaterThan(0);
    expect(narrowed, "non-matching cards removed").toBeLessThan(full);

    // Clear restores the full grid (target the input's × by testid to avoid the
    // no-results "Clear search" button's matching accessible name).
    await page.getByTestId("portfolio-search-clear").click();
    await page.waitForTimeout(SETTLE);
    expect(await archiveCount(page), "all cards shown after clear").toBe(full);
  });

  test("tolerates a typo and shows a no-results state", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();

    // Drop the last character to simulate a typo; fuzzy match should still hit.
    const title = (await archiveTitles(page))[0];
    expect(title).toBeTruthy();
    const typo = title.slice(0, Math.max(2, title.length - 1));
    await search.fill(typo);
    await page.waitForTimeout(SETTLE);
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();
    expect(await archiveCount(page), "typo still matches via fuzzy search").toBeGreaterThan(0);

    // Gibberish yields the no-results message.
    await search.fill("zzqqxhjklvwxyz");
    await page.waitForTimeout(SETTLE);
    await expect(page.getByTestId("portfolio-search-empty")).toBeVisible();
  });

  test("ranks the best match first while searching", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page.getByTestId("portfolio-search")).toBeVisible();

    const titles = await archiveTitles(page);
    expect(titles.length, "need multiple projects to test ordering").toBeGreaterThan(1);

    // Pick a project that is NOT currently first, so relevance ordering has to
    // move it to the front. Its exact title is its own best match.
    const target = titles[titles.length - 1];
    expect(target, "target differs from the current first card").not.toBe(titles[0]);

    await page.getByTestId("portfolio-search").fill(target);
    await page.waitForTimeout(SETTLE);

    const ordered = await archiveTitles(page);
    expect(ordered[0], "exact-title match is ranked first").toBe(target);
  });

  test("exposes a filter button for every category, including Packaging", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    await expect(page.locator("footer")).toBeVisible();

    // Every CMS category boolean must have a matching button (state ↔ button 1:1).
    // Packaging was previously wired into the filter logic but had no button, so
    // packaging-tagged projects could never be isolated — this guards that gap.
    for (const label of ["BRAND", "PRINT", "ENVIRONMENTAL", "PRODUCT", "DIGITAL", "PACKAGING"]) {
      await expect(
        page.getByRole("button", { name: label, exact: true }),
        `${label} filter button is present`,
      ).toBeVisible();
    }

    // Activating Packaging narrows the grid to packaging-tagged projects.
    const full = await archiveCount(page);
    await page.getByRole("button", { name: "PACKAGING", exact: true }).click();
    await page.waitForTimeout(SETTLE);
    const narrowed = await archiveCount(page);
    expect(narrowed, "Packaging filter shows at least one project").toBeGreaterThan(0);
    expect(narrowed, "Packaging filter narrows the grid").toBeLessThan(full);
  });

  test("offers a Relevance sort only while searching, and restores the sort on clear", async ({
    page,
  }) => {
    await page.goto("/portfolio", { waitUntil: "networkidle" });
    const sort = page.getByTestId("portfolio-sort");
    const relevanceOption = () => page.getByTestId("sort-option").filter({ hasText: "Relevance" });

    // No active search → the dropdown has the four real sorts, no Relevance.
    await expect(sort).toContainText("Latest-Earliest");
    await sort.click();
    await expect(page.getByTestId("sort-option")).toHaveCount(4);
    await expect(relevanceOption()).toHaveCount(0);
    await sort.click(); // close

    // Searching defaults the active sort to Relevance and adds it as an option.
    const search = page.getByTestId("portfolio-search");
    const title = (await archiveTitles(page))[0];
    await search.fill(title);
    await page.waitForTimeout(SETTLE);
    await expect(sort).toContainText("Relevance");
    await sort.click();
    await expect(page.getByTestId("sort-option")).toHaveCount(5);
    await expect(relevanceOption()).toHaveCount(1);

    // You can switch to a real sort while the query is active…
    await page.getByTestId("sort-option").filter({ hasText: "A-Z" }).click();
    await page.waitForTimeout(SETTLE);
    await expect(sort).toContainText("A-Z");

    // …and back to Relevance, which is still offered while searching.
    await sort.click();
    await relevanceOption().click();
    await page.waitForTimeout(SETTLE);
    await expect(sort).toContainText("Relevance");

    // Clearing the query removes Relevance and restores the default sort.
    await page.getByTestId("portfolio-search-clear").click();
    await page.waitForTimeout(SETTLE);
    await expect(sort).toContainText("Latest-Earliest");
    await sort.click();
    await expect(relevanceOption()).toHaveCount(0);
  });
});
