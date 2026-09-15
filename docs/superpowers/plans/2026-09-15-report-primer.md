# Report Primer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "What this report is" section between the hero and the first finding, three approved paragraphs with the view's own numbers, listed first in the contents list.

**Architecture:** The prose is composed by one pure function `primer(view, fixes)` in `narrative.ts` (with `auditedOn(view)` extracted beside it), so every gated clause is unit-tested; `Report.svelte` renders a new `section#about` inside the contents-list wrapper and drops the positioning column's `lg:pt-24`; `tocEntries` gains the entry first. Spec: `docs/superpowers/specs/2026-09-15-report-primer-design.md`.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, Tailwind v4, Vitest (node), Playwright smoke against `/dev/audit-report`.

**Working directory:** the worktree `.worktrees/report-primer` on branch `feat/report-primer` (stacked on `feat/report-toc`). Run every command from there. `pnpm install` is done. `.audit-sample.json` is present there and makes `/dev/audit-report` render a real sample instead of the fixture: move it aside for smoke runs (`mv .audit-sample.json /tmp/`) and put it back after.

**Conventions:** commit trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; commit after each task; `pnpm lint` (prettier + eslint) must pass before each commit. Do not push; the controller pushes and opens the PR.

---

### Task 1: `primer`, `auditedOn` and the first entry, in the narrative layer

**Files:**

- Modify: `src/lib/report/narrative.ts` (`TOC_TARGETS`, `tocEntries`, and two new exports after `tocEntries`)
- Test: `src/lib/report/narrative.test.ts`

- [ ] **Step 1: Update the `tocEntries` tests and write the failing `primer` / `auditedOn` tests**

In `src/lib/report/narrative.test.ts`, add `primer` and `auditedOn` to the existing `./narrative` import. Replace the `describe("tocEntries", …)` block with:

```ts
describe("tocEntries", () => {
  // Only the count of fixes decides whether the section renders, so a
  // placeholder is all the entry needs; the Fix shape is covered elsewhere.
  const oneFix = [{} as unknown as Fix];

  it("lists the five sections in page order when there are fixes, the primer first", () => {
    expect(tocEntries(oneFix)).toEqual([
      { id: "about", label: "What this report is" },
      { id: "ai-says", label: "What an AI says about you" },
      { id: "control", label: "What you control" },
      { id: "fixes", label: "What to fix" },
      { id: "talk", label: "Talk it through" },
    ]);
  });

  it("never lists the appendix, which keeps its anchor for the in-page links", () => {
    expect(tocEntries(oneFix).map((e) => e.id)).not.toContain(TOC_TARGETS.passes);
    expect(TOC_TARGETS.passes).toBe("passes");
  });

  it("omits What to fix when the report renders no fixes", () => {
    expect(tocEntries([]).map((e) => e.id)).toEqual(["about", "ai-says", "control", "talk"]);
    // The all-pass fixture is NOT that case. Every check passes, but its
    // analyze stage carries two recommendations, so the page renders "2 things
    // to fix" and the list has all five. Wired through allFixes here so a
    // fixture change that drops them fails this line rather than a jump.
    const v = view();
    expect(allFixes(v)).toHaveLength(2);
    expect(tocEntries(allFixes(v))).toHaveLength(5);
  });

  it("only ever emits ids from TOC_TARGETS", () => {
    const known = new Set<string>(Object.values(TOC_TARGETS));
    for (const e of tocEntries(oneFix)) expect(known.has(e.id)).toBe(true);
  });
});

describe("auditedOn", () => {
  it("prints the day the audit ran, as the masthead does", () => {
    expect(auditedOn(view())).toBe("September 3, 2026");
  });

  it("is null when the report carries no date", () => {
    expect(auditedOn({ ...view(), generatedAt: "" })).toBeNull();
  });
});

describe("primer", () => {
  // Every gated stage absent, and no fixes: the wording each fallback prints.
  const bare = (): ReportView => ({
    ...view(),
    generatedAt: "",
    siteChecks: null,
    crawlerReach: null,
    accessibility: null,
    journey: null,
    categoryProbes: [],
  });

  it("prints every live value on the all-pass fixture", () => {
    const p = primer(view(), allFixes(view()));
    expect(p.what).toContain("It is a measurement taken on September 3, 2026, not a promise");
    expect(p.how).toContain("then ran 76 named checks on what came back");
    expect(p.how).toContain(
      "It ran the accessibility rules, read your robots.txt as eight AI crawlers would and " +
        "counted the clicks from any page to reaching you.",
    );
    expect(p.how).toContain(
      "Only then did we ask an assistant about Example Studio, check each statement against " +
        "your own pages, and put a buyer's questions to it live, keeping every source it cited.",
    );
    expect(p.receipts).toContain(
      "What passed sits in one place near the end, the fixes are in the order we would do " +
        "them, and because an assistant's answers move, this is worth taking again.",
    );
  });

  it("drops every clause it cannot stand behind, and words around the missing values", () => {
    const p = primer(bare(), []);
    expect(p.what).toContain("taken on one day, not a promise");
    expect(p.how).toContain("then ran its named checks on what came back");
    expect(p.how).not.toContain("robots.txt");
    expect(p.how).not.toContain("accessibility rules");
    expect(p.how).not.toContain("clicks");
    expect(p.how).toContain(
      "Only then did we ask an assistant about your business and check each statement " +
        "against your own pages.",
    );
    expect(p.how).not.toContain("buyer's questions");
    expect(p.receipts).toContain(
      "What passed sits in one place near the end, and because an assistant's answers move, " +
        "this is worth taking again.",
    );
    expect(p.receipts).not.toContain("the fixes are");
  });

  it("drops only the clause whose stage is missing", () => {
    const v: ReportView = {
      ...view(),
      crawlerReach: { measured: false, blocked: [], checked: 0 },
    };
    expect(primer(v, []).how).toContain(
      "It ran the accessibility rules and counted the clicks from any page to reaching you.",
    );
  });

  it("does not name a crawler count the checks stage never measured", () => {
    const v: ReportView = {
      ...view(),
      crawlerReach: { measured: false, blocked: [], checked: 8 },
    };
    expect(primer(v, []).how).not.toContain("robots.txt");
  });
});
```

