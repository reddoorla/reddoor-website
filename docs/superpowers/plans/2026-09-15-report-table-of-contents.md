# Report Table of Contents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sticky "In this report" list in the audit report's left rail at `lg`+, a plain list under the hero below `lg`, with the current section marked and every entry an anchor.

**Architecture:** One pure function in `narrative.ts` produces the entries from the same data that decides which sections render. `Report.svelte` wraps the four post-hero sections in a `relative` container holding one absolutely positioned column (copying `ContentWidth`'s geometry) whose sticky child is the `<nav>`; the rows keep their `RailRow` grid and pass a new `labelAbove` prop so the rail cells are empty. One IntersectionObserver marks the current section. Spec: `docs/superpowers/specs/2026-09-15-report-table-of-contents-design.md`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind v4, Vitest (node), Playwright smoke against `/dev/audit-report`, `@axe-core/playwright`.

**Working directory:** the worktree `.worktrees/report-toc` on branch `feat/report-toc` (off `staging`). Run every command from there. `pnpm install` is done.

**Conventions:** commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; commit after each task; `pnpm lint` (prettier + eslint) must pass before each commit. Do not push; the controller pushes and opens the PR.

---

### Task 1: `tocEntries` and `TOC_TARGETS` in the narrative layer

**Files:**
- Modify: `src/lib/report/narrative.ts` (append after `allFixes`, which ends the file)
- Test: `src/lib/report/narrative.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/report/narrative.test.ts` (add `tocEntries`, `TOC_TARGETS` to the existing `./narrative` import, and `type Fix` to the `./model` import):

```ts
describe("tocEntries", () => {
  // Only the count of fixes decides whether the section renders, so a
  // placeholder is all the entry needs; the Fix shape is covered elsewhere.
  const oneFix = [{} as unknown as Fix];

  it("lists the five sections in page order when there are fixes", () => {
    expect(tocEntries(oneFix)).toEqual([
      { id: "ai-says", label: "What an AI says about you" },
      { id: "control", label: "What you control" },
      { id: "fixes", label: "What to fix" },
      { id: "passes", label: "What passes, and how we measured" },
      { id: "talk", label: "Talk it through" },
    ]);
  });

  it("omits What to fix when the report renders no fixes", () => {
    const view = toReportView(ALL_PASS_REPORT, null);
    expect(allFixes(view)).toEqual([]);
    expect(tocEntries(allFixes(view)).map((e) => e.id)).toEqual([
      "ai-says",
      "control",
      "passes",
      "talk",
    ]);
  });

  it("only ever emits ids from TOC_TARGETS", () => {
    const known = new Set<string>(Object.values(TOC_TARGETS));
    for (const e of tocEntries(oneFix)) expect(known.has(e.id)).toBe(true);
  });
});
```

If `toReportView` takes a different second argument in this file's existing tests, copy their call exactly.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/report/narrative.test.ts`
Expected: FAIL — `tocEntries` / `TOC_TARGETS` are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/report/narrative.ts`:

```ts
/**
 * The report's top-level sections, keyed by the id their `<section>` carries.
 * One table, used by the contents list, the anchors and the current-section
 * observer, so a renamed id fails a test rather than a jump.
 */
export const TOC_TARGETS = {
  aiSays: "ai-says",
  control: "control",
  fixes: "fixes",
  passes: "passes",
  talk: "talk",
} as const;

export type TocEntry = {
  id: (typeof TOC_TARGETS)[keyof typeof TOC_TARGETS];
  label: string;
};

/**
 * The table of contents: the five sections in page order, minus any the
 * report does not render for this view. Labels are the section titles without
 * their dynamic parts — "3 things to fix, in order" lists as "What to fix".
 */
export function tocEntries(fixes: Fix[]): TocEntry[] {
  return [
    { id: TOC_TARGETS.aiSays, label: "What an AI says about you" },
    { id: TOC_TARGETS.control, label: "What you control" },
    ...(fixes.length ? [{ id: TOC_TARGETS.fixes, label: "What to fix" } as const] : []),
    { id: TOC_TARGETS.passes, label: "What passes, and how we measured" },
    { id: TOC_TARGETS.talk, label: "Talk it through" },
  ];
}
```

`Fix` is already imported in `narrative.ts` (it is the return type of `allFixes`); if not, add it to the `./model` import.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/report/narrative.test.ts`
Expected: PASS, three new tests green.

- [ ] **Step 5: Commit**

```bash
pnpm lint && git add src/lib/report/narrative.ts src/lib/report/narrative.test.ts && git commit -m "feat(report): the contents list, derived from the sections that render

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `RailRow` learns `labelAbove`

**Files:**
- Modify: `src/lib/components/RailRow.svelte`

No unit test: the repo's Vitest runs in the node environment with no component tests. The smoke test in Task 4 asserts the behaviour on the real page.

- [ ] **Step 1: Add the prop**

In the `interface Props` block, after `labelClass?: string;`, add:

```ts
    /** Render the label as the first child of the content column instead of
     *  in the rail, at every width. Below `lg` this changes nothing visible —
     *  the label already stacks above the content there. From `lg` it leaves
     *  the rail cell empty, which the audit report uses to put its sticky
     *  contents list in that column. The cell itself stays, so the grid and
     *  the content column's left edge do not move. */
    labelAbove?: boolean;
```

In the `let { … }: Props = $props();` destructure, add `labelAbove = false,` after `labelClass = "text-primary",`.

- [ ] **Step 2: Render it in the content column**

Change the rail cell's `{#if railLabel}` to `{#if railLabel && !labelAbove}`.

Change the content column from

```svelte
    <div class="min-w-0">
      {@render children()}
    </div>
```

to

```svelte
    <div class="min-w-0">
      {#if railLabel && labelAbove}
        <svelte:element
          this={labelAs}
          use:anim={{ enabled: animateIn && animateItems }}
          class="type-kicker mb-6 {labelClass}"
        >
          {railLabel}
        </svelte:element>
      {/if}
      {@render children()}
    </div>
```

- [ ] **Step 3: Check and lint**

Run: `pnpm check && pnpm lint`
Expected: clean. (Nothing passes `labelAbove` yet, so every existing page is byte-identical.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/RailRow.svelte && git commit -m "feat(RailRow): labelAbove puts the label in the content column

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The nav in `Report.svelte`

**Files:**
- Modify: `src/lib/report/Report.svelte`
- Modify: `src/lib/report/WhatPasses.svelte` (line 22: remove `id="passes"` and its `scroll-mt-24`)

- [ ] **Step 1: Imports and derived state**

Change the narrative import to:

```ts
  import { allFixes, headlineFinding, tocEntries, TOC_TARGETS } from "./narrative";
```

After `const fixes = $derived(allFixes(view));` add:

```ts
  const toc = $derived(tocEntries(fixes));
```

- [ ] **Step 2: The current-section observer**

After the `closingInView` effect (the one that observes `closing`), add:

```ts
  // Which section the reader is in, for the contents list.
  //
  // One observer over the anchors the list points at, watching a band from
  // just under the fixed nav to 40% of the way down the viewport. A section is
  // "in" that band while any of it overlaps it; when two do (the seam between
  // sections), the lower one wins, so the entry flips as a heading passes the
  // nav rather than when a section first appears at the bottom of the screen.
  // Nothing is current while only the hero is on screen. Observers, not a
  // scroll listener with pixel thresholds, for the reason given above: the
  // sections' heights change with the content.
  let current: string | null = $state(null);

  $effect(() => {
    const el = root;
    if (!el) return;
    const entries = toc;
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (r.isIntersecting) visible.add(r.target.id);
          else visible.delete(r.target.id);
        }
        current = [...entries].reverse().find((t) => visible.has(t.id))?.id ?? null;
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    for (const t of entries) {
      const target = el.querySelector<HTMLElement>(`#${t.id}`);
      if (target) io.observe(target);
    }
    return () => io.disconnect();
  });
