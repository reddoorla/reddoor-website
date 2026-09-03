# Report Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganise the prospect audit page into one narrative (headline finding → what an AI says → what you control → fixes), collapse everything that passed into one openable section, use the whole content width and the site's own type roles, and give the page a "check, check, check" state that an all-pass fixture can render.

**Architecture:** Renderer only. Nothing in reddoor-maintenance changes; every new claim the page makes is a pure function in `src/lib/report/` with a test, and every copy rule is a source-text guard in `report-copy.test.ts`. The page body moves into `Report.svelte` so the token route and a `/dev/audit-report` fixture route render the same component. The print sheet follows the same section order.

**Tech Stack:** SvelteKit, Svelte 5 runes, Tailwind v4, vitest (node, no DOM), Playwright for a screenshot pass.

**Source:** `AUDIT_NOTES.md` (Tucker, 2026-09-02).

---

## Decisions taken from the notes

| Note                                                                   | Decision                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Headline + highest-leverage finding first, invitation, anchor to fixes | `headlineFinding(view)` is deterministic with a fixed priority: crawlers blocked → name collision → goal unknown → goal requirement missing → contradicted claim → unanswered buyer questions → site check failing → all clear. The hero prints it, then "Read how we checked, or jump to what to fix" linking `#fixes`. |
| Revised order                                                          | Hero → What an AI says about you (accuracy findings, then "Where you stand" as a subsection) → What you control (Does it work → Does your site do its job → What buyers can and cannot learn) → What passes (one disclosure) → Fixes → How we measured → Close.                                                          |
| Whole content width                                                    | `RailRow` gains `fill`; the report uses it everywhere. Every `max-w-[Nch]` in the report components and page goes, except the hero `h1`. Guarded by test.                                                                                                                                                                |
| Our heading styles                                                     | Section `h2` = `type-display`; subsection `h3` = `type-lede` (Besley); row labels stay `type-eyebrow`/`type-question`. No `text-sm`/`text-xs` on body copy — `type-meta` is the small role.                                                                                                                              |
| Passed checks collapse                                                 | Nothing that passed is listed inline. Each section shows only findings plus one line of count. `passes(view)` collects every pass (health rows cleared, goal requirements met, confirmed statements, questions answered, crawlers allowed) into one `WhatPasses` disclosure.                                             |
| Lead with the collision and give solutions                             | The conflation block gains "What to do about it": three recommendations, labelled as judgement. Namesake folds into the same block; no second boxed aside.                                                                                                                                                               |
| No double asides                                                       | A bordered block never contains another bordered block. Quotes inside the collision block are plain `type-meta`.                                                                                                                                                                                                         |
| Fix list: recommendations as the subheader, no "What we measured"      | One ranked list under "Our recommendations" with the no-promise line. `origin` stays in the model (it decides the order) but is not printed as a group.                                                                                                                                                                  |
| A version that says check, check, check                                | `src/lib/report/fixtures/all-pass.ts` is a complete raw report where every stage ran and nothing failed. Tests assert `headlineFinding` says all clear, `passes` is non-empty in every group, and no section renders a finding. `/dev/audit-report` renders it.                                                          |
| Search terms chosen by hand                                            | Pinned. Producer change; noted in the PR, not built.                                                                                                                                                                                                                                                                     |

## Tasks

### Task 1: Pure model additions (RED first)

- Test: `src/lib/report/narrative.test.ts` — `headlineFinding`, `passes`, `healthRows`.
- Create: `src/lib/report/health.ts` (rows lifted verbatim from `SiteHealth.svelte`), `src/lib/report/narrative.ts`.
- `SiteHealth.svelte` imports `healthRows` and renders only alerts.

### Task 2: All-pass fixture

- Create: `src/lib/report/fixtures/all-pass.ts`; test in `narrative.test.ts` that it is all clear end to end through `toReportView`.

### Task 3: Copy guards (RED first)

- Modify `report-copy.test.ts`: FixList has no "What we measured"; page has `href="#fixes"` and `headlineFinding`; SourceCheck has "What to do about it"; one `WhatPasses`; width guard: no `max-w-[` outside the hero h1; RailRow `fill` on every report row.

### Task 4: Components

- `RailRow.svelte` `fill` prop. `FixList`, `SourceCheck`, `GoalFit`, `ScoreBars`, `Standing`, `SiteHealth`, `QuestionMeter`, `SearchResults`: widths, headings, findings-only. New `WhatPasses.svelte`.

### Task 5: Page

- Create `src/lib/report/Report.svelte` (the body); `audit/[token]/+page.svelte` renders it; `dev/audit-report/+page.svelte` renders the fixture.

### Task 6: Print sheet

- Same order, same headline, recommendations framing, passes as one short list.

### Task 7: Verify

- `pnpm test`, `pnpm lint`, `pnpm check`; Playwright screenshots of the real report (via `PROSPECT_REPORT_URL`) and the fixture at 1440 and 390; axe on both.