`ReportView` is already imported from `./model` in this file (check the import list; add it if not).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/lib/report/narrative.test.ts`
Expected: FAIL — `primer` and `auditedOn` are not exported; the five-entry expectations fail.

- [ ] **Step 3: Implement**

In `src/lib/report/narrative.ts`, change `TOC_TARGETS` and `tocEntries`:

```ts
export const TOC_TARGETS = {
  about: "about",
  aiSays: "ai-says",
  control: "control",
  fixes: "fixes",
  passes: "passes",
  talk: "talk",
} as const;
```

```ts
export function tocEntries(fixes: Fix[]): TocEntry[] {
  return [
    { id: TOC_TARGETS.about, label: "What this report is" },
    { id: TOC_TARGETS.aiSays, label: "What an AI says about you" },
    { id: TOC_TARGETS.control, label: "What you control" },
    ...(fixes.length ? [{ id: TOC_TARGETS.fixes, label: "What to fix" }] : []),
    { id: TOC_TARGETS.talk, label: "Talk it through" },
  ];
}
```

Append after `tocEntries`:

```ts
/** "September 3, 2026": the day the audit ran, as the masthead prints it.
 *  Null when the report carries no date; the callers word around it. */
export function auditedOn(view: ReportView): string | null {
  return view.generatedAt
    ? new Date(view.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
}

export type Primer = {
  /** What the report is: the two routes a buyer takes, and that this is a measurement. */
  what: string;
  /** How it was made: the machinery first, the assistant last. */
  how: string;
  /** How to read it: receipts, what was not measured, where the passes and fixes sit. */
  receipts: string;
};

/**
 * The primer, "What this report is": three paragraphs before the first
 * finding, so the results read as the output of an instrument rather than an
 * assistant's opinion of the site. Composed here rather than in the template
 * because two of the three paragraphs change with what the audit measured,
 * and prose composed in code can be asserted exactly.
 *
 * Every number is the view's own, and every clause that names a measurement
 * is gated on the stage that made it. Where a stage did not run the clause is
 * dropped, not defaulted: a primer that says "we read your robots.txt" over a
 * report whose checks never ran is the exact overstatement the report exists
 * to avoid.
 */
export function primer(view: ReportView, fixes: Fix[]): Primer {
  const who = view.businessName ?? "your business";
  const day = auditedOn(view) ?? "one day";
  const what =
    "Someone checking you out before they call now has two routes: a search, or a question " +
    "to an AI assistant, which answers from whatever it can find. This report is what it " +
    "finds today and what on your own site shapes that. " +
    `It is a measurement taken on ${day}, not a promise about rankings or leads.`;

  // Digits, not words: numberWord spells out only one to ten, and the rest of
  // the report already says "of the 76 checks".
  const checks = view.siteChecks ? `${view.siteChecks.length} named checks` : "its named checks";
  const machinery: string[] = [];
  if (view.accessibility?.measured) machinery.push("ran the accessibility rules");
  const reach = view.crawlerReach;
  if (reach?.measured && reach.checked > 0) {
    machinery.push(`read your robots.txt as ${numberWord(reach.checked)} AI crawlers would`);
  }
  if (view.journey) machinery.push("counted the clicks from any page to reaching you");
  const how =
    "Most of it is machinery, not an AI's opinion. It fetched every page twice, plain and " +
    `in a real browser, then ran ${checks} on what came back, from dead links to structured ` +
    "data to whether a phone can fill in your forms. " +
    (machinery.length ? `It ${joinList(machinery)}. ` : "") +
    `Only then did we ask an assistant about ${who}` +
    (view.categoryProbes.length
      ? ", check each statement against your own pages, and put a buyer's questions to it " +
        "live, keeping every source it cited."
      : " and check each statement against your own pages.");

  const receipts =
    "Every finding carries its receipt. What we could not measure is marked, not scored " +
    "against you. What passed sits in one place near the end, " +
    (fixes.length ? "the fixes are in the order we would do them, " : "") +
    "and because an assistant's answers move, this is worth taking again.";

  return { what, how, receipts };
}
```

Update the `tocEntries` doc comment's first sentence to read "The table of contents: the sections in page order, the primer first, minus any the report does not render for this view."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/lib/report/narrative.test.ts src/lib/report/report-copy.test.ts`
Expected: narrative PASS. `report-copy.test.ts` FAILS on `id={TOC_TARGETS.about}` — the component does not render it yet; Task 2 fixes that. (Do not skip or edit that test.)

- [ ] **Step 5: Lint and commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add src/lib/report/narrative.ts src/lib/report/narrative.test.ts
git commit -m "feat(report): the primer's prose, and its entry first in the contents list

primer(view, fixes) composes the three approved paragraphs of 'What this
report is' from the view's own numbers, dropping any clause whose stage did
not run rather than defaulting it. auditedOn(view) is extracted so the
masthead and the primer format the same date the same way.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The section in `Report.svelte`, and the copy invariant

**Files:**

- Modify: `src/lib/report/Report.svelte` (script imports and derived values; the positioning column's classes and comment; a new section before "What an AI says about you"; the "What an AI says" comment)
- Test: `src/lib/report/report-copy.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/lib/report/report-copy.test.ts`, inside `describe("one story, on every surface", …)`, after the `"the hero leads with …"` test, add:

```ts
it("the primer's prose is composed in narrative.ts, and the template prints it first", () => {
  expect(code(REPORT)).toMatch(/primer\(view, fixes\)/);
  expect(code(REPORT)).toMatch(/auditedOn\(view\)/);
  // The copy itself is not in the template: a sentence that varies with
  // the view is asserted on the function, not string-matched here.
  expect(code(REPORT)).not.toMatch(/two routes/);
  expect(code(REPORT)).toMatch(/id=\{TOC_TARGETS\.about\}/);
  // Before the first finding.
  expect(code(REPORT).indexOf("id={TOC_TARGETS.about}")).toBeLessThan(
    code(REPORT).indexOf("id={TOC_TARGETS.aiSays}"),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/report/report-copy.test.ts`
Expected: FAIL — no `primer(view, fixes)`, no `id={TOC_TARGETS.about}`.

- [ ] **Step 3: Implement the section**

In `src/lib/report/Report.svelte`:

(a) The `./narrative` import becomes:

```ts
import { allFixes, auditedOn, headlineFinding, primer, tocEntries, TOC_TARGETS } from "./narrative";
```

(b) After `const toc = $derived(tocEntries(fixes));` add:

```ts
const intro = $derived(primer(view, fixes));
```

(c) Replace the inline `auditedOn` derived (the `$derived(view.generatedAt ? new Date(...) : null)` block) with:

```ts
const audited = $derived(auditedOn(view));
```

and in the masthead change `{#if auditedOn}<span>Audited {auditedOn}</span>{/if}` to `{#if audited}<span>Audited {audited}</span>{/if}`.

(d) The positioning column: remove `lg:pt-24` from its class string, so it reads

```svelte
    <div
      class="pointer-events-none lg:absolute lg:inset-y-0 lg:left-[4%] lg:w-[92%] lg:max-w-[1220px] xl:inset-x-0 xl:mx-auto xl:max-w-[1440px]"
    >
```

and in the wrapper's comment replace the sentence beginning "`lg:pt-24` matches the first section's top padding" up to "gives the anchors." with:

```
       The column has no top padding: the first section, the primer, has none
       at `lg` either, so the list rests level with its heading; when stuck,
       `top-24` is the same clearance `scroll-mt-24` gives the anchors.
```

(e) Immediately after the positioning column's closing `</div>` and before the `<!-- ── What an AI says about you` comment, insert:

```svelte
<!-- ── What this report is ─────────────────────────────────────────────── -->
<!-- Front matter, on the hero's paper: what the reader is holding, what
       was done to make it and in what order, before the first finding asks
       them to trust one. The prose is composed in narrative.ts because two of
       its three paragraphs change with what the audit measured, and a clause
       about a stage that never ran is dropped there, not here. No top padding
       at `lg`: the hero's bottom padding already separates the two on the
       same paper, and the contents list rests level with this heading; below
       `lg` the list sits between them, so `pt-12` there. -->
<section id={TOC_TARGETS.about} class="bg-paper w-full scroll-mt-24 pt-12 pb-16 md:pb-24 lg:pt-0">
  <RailRow fill>
    <h2 class="type-display m-0 text-black">What this report is</h2>
    <hr class="mt-7.5 mb-7.5 border-primary" />
  </RailRow>

  <RailRow label="In short" labelAs="p" fill labelAbove>
    <div class="flex flex-col gap-6">
      <p class="type-lede m-0 text-black">{intro.what}</p>
      <p class="m-0 text-black">{intro.how}</p>
      <p class="m-0 text-black">{intro.receipts}</p>
    </div>
  </RailRow>
</section>
```

(f) The comment above the "What an AI says about you" section currently begins "First, because it is the section this report is named for". Change that first sentence to: "The first finding, and the section this report is named for: an engine describes them to strangers right now and they have never seen what it says."

- [ ] **Step 4: Run the unit tests and the gates**

Run: `pnpm vitest run` then `pnpm lint` then `pnpm check`
Expected: all green (570 + the new tests pass; no lint or type errors).

- [ ] **Step 5: Commit**

```bash
git add src/lib/report/Report.svelte src/lib/report/report-copy.test.ts
git commit -m "feat(report): 'What this report is' before the first finding

Front matter on the hero's paper, first in the contents list. The list's
column loses its top padding, since the primer has none at lg and the list
now rests level with its heading.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Smoke coverage

**Files:**

- Create: `tests/smoke/report-primer.spec.ts`
- Modify: `tests/smoke/report-toc.spec.ts` (the label list; the below-`lg` test's first heading; the file comment)

- [ ] **Step 1: Update the contents-list smoke expectations**

In `tests/smoke/report-toc.spec.ts`:

- In the file comment, "and the list has all four entries" becomes "and the list has all five entries".
- In the `toHaveText([...])` list, insert `"What this report is",` as the first item.
- In the below-`lg` test, `const firstHeadingTop = await pageTopOf(page, "#ai-says h2");` becomes `const firstHeadingTop = await pageTopOf(page, "#about h2");`.

- [ ] **Step 2: Write the primer smoke**

Create `tests/smoke/report-primer.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

// The primer, "What this report is", against the all-pass fixture: Example
// Studio, audited 2026-09-03, 76 named checks, 8 AI crawlers, accessibility
// measured, the journey stage present, two category probes and two fixes, so
// every live value prints. The fallbacks are unit-tested on `primer()`.
const NAV = 'nav[aria-label="In this report"]';
const NAV_LINE = 96; // top-24, shared with scroll-mt-24

async function ready(page: Page, width: number, height: number) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width, height });
  await page.goto("/dev/audit-report");
  await page.locator("html[data-hydrated]").waitFor();
}