```

- [ ] **Step 3: Ids and scroll margins on the targets**

- "What an AI says about you" section (`<section class="w-full py-16 md:py-24">` right after the hero): `<section id={TOC_TARGETS.aiSays} class="w-full scroll-mt-24 py-16 md:py-24">`
- "What you control" section: `<section id={TOC_TARGETS.control} class="bg-paper w-full scroll-mt-24 py-16 md:py-24">`
- "What to fix": replace `id="fixes"` with `id={TOC_TARGETS.fixes}` (keeps `scroll-mt-24`).
- The appendix section (`<!-- ── What passes, and how we measured` comment, `<section class="bg-paper w-full py-16 md:py-24">`): `<section id={TOC_TARGETS.passes} class="bg-paper w-full scroll-mt-24 py-16 md:py-24">`
- The closing band: `<section bind:this={closing} id={TOC_TARGETS.talk} class="bg-paper-red w-full scroll-mt-24 py-16 md:py-24">`
- `src/lib/report/WhatPasses.svelte` line 22: `<div id="passes" class="flex scroll-mt-24 flex-col border-t border-light">` becomes `<div class="flex flex-col border-t border-light">`. The three in-page links to `#passes` (GoalFit, SiteHealth, SourceCheck) now land at the band's top; no change to them.

