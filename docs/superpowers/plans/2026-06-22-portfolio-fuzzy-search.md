# Portfolio Fuzzy Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fuzzy, debounced text search to the portfolio archive grid that filters cards by title, services, tagline, and first body paragraph — combining with the existing category buttons while the sort dropdown keeps controlling order.

**Architecture:** Pure client-side. The page loader already ships full project data to the browser, so search needs no server changes. A small util turns each project into a flat search record; Fuse.js indexes them; a ~250ms debounce feeds the query to Fuse; the resulting set of matching `uid`s combines (AND) with the existing category filters via a single `isVisible(project)` predicate. Non-matching cards keep the page's existing CSS-hide pattern (`opacity-0 absolute`) so the `flip` sort animation still works.

**Tech Stack:** SvelteKit + Svelte 5 runes, Prismic (`@prismicio/client` `asText`), Fuse.js (new dep), Tailwind v4, `@lucide/svelte` icons, Playwright (existing smoke-test infra) for verification. pnpm 11.

**Branch:** Create a fresh branch off `main` before starting (current branch `perf/bestpractices-cookies` is unrelated): `git checkout main && git pull && git checkout -b feat/portfolio-search`.

**Commit policy:** The repo owner does not auto-commit — at each "Commit" step, stage and show the diff, then let the owner run the commit (or confirm upfront that the executor may commit). See `feedback_notify_on_handoff` / `feedback_no_autonomous_commits`.

---

## File Structure

- **Modify** `src/lib/utils/projectServices.ts` — add `ProjectSearchRecord` interface + `toSearchRecord(project)` next to the existing `mediumString`. One responsibility: turn a project into searchable text.
- **Modify** `src/routes/[[preview=preview]]/portfolio/+page.svelte` — add Fuse instance, search state, debounce, `matchedUids`, `isVisible`, `visibleCount` (script); add the search input + no-results block and swap the card visibility expression to `isVisible` (template).
- **Modify** `package.json` / `pnpm-lock.yaml` — add `fuse.js` dependency.
- **Create** `tests/smoke/portfolio-search.spec.ts` — Playwright integration test for filter / fuzzy / clear / no-results, matching the existing `tests/smoke/pages.spec.ts` style.

---

## Task 1: Add the Fuse.js dependency

**Files:**

- Modify: `package.json` (dependencies), `pnpm-lock.yaml`

- [ ] **Step 1: Install Fuse.js**

Run:

```bash
pnpm add fuse.js
```

Expected: `package.json` gains `"fuse.js": "^7.x"` under `dependencies`; lockfile updates. Fuse.js is a stable, long-published package, so the pnpm 11 24h release-age cooldown will not block it.

- [ ] **Step 2: Verify it resolves**

Run:

```bash
pnpm exec node -e "import('fuse.js').then(m => console.log(typeof m.default))"
```

Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add fuse.js for portfolio search"
```

---

## Task 2: Add the `toSearchRecord` search util

**Files:**

- Modify: `src/lib/utils/projectServices.ts`

- [ ] **Step 1: Add the import, interface, and function**

At the top of `src/lib/utils/projectServices.ts`, add `asText` and the exported `RichTextSlice` type to the Prismic imports (the file currently only imports the `ProjectDocument` type):

```ts
import { asText } from "@prismicio/client";
import type { ProjectDocument, RichTextSlice } from "../../prismicio-types";
```

Then append to the end of the file:

```ts
export interface ProjectSearchRecord {
  uid: string;
  title: string;
  services: string;
  tagline: string;
  body: string;
}

/**
 * Flattens a project into the text fields the portfolio search indexes:
 * title, its service labels, its tagline, and the first body paragraph
 * (the first block of the first rich_text slice). Missing fields degrade
 * to "".
 */