/** Page-absolute top of an element, independent of the current scroll. */
async function pageTopOf(page: Page, selector: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + window.scrollY,
    selector,
  );
}

test.describe("report primer", () => {
  test("opens the document with the story of the audit, every number the fixture's own", async ({
    page,
  }) => {
    await ready(page, 1280, 800);
    const about = page.locator("#about");
    await expect(about).toHaveCount(1);
    await expect(about.locator("h2")).toHaveText("What this report is");
    await expect(about.locator("p.type-kicker")).toHaveText("In short");
    // Before the first finding, in document order.
    expect(await pageTopOf(page, "#about")).toBeLessThan(await pageTopOf(page, "#ai-says"));

    const text = (await about.innerText()).replace(/\s+/g, " ");
    expect(text).toContain("taken on September 3, 2026");
    expect(text).toContain("ran 76 named checks");
    expect(text).toContain("read your robots.txt as eight AI crawlers would");
    expect(text).toContain("ask an assistant about Example Studio");

    // First in the list, and the list rests level with this heading.
    const first = page.locator(`${NAV} a`).first();
    await expect(first).toHaveText("What this report is");
    await expect(first).toHaveAttribute("href", "#about");
    const [navBox, h2Box] = await Promise.all([
      page.locator(NAV).boundingBox(),
      about.locator("h2").boundingBox(),
    ]);
    expect(Math.abs(navBox!.y - h2Box!.y)).toBeLessThanOrEqual(1);

    // Nothing current over the hero; the primer once its top is at the nav line.
    await expect(page.locator(`${NAV} a[aria-current]`)).toHaveCount(0);
    // The root layout scrolls to the top 600ms after navigation; wait it out.
    await page.waitForTimeout(700);
    const top = await pageTopOf(page, "#about");
    await page.evaluate((y) => window.scrollTo(0, y), top - NAV_LINE + 8);
    await expect(first).toHaveAttribute("aria-current", "location");
  });

  test("below lg it follows the contents list and precedes the first finding", async ({ page }) => {
    await ready(page, 390, 844);
    const navBox = (await page.locator(NAV).boundingBox())!;
    const aboutHeading = await pageTopOf(page, "#about h2");
    expect(navBox.y + navBox.height).toBeLessThanOrEqual(aboutHeading);
    expect(aboutHeading).toBeLessThan(await pageTopOf(page, "#ai-says"));
  });
});
```

- [ ] **Step 3: Run both smoke specs against the fixture**

```bash
mv .audit-sample.json /tmp/report-primer-audit-sample.json
REDDOOR_SMOKE_PORT=5242 pnpm exec playwright test tests/smoke/report-primer.spec.ts tests/smoke/report-toc.spec.ts --reporter=line < /dev/null
mv /tmp/report-primer-audit-sample.json .audit-sample.json
```

Expected: 7 passed. If the alignment assertion fails, report the measured `navBox.y` and `h2Box.y` rather than widening the tolerance.

- [ ] **Step 4: Lint and commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add tests/smoke/report-primer.spec.ts tests/smoke/report-toc.spec.ts
git commit -m "test(report): smoke the primer at both widths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Journal entry

**Files:**

- Modify: `docs/workJournal.md` (append at the end)

- [ ] **Step 1: Append the entry**

Append to `docs/workJournal.md` an entry headed `## 2026-09-15 — The report opens with what it is (`feat/report-primer`)`, in prose, covering: why a primer (the results were reading as an AI's opinion; Tucker's brief to show the machinery and how this differs from asking an assistant cold); the length correction (a first draft at roughly twice the length was rejected — the first section informs, it does not lose the reader); why the prose is composed in `narrative.ts` with every measurement clause gated on its stage, and what the fallbacks print; the layout choice (paper, no top padding at `lg`, the list's column losing `lg:pt-24`); the measured resting alignment from the smoke run; and what is still to be checked by hand (the hard-case sample's fallbacks, edit mode on staging). Include exact numbers from the test runs.

- [ ] **Step 2: Lint and commit**

Run: `pnpm lint`
Expected: clean.

```bash
git add docs/workJournal.md
git commit -m "docs: journal the report primer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
