import { test, expect, type Page } from "@playwright/test";

// Every card stays mounted (the FLIP animation keeps filtered-out cards in the DOM
// as display:none so it only ever MOVES survivors), so we must scope to the visible
// ones — Playwright's .count() otherwise includes the hidden cards.
const ARCHIVE_LINKS = '#projectsDiv [data-flip-uid]:not(.hidden) a[href^="/portfolio/"]';

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

// No fixed settles: the search debounces 250ms and the FLIP batch runs
// 900–1550ms (FLIP_MIN/MAX_DURATION), so any hardcoded wait either loses the
// race under parallel-worker CPU contention (the 07-16 brief's flake) or
// overwaits. Poll the observable state instead.
//
// The ceiling is sized for the CI dev server's COLD-COMPILE STORM: at suite
// start every worker's first /portfolio load triggers on-demand vite
// transforms, and the search's lazily-imported Fuse chunk queues behind them —
// observed >10s on 2 of the first 5 CI runs (grid "never" narrowed, then
// neighboring tests timed out on goto). 30s absorbs the storm; the polls
// return the moment the state lands, so green runs pay nothing extra.
const POLL = { timeout: 30_000 };

// Same reasoning for whole tests: 30s default minus a slow first goto leaves
// too little for the actual assertions under contention.
test.describe.configure({ timeout: 60_000 });

// domcontentloaded + the layout's hydration marker instead of networkidle:
// networkidle over-waits (and still under-synchronizes — it can fire before
// hydration under a transform storm). `data-hydrated` is stamped from onMount,
// by which point bind:value and click handlers are live.
async function openPortfolio(page: Page) {
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached(POLL);
}