export function toSearchRecord(project: ProjectDocument): ProjectSearchRecord {
  // Type-guard predicate so TS narrows the slice union to RichTextSlice and
  // `.primary.content` type-checks (a plain `=== "rich_text"` find does not narrow).
  const firstRichText = project.data.slices.find(
    (s): s is RichTextSlice => s.slice_type === "rich_text",
  );
  const body = asText(firstRichText?.primary.content?.slice(0, 1) ?? []);
  return {
    uid: project.uid ?? "",
    title: project.data.title ?? "",
    services: mediumString(project),
    tagline: project.data.tagline ?? "",
    body,
  };
}
```

Note: `mediumString` is already defined in this file — reuse it, do not duplicate the service-label logic.

- [ ] **Step 2: Type-check**

Run:

```bash
pnpm check
```

Expected: PASS (0 errors). If `asText` complains about the argument type, the field is `firstRichText.primary.content` (a `RichTextField`); `?.slice(0, 1) ?? []` yields a `RichTextField`-compatible array.

- [ ] **Step 3: Lint/format**

Run:

```bash
pnpm format && pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/projectServices.ts
git commit -m "feat: add toSearchRecord util for portfolio search"
```

---

## Task 3: Add search state, Fuse, debounce, and the visibility predicate (script)

**Files:**

- Modify: `src/routes/[[preview=preview]]/portfolio/+page.svelte` (script block, lines ~1–120)

- [ ] **Step 1: Add imports**

Merge `Search` and `X` into the existing `@lucide/svelte` import (currently `import { ArrowDown, ChevronDown, Minus } from "@lucide/svelte";`):

```ts
import { ArrowDown, ChevronDown, Minus, Search, X } from "@lucide/svelte";
```

Add `toSearchRecord` to the existing `projectServices` import (currently `import { mediumString } from "$lib/utils/projectServices";`):

```ts
import { mediumString, toSearchRecord } from "$lib/utils/projectServices";
```

Add the Fuse import (top of the script, with the other imports):

```ts
import Fuse from "fuse.js";
```

- [ ] **Step 2: Add the Fuse instance, search state, debounce, and matched set**

Add these right after the existing `sortedProjects` derived (around line 103, after its closing `);`):

```ts
const fuse = $derived(
  new Fuse(data.allProjects.map(toSearchRecord), {
    keys: [
      { name: "title", weight: 3 },
      { name: "services", weight: 2 },
      { name: "tagline", weight: 1.5 },
      { name: "body", weight: 1 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }),
);

let searchQuery = $state("");
let debouncedQuery = $state("");

// ~250ms debounce. Writes a DIFFERENT state var (debouncedQuery) than the one
// it reads (searchQuery), so it does not trip the Svelte 5 $effect self-write
// scheduler bug.
$effect(() => {
  const q = searchQuery;
  const id = setTimeout(() => (debouncedQuery = q), 250);
  return () => clearTimeout(id);
});

// null === "no query, everything matches".
const matchedUids = $derived.by<Set<string> | null>(() => {
  const q = debouncedQuery.trim();
  if (q.length < 2) return null;
  return new Set(fuse.search(q).map((r) => r.item.uid));
});

function isVisible(project: ProjectDocument<string>): boolean {
  const categoryMatch =
    showAll ||
    (project.data.branding && showBrand) ||
    (project.data.digital && showDigital) ||
    (project.data.environmental && showEnvironmental) ||
    (project.data.print && showPrint) ||
    (project.data.product && showProduct) ||
    (project.data.packaging && showPackaging);
  const searchMatch = matchedUids === null || matchedUids.has(project.uid ?? "");
  return Boolean(categoryMatch) && searchMatch;
}

const visibleCount = $derived(sortedProjects.filter(isVisible).length);
```

(`ProjectDocument` is already imported in this component; `showAll`, `showBrand`, etc. are already declared above. The category clause is copied verbatim from the existing inline expression so behavior is unchanged when no query is active.)

- [ ] **Step 3: Close the sort dropdown when the user starts typing**

In the existing dropdown-closing `$effect` (the one with the `_deps` array, ~lines 67–80), add `searchQuery` to the dependency list so typing collapses the open sort menu:

```ts
const _deps = [
  showBrand,
  showDigital,
  showEnvironmental,
  showProduct,
  showPrint,
  showWeb,
  showPackaging,
  orderString,
  searchQuery,
];
```

- [ ] **Step 4: Type-check**

Run:

```bash
pnpm check
```

Expected: PASS (0 errors). `isVisible` is referenced by `visibleCount`, so it is not an unused symbol.

- [ ] **Step 5: Commit**

```bash
git add src/routes/'[[preview=preview]]'/portfolio/+page.svelte
git commit -m "feat: portfolio search state, Fuse index, and debounce"
```

---

## Task 4: Add the search input + no-results UI and wire card visibility (template)

**Files:**

- Modify: `src/routes/[[preview=preview]]/portfolio/+page.svelte` (template, lines ~389–525)

- [ ] **Step 1: Insert the search input as the first item in the filter row**

The category buttons live in `<div use:anim class="flex flex-row gap-4 mb-24 flex-wrap max-w-full">` (around line 390). Insert this block as the **first child** of that div, immediately before the `BRAND` button:

```svelte
<div class="relative flex items-center">
  <Search
    class="absolute left-3 size-4 text-light pointer-events-none"
    strokeWidth={1.5}
    aria-hidden="true"
  />
  <label for="portfolio-search" class="sr-only">Search projects</label>
  <input
    id="portfolio-search"
    type="search"
    data-testid="portfolio-search"
    placeholder="Search projects…"
    bind:value={searchQuery}
    class="h-[44px] w-56 max-w-full border-1 border-light pl-9 pr-9 text-light placeholder:text-light/60 focus:border-primary focus:text-primary focus:outline-none transition-colors duration-500"
  />
  {#if searchQuery}
    <button
      type="button"
      aria-label="Clear search"
      data-testid="portfolio-search-clear"
      onclick={() => (searchQuery = "")}
      class="absolute right-2 text-light hover:text-primary transition-colors duration-300"
    >
      <X class="size-4" strokeWidth={1.5} />
    </button>
  {/if}
</div>
```

- [ ] **Step 2: Swap the card visibility expression to `isVisible`**

In the `{#each sortedProjects as project (project.uid)}` block (around lines 484–495), the card wrapper `<div animate:flip …>` currently selects its class with a long inline category ternary. Replace that whole inline condition with the `isVisible(project)` call. The wrapper's `class` attribute becomes exactly:

```svelte
class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-4/3 transition-opacity duration-700 {isVisible(project)
  ? "relative"
  : "absolute top-1/2 left-1/2 opacity-0 pointer-events-none"}"
```

(Leave the rest of the card markup — the `<a>`, image, gradient, title — untouched. Cards stay mounted; only their positioning/opacity changes, so `animate:flip` still animates sort reordering.)

- [ ] **Step 3: Add the no-results block**

Immediately after the grid container `<div class="w-full md:ml-[20%] md:w-4/5 flex flex-row flex-wrap"> … </div>` closes (i.e., after the `{/each}`'s wrapping div, before the closing `</ContentWidth>` around line 524), add:

```svelte
{#if visibleCount === 0}
  <div class="w-full md:ml-[20%] md:w-4/5 py-16 text-center" data-testid="portfolio-search-empty">
    <p class="text-light">No projects match "{debouncedQuery}"</p>
    <button
      type="button"
      onclick={() => (searchQuery = "")}
      class="mt-4 px-5 py-[10px] border-1 border-light text-light hover:border-primary hover:text-primary transition-colors duration-500"
    >
      Clear search
    </button>
  </div>
{/if}
```

(Hidden cards are `absolute`, so they collapse the grid's height to ~0 and this message shows cleanly in the space.)

- [ ] **Step 4: Type-check, lint, and eyeball in the browser**

Run:

```bash
pnpm check && pnpm format && pnpm lint
```

Expected: PASS.

Then run `pnpm dev`, open `/portfolio`, scroll to "But wait, there's more!", and confirm: the search box renders left of the category buttons; typing filters the grid after a brief pause; a clear (×) appears and works; gibberish shows the no-results message; the category buttons still filter and combine with search.

- [ ] **Step 5: Commit**

```bash
git add src/routes/'[[preview=preview]]'/portfolio/+page.svelte
git commit -m "feat: portfolio search input, clear button, and no-results state"
```

---

## Task 5: Add a Playwright integration test

**Files:**

- Create: `tests/smoke/portfolio-search.spec.ts`

This follows the existing `tests/smoke/pages.spec.ts` conventions (relative `page.goto`, real Prismic data). Assertions are data-agnostic: they read a real project title from the DOM rather than hard-coding one, and detect hidden cards by the `opacity-0` class (Playwright treats `opacity:0` elements as "visible", so we cannot use `toBeVisible` for the CSS-hide pattern).

- [ ] **Step 1: Write the test file**

Create `tests/smoke/portfolio-search.spec.ts`:

```ts
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

test.describe("portfolio archive search", () => {
  test("filters the grid by title and clears", async ({ page }) => {
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
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
    await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
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
});
```

- [ ] **Step 2: Run the test**

Run:

```bash
pnpm exec playwright test tests/smoke/portfolio-search.spec.ts
```

Expected: PASS (2 tests). The shared Playwright config (`@reddoorla/maintenance/configs/playwright-a11y`) provides the base URL / web server, same as the existing smoke tests. (Run against pre-feature code, it would FAIL at `getByTestId("portfolio-search")` — that is the proof the test exercises the new UI.)

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/portfolio-search.spec.ts
git commit -m "test: portfolio archive search filter/fuzzy/clear"
```

---

## Final verification

- [ ] `pnpm check` — 0 type errors
- [ ] `pnpm lint` — clean
- [ ] `pnpm exec playwright test tests/smoke/portfolio-search.spec.ts` — 2 passed
- [ ] Manual: `/portfolio` → archive section → search filters after a pause, combines with a category button (AND), respects the sort dropdown order, clears, and shows the no-results state on gibberish.

## Out of scope (do not build)

Relevance-ranked ordering, searching the curated top showcase, server-side/Prismic `fulltext` querying, full-body search beyond the first paragraph, URL persistence of the query, result highlighting.