- [ ] **Step 4: Wrap the document and add the nav**

Immediately after the hero's closing `</section>` (the line after `jump to what to fix</a>.` … `</ContentWidth>` … `</section>`), insert:

```svelte
  <!-- ── The document, with its contents in the rail ─────────────────────── -->
  <!-- Everything between the hero and the closing band, so the sticky list
       runs from the first section to the end of the appendix and never sits
       on the red band. The list's column copies ContentWidth's horizontal
       geometry so its left edge is the rail's; the rows keep their own grid
       and pass `labelAbove`, which leaves their rail cells empty for it. Below
       `lg` the same element is a plain block under the hero: one nav, at every
       width, never duplicated or moved with CSS. `lg:pt-24` matches the first
       section's top padding so the list's resting position lines up with its
       heading; when stuck, `top-24` is the same clearance `scroll-mt-24`
       gives the anchors. -->
  <div class="relative">
    <div
      class="pointer-events-none lg:absolute lg:inset-y-0 lg:left-[4%] lg:w-[92%] lg:max-w-[1220px] lg:pt-24 xl:inset-x-0 xl:mx-auto xl:max-w-[1440px]"
    >
      <nav
        aria-label="In this report"
        class="pointer-events-auto mx-[4%] mt-12 w-[92%] lg:sticky lg:top-24 lg:mx-0 lg:mt-0 lg:w-[240px] print:hidden"
      >
        <p class="type-kicker m-0 text-primary">In this report</p>
        <ol class="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {#each toc as entry (entry.id)}
            <li class="m-0">
              <a
                href="#{entry.id}"
                aria-current={current === entry.id ? "true" : undefined}
                class="type-kicker inline-flex items-start gap-2 font-normal no-underline transition-colors hover:underline focus-visible:underline {current ===
                entry.id
                  ? 'text-primary'
                  : 'text-muted'}"
              >
                <span aria-hidden="true" class="w-3 shrink-0">{current === entry.id ? "→" : ""}</span>
                <span>{entry.label}</span>
              </a>
            </li>
          {/each}
        </ol>
      </nav>
    </div>
```

Then, immediately after the appendix section's closing `</section>` (the one before the `<!-- ── Close` comment), insert the wrapper's closing tag:

```svelte
  </div>
```

The `{#if returnTo !== null} … {/if}` block with the two fixed buttons sits between the fixes and the appendix; it stays where it is, inside the wrapper (both buttons are `position: fixed`, so the wrapper does not affect them).

- [ ] **Step 5: Every `RailRow` in the report passes `labelAbove`**