test.describe("portfolio archive search", () => {
  test("filters the grid by title and clears", async ({ page }) => {
    await openPortfolio(page);
    await expect(page.locator("footer")).toBeVisible();

    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();

    const full = await archiveCount(page);
    expect(full, "archive has multiple project cards").toBeGreaterThan(1);

    // Searching a real title narrows the grid but keeps the matching card.
    const title = (await archiveTitles(page))[0];
    expect(title, "read a project title").toBeTruthy();
    await search.fill(title);
    await expect
      .poll(() => archiveCount(page), { message: "non-matching cards removed", ...POLL })
      .toBeLessThan(full);
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();
    expect(await archiveCount(page), "matching card stays shown").toBeGreaterThan(0);

    // Clear restores the full grid (target the input's × by testid to avoid the
    // no-results "Clear search" button's matching accessible name).
    await page.getByTestId("portfolio-search-clear").click();
    await expect
      .poll(() => archiveCount(page), { message: "all cards shown after clear", ...POLL })
      .toBe(full);
  });

  test("tolerates a typo and shows a no-results state", async ({ page }) => {
    await openPortfolio(page);
    const search = page.getByTestId("portfolio-search");
    await expect(search).toBeVisible();
    const full = await archiveCount(page);

    // Drop the last character to simulate a typo; fuzzy match should still hit.
    // Poll for the grid actually NARROWING — the "Relevance" sort label commits
    // before the lazily-imported Fuse index resolves (rankedUids stays null →
    // full grid), so it can't serve as the results-applied signal: a count
    // assertion against the full grid would pass vacuously.
    const title = (await archiveTitles(page))[0];
    expect(title).toBeTruthy();
    const typo = title.slice(0, Math.max(2, title.length - 1));
    await search.fill(typo);
    await expect
      .poll(() => archiveCount(page), { message: "typo query filters the grid", ...POLL })
      .toBeLessThan(full);
    expect(await archiveCount(page), "typo still matches via fuzzy search").toBeGreaterThan(0);
    await expect(page.getByTestId("portfolio-search-empty")).toBeHidden();

    // Gibberish yields the no-results message (toBeVisible retries built-in).
    await search.fill("zzqqxhjklvwxyz");
    await expect(page.getByTestId("portfolio-search-empty")).toBeVisible(POLL);
  });

  test("ranks the best match first while searching", async ({ page }) => {
    await openPortfolio(page);
    await expect(page.getByTestId("portfolio-search")).toBeVisible();

    const titles = await archiveTitles(page);
    expect(titles.length, "need multiple projects to test ordering").toBeGreaterThan(1);

    // Relevance ordering is only truly exercised when a query matches MORE
    // THAN ONE card — with a single match, matched.sort() is a no-op and a
    // broken comparator still passes. At threshold 0.2 most full-title queries
    // single-match, so: probe up to three candidates whose titles share a
    // ≥5-char token with another title (the only ones that can plausibly
    // multi-match). If one multi-matches, assert the exact-title card ranks
    // first among them; otherwise fall back to the single-match assertion
    // (which still catches search-not-applying: the grid would stay on
    // titles[0]) and record that ordering wasn't exercisable.
    const search = page.getByTestId("portfolio-search");
    const tokens = (t: string) =>
      t
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 5);
    const candidates = titles
      .filter(
        (t, idx) =>
          idx !== 0 && tokens(t).some((w) => titles.some((o) => o !== t && tokens(o).includes(w))),
      )
      .slice(0, 3);
    const fallback = titles[titles.length - 1];

    let exercisedOrdering = false;
    for (const target of candidates.length ? candidates : [fallback]) {
      await search.fill(target);
      await expect
        .poll(async () => (await archiveTitles(page))[0], {
          message: "exact-title match is ranked first",
          ...POLL,
        })
        .toBe(target);
      if ((await archiveCount(page)) > 1) {
        exercisedOrdering = true;
        break;
      }
      await page.getByTestId("portfolio-search-clear").click();
      await expect.poll(() => archiveCount(page), POLL).toBe(titles.length);
    }
    if (!exercisedOrdering) {
      test.info().annotations.push({
        type: "coverage",
        description:
          "all probed queries single-matched — relevance comparator not exercised against current content",
      });
    }
  });

  test("exposes a filter button for every category, including Packaging", async ({ page }) => {
    await openPortfolio(page);
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
    await expect
      .poll(() => archiveCount(page), { message: "Packaging filter narrows the grid", ...POLL })
      .toBeLessThan(full);
    expect(await archiveCount(page), "Packaging filter shows at least one project").toBeGreaterThan(
      0,
    );
  });

  test("offers a Relevance sort only while searching, and restores the sort on clear", async ({
    page,
  }) => {
    await openPortfolio(page);
    const sort = page.getByTestId("portfolio-sort");
    const relevanceOption = () => page.getByTestId("sort-option").filter({ hasText: "Relevance" });

    // No active search → the dropdown has the four real sorts, no Relevance.
    await expect(sort).toContainText("Latest-Earliest");
    await sort.click();
    await expect(page.getByTestId("sort-option")).toHaveCount(4);
    await expect(relevanceOption()).toHaveCount(0);
    await sort.click(); // close

    // Searching defaults the active sort to Relevance and adds it as an option.
    // (toContainText/toHaveCount retry built-in — no fixed settles needed.)
    const search = page.getByTestId("portfolio-search");
    const title = (await archiveTitles(page))[0];
    await search.fill(title);
    await expect(sort).toContainText("Relevance", POLL);
    await sort.click();
    await expect(page.getByTestId("sort-option")).toHaveCount(5);
    await expect(relevanceOption()).toHaveCount(1);

    // You can switch to a real sort while the query is active…
    await page.getByTestId("sort-option").filter({ hasText: "A-Z" }).click();
    await expect(sort).toContainText("A-Z", POLL);

    // …and back to Relevance, which is still offered while searching.
    await sort.click();
    await relevanceOption().click();
    await expect(sort).toContainText("Relevance", POLL);

    // Clearing the query removes Relevance and restores the default sort.
    await page.getByTestId("portfolio-search-clear").click();
    await expect(sort).toContainText("Latest-Earliest", POLL);
    await sort.click();
    await expect(relevanceOption()).toHaveCount(0);
  });

  test("sort dropdown is an ARIA listbox that closes on outside click and Escape", async ({
    page,
  }) => {
    await openPortfolio(page);
    const sort = page.getByTestId("portfolio-sort");
    await expect(sort).toHaveAttribute("aria-haspopup", "listbox");
    await expect(sort).toHaveAttribute("aria-expanded", "false");

    // Open → ARIA reflects it, listbox + options exposed.
    await sort.click();
    await expect(sort).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('[role="listbox"]')).toHaveCount(1);
    await expect(page.getByRole("option").first()).toBeVisible();

    // Clicking outside (on the inert archive heading) closes it.
    await page.getByRole("heading", { name: "But wait, there's more!" }).click();
    await expect(sort).toHaveAttribute("aria-expanded", "false");

    // Reopen, then Escape closes it and returns focus to the trigger.
    await sort.click();
    await expect(sort).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(sort).toHaveAttribute("aria-expanded", "false");
    await expect(sort).toBeFocused();
  });

  test("category filter buttons expose aria-pressed state", async ({ page }) => {
    await openPortfolio(page);
    const brand = page.getByRole("button", { name: "BRAND", exact: true });
    await expect(brand).toHaveAttribute("aria-pressed", "false");
    await brand.click();
    await expect(brand).toHaveAttribute("aria-pressed", "true");
  });

  test("the archive section title is a real heading", async ({ page }) => {
    await openPortfolio(page);
    // Was a styled <div>; now an <h2> so the archive section has a programmatic heading.
    await expect(page.getByRole("heading", { name: "But wait, there's more!" })).toBeVisible();
  });
});