There are 12. `grep -n '<RailRow' src/lib/report/Report.svelte` and add ` labelAbove` to each opening tag, including the closing band's (`<RailRow label="Next" labelAs="p" labelClass="text-white" fill labelAbove>`). Also update the component's header comment: replace

```
  // The rail label names each block (the site's own pattern) so
  // the subsection headings are the kicker, not a second type scale.
```

with

```
  // Each block's label is the kicker (the site's own pattern), rendered above
  // the block rather than in the rail: the rail column carries the contents
  // list, which is sticky from the first section to the end of the appendix.
```

- [ ] **Step 6: Check, lint, and look**

Run: `pnpm check && pnpm lint`
Expected: clean.

Run: `pnpm dev` (or `pnpm exec vite dev --port 5173`) and open `http://localhost:5173/dev/audit-report` at 1280px wide and at 390px wide. Expect: at 1280 the list sits in the rail level with "What an AI says about you", sticks under the fixed nav while scrolling, the current entry is red with an arrow, the rail cells beside every block are empty and each label sits above its block; at 390 the list is a block between the hero and the first heading and the labels are above their blocks as before. Confirm `font-normal` beats `.type-kicker`'s `font-weight: 700` on the links (the class is in `@layer components`; a Tailwind utility wins). If it does not, use `[font-weight:400]` instead.

- [ ] **Step 7: Commit**

```bash
git add src/lib/report/Report.svelte src/lib/report/WhatPasses.svelte && git commit -m "feat(report): a sticky contents list in the rail

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Smoke coverage

**Files:**
- Create: `tests/smoke/report-toc.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The contents list, against the all-pass fixture: it has no "What to fix"
// section, so the list is four entries, and the missing one is the proof that
// entries follow the sections rather than a fixed list.
//
// The fixture route, not a token route, so the run is not coupled to any one
// prospect's report.
const NAV = 'nav[aria-label="In this report"]';
const NAV_LINE = 96; // top-24, the fixed nav's clearance, shared with scroll-mt-24

async function ready(page: Page, width: number, height: number) {
  // Instant anchor jumps: the site's smooth scrolling is gated on reduced
  // motion, and config-level emulation reaches neither matchMedia nor CSS.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await page.goto("/dev/audit-report");
  await page.locator("html[data-hydrated]").waitFor();
  // The root layout scrolls to the top 600ms after navigation; a scripted
  // scroll inside that window is undone.
  await page.waitForTimeout(700);
}

/** Page-absolute top of an element, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 5);
}

test.describe("report table of contents", () => {
  test("lists the sections that render, in order, each pointing at a live target", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    await expect(page.locator(NAV)).toHaveCount(1);
    const links = page.locator(`${NAV} a`);
    await expect(links).toHaveText([
      "What an AI says about you",
      "What you control",
      "What passes, and how we measured",
      "Talk it through",
    ]);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      expect(href).toMatch(/^#[a-z-]+$/);
      await expect(page.locator(href)).toHaveCount(1);
    }
  });

  test("sits in the rail, sticks under the nav, and marks the current section", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    const nav = page.locator(NAV);
    // The rail cell of the first block: first child of the RailRow grid.
    const railCell = page.locator('#ai-says [class*="lg:grid-cols"] > div').first();
    const [navBox, cellBox] = await Promise.all([nav.boundingBox(), railCell.boundingBox()]);
    expect(navBox).not.toBeNull();
    expect(cellBox).not.toBeNull();
    expect(Math.abs(navBox!.x - cellBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.round(navBox!.width)).toBe(240);
    // With the label above the content, the rail cell holds nothing.
    await expect(railCell).toHaveText("");

    // Nothing is current over the hero.
    await expect(page.locator(`${NAV} a[aria-current]`)).toHaveCount(0);

    // Into "What you control": the nav is stuck at the nav line and that entry
    // is current, the one above is not.
    await scrollTo(page, (await pageTopOf(page, "#control")) - NAV_LINE + 8);
    await expect.poll(async () => Math.round((await nav.boundingBox())!.y)).toBe(NAV_LINE);
    const control = page.locator(`${NAV} a[href="#control"]`);
    const aiSays = page.locator(`${NAV} a[href="#ai-says"]`);
    await expect(control).toHaveAttribute("aria-current", "true");
    await expect(aiSays).not.toHaveAttribute("aria-current", /.*/);
  });

  test("an entry jumps to its section and offers the way back", async ({ page }) => {
    await ready(page, 1280, 800);
    await page.locator(`${NAV} a[href="#passes"]`).click();
    await expect
      .poll(() => page.evaluate(() => document.querySelector("#passes")!.getBoundingClientRect().top))
      .toBeLessThanOrEqual(NAV_LINE + 1);
    await expect(page.getByRole("button", { name: /back to where you were/i })).toBeVisible();
  });

  test("below lg it is one block under the hero, with every label above its content", async ({
    page,
  }) => {
    await ready(page, 390, 844);
    const nav = page.locator(NAV);
    await expect(nav).toHaveCount(1);
    const heroBottom = await page.evaluate(() => {
      const h1 = document.querySelector("h1")!;
      return h1.closest("section")!.getBoundingClientRect().bottom + window.scrollY;
    });
    const firstHeadingTop = await pageTopOf(page, "#ai-says h2");
    const navBox = (await nav.boundingBox())!;
    expect(navBox.y).toBeGreaterThanOrEqual(heroBottom);
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(firstHeadingTop);
    // The first block's label is inside the content column, above the content.
    const label = page.locator("#ai-says h3.type-kicker").first();
    const content = label.locator("xpath=following-sibling::*[1]");
    const [labelBox, contentBox] = await Promise.all([label.boundingBox(), content.boundingBox()]);
    expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(contentBox!.y);
    expect(Math.abs(labelBox!.x - contentBox!.x)).toBeLessThanOrEqual(1);
  });

  test("the nav is a named landmark and axe is clean around it", async ({ page }) => {
    await ready(page, 1280, 800);
    await expect(page.getByRole("navigation", { name: "In this report" })).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .include(NAV)
      .withTags(["wcag2a", "wcag2aa", "best-practice"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `pnpm exec playwright test tests/smoke/report-toc.spec.ts --project=chromium` (check `playwright.config.ts` for the project name; if there is only one project, omit the flag). If a stale dev server on :5173 is reused and fails oddly, kill it and rerun (`lsof -ti :5173 | xargs kill`).
Expected: 5 passed. If "sits in the rail" fails on the x comparison, print both boxes and check whether the rail cell locator matched the content column instead; the selector wants the FIRST child of the grid.

- [ ] **Step 3: Full gates**

Run: `pnpm lint && pnpm check && pnpm vitest run`
Expected: clean, all unit tests green. Then `pnpm test:smoke` once in full if the machine is quiet (load average under 10); if it is loaded, run only the report spec plus `tests/smoke/industry-page.spec.ts` (RailRow's other consumer) and say so in the report.

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/report-toc.spec.ts && git commit -m "test(report): smoke the contents list at both widths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Journal entry

**Files:**
- Modify: `docs/workJournal.md` (append at the end)

- [ ] **Step 1: Append the entry**

Heading: `## 2026-09-15 — The report carries its own contents in the rail (\`feat/report-toc\`)`. Prose, not a file list: why the rail became the map (the rail column was taken by the sub-section labels, which already read above their blocks below `lg`, so moving them there at every width cost nothing and freed the column); why an overlaid column rather than one document grid (the alternating full-bleed bands); the observer band (`-96px 0px -60% 0px`) and why the lower section wins at a seam; what the all-pass fixture proves (a four-entry list). Record anything that surprised you during Tasks 3–4 exactly, with numbers, and anything you tried that did not work.

- [ ] **Step 2: Commit**

```bash
pnpm lint && git add docs/workJournal.md && git commit -m "docs: journal the report contents list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Report back: the commit list, the test counts, what you checked by eye at each width, and any deviation from this plan.
