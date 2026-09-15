# Report primer — design

_2026-09-15. Branch `feat/report-primer`, stacked on `feat/report-toc` (PR
#190). Applies to the audit report at `/audit/[token]` (and therefore edit
mode and the `/dev/audit-report` fixture). The PDF at `/audit/[token]/print`
is out of scope._

## Goal

A reader who opens the report meets, before the first finding, one short
section that says what the document is, what was done to make it and in what
order, and how to read it — so that "What an AI says about you" and everything
after it is read as the output of an instrument, not as an AI's opinion of the
site. Tucker's brief: tell the whole story as the tool is set up; show the
mechanical checks and how this differs from asking an AI to audit a site from
a standing start; inform the reader, do not lose them.

## Decisions already taken

Asked and answered on 2026-09-15:

1. **A short primer**, not a methods section: three paragraphs, about 190
   words. The copy below is approved. A first draft at twice the length was
   rejected as the wrong thing for a first section.
2. **Title: "What this report is."**
3. **Placement: between the hero and "What an AI says about you"**, inside the
   contents-list wrapper as its first section, so the sticky list starts level
   with it and it is the list's first entry.
4. **On `bg-paper`**: front matter, continuous with the hero's paper; not a
   finding, so not on a white band of its own.
5. **Live values** wherever the copy names a number or a name — the business,
   the audit date, the count of named checks, the count of AI crawlers — with
   plain wording where a value is missing. Not editable in edit mode.

## Copy (approved 2026-09-15)

Braces mark the live values.

> Someone checking you out before they call now has two routes: a search, or
> a question to an AI assistant, which answers from whatever it can find. This
> report is what it finds today and what on your own site shapes that. It is a
> measurement taken on {September 15, 2026}, not a promise about rankings or
> leads.
>
> Most of it is machinery, not an AI's opinion. It fetched every page twice,
> plain and in a real browser, then ran {sixty-one} named checks on what came
> back, from dead links to structured data to whether a phone can fill in your
> forms. It ran the accessibility rules, read your robots.txt as {eight} AI
> crawlers would, and counted the clicks from any page to reaching you. Only
> then did we ask an assistant about {Acme Co}, check each statement against
> your own pages, and put a buyer's questions to it live, keeping every source
> it cited.
>
> Every finding carries its receipt. What we could not measure is marked, not
> scored against you. What passed sits in one place near the end, the fixes
> are in the order we would do them, and because an assistant's answers move,
> this is worth taking again.

The three examples in the second paragraph are real rows of the battery:
"Links that go nowhere", "Structured data pointing at this site", "Fields a
phone can fill in one tap". Clicks to contact are counted per page by the
journey stage (`Journey.pages[].clicksToContact`).

## Where each value comes from, and what prints without it

The report's honesty rule applies to the primer as much as to a finding: a
sentence that says "we read your robots.txt" over a report whose checks stage
never ran is exactly the overstatement the report exists to avoid. So every
clause that names a measurement is gated on the view, and a missing stage
drops the clause rather than defaulting it.

| Copy                                                | Source                                                         | Without it                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| {Acme Co}                                           | `view.businessName`                                            | "your business" (the hero's own fallback)                            |
| taken on {September 15, 2026}                       | `view.generatedAt`, formatted as the masthead's "Audited …"    | "taken on one day"                                                   |
| ran {sixty-one} named checks                        | `view.siteChecks.length`, as digits                            | "ran its named checks"                                               |
| ran the accessibility rules                         | `view.accessibility?.measured`                                 | clause dropped                                                       |
| read your robots.txt as {eight} AI crawlers would   | `view.crawlerReach.checked` when `measured` and > 0, as a word | clause dropped                                                       |
| counted the clicks from any page to reaching you    | `view.journey` present                                         | clause dropped                                                       |
| , and put a buyer's questions to it live, keeping … | `view.categoryProbes.length > 0`                               | "… about {Acme Co} and check each statement against your own pages." |
| the fixes are in the order we would do them,        | `fixes.length > 0` (the same `allFixes` the page renders)      | clause dropped                                                       |

The count of checks prints as digits because `numberWord` spells out only one
to ten and the rest of the report already says "of the 76 checks". The three
machinery clauses are joined by the module's `joinList` ("a, b and c"), so the
built sentence has no serial comma — the report's own habit — and with none
of the three the sentence is dropped whole. The all-pass fixture (Example
Studio, audited 2026-09-03, 76 checks, 8 crawlers, accessibility measured,
journey present, two category probes, two fixes) prints every value.

## Where the text lives

`primer(view, fixes)` in `src/lib/report/narrative.ts`, beside
`headlineFinding` and `openingSummary`, returns three strings: `what`, `how`,
`receipts`. The prose is composed in code rather than written in the template
because two of the three paragraphs change with what the audit measured, and
prose composed in code can be asserted exactly by a unit test; the template
prints the three strings and nothing else of the copy.

`auditedOn(view)` moves into the same module: the masthead's "Audited
September 3, 2026" and the primer's "taken on September 3, 2026" must be the
same formatting of the same field, so there is one function. `Report.svelte`
calls it; the print route keeps its own copy, being out of scope.

## Layout

`src/lib/report/Report.svelte`, inside the contents-list wrapper, before "What
an AI says about you":

- `<section id={TOC_TARGETS.about} class="bg-paper w-full scroll-mt-24 pt-12 pb-16 md:pb-24 lg:pt-0">`.
  No top padding at `lg`: the hero's `pb-16 md:pb-24` already separates the
  two on the same paper, and 192px of paper between the lede and the next
  heading would read as a gap in the document. Below `lg` the contents list
  sits between the hero and this section as a block with `mt-12`, so the
  section carries `pt-12` there.
- The heading row is a label-less `RailRow fill` with the `h2.type-display`
  "What this report is" and the red rule, exactly as the other sections.
- One `RailRow label="In short" labelAs="p" fill labelAbove`, whose content is
  a `flex flex-col gap-6` of three paragraphs: `what` as `type-lede`, `how`
  and `receipts` as body paragraphs (`m-0 text-black`). No measure cap: the
  report's other body paragraphs (the "Under the hood" disclosure) already run
  the content column's width, and this section should not be the one place
  the column narrows.
- The positioning column loses `lg:pt-24`. It existed to rest the list level
  with the first section's heading through that section's top padding; the
  primer has none at `lg`, so the list now rests at the wrapper's top, which is
  the primer's heading.

## Entries

`TOC_TARGETS` gains `about: "about"` and `tocEntries` puts
`{ id: "about", label: "What this report is" }` first, always. Five entries at
most, four on a report with no fixes. The current-section rule is unchanged:
the primer becomes current when its top crosses the 40% line, and nothing is
current while only the hero is on screen. At 1280×800 the hero alone is taller
than 40% of the viewport, so the list opens with nothing current, as before.

## Edit mode, print, fixtures

Not editable: the edit layer's targets come from `editable.ts`, which lists
payload fields, and nothing in the primer is a payload field; the primer's text
is derived, like the headline. Print: out of scope. Fixture: the all-pass
fixture prints every live value, so the smoke test can assert the strings; the
hard-case sample (no business name, no date) prints the fallbacks, and is
checked by hand.

## Accessibility

The `h2` sits in the outline like the other sections' headings; the "In short"
kicker is a `p`. No new landmark, no new interactive element. The existing
page-level axe scan in `report-toc.spec.ts` covers the page with the section
present.

## Testing

Unit, `src/lib/report/narrative.test.ts`:

- `primer(view(), allFixes(view()))` on the fixture: `what` contains "taken on
  September 3, 2026"; `how` contains "ran 76 named checks", "It ran the
  accessibility rules, read your robots.txt as eight AI crawlers would and
  counted the clicks from any page to reaching you.", "about Example Studio,
  check each statement", "put a buyer's questions to it live"; `receipts`
  contains "the fixes are in the order we would do them".
- A view with every gated stage missing (`generatedAt: ""`, `siteChecks`,
  `crawlerReach`, `accessibility`, `journey` null, `categoryProbes: []`) and
  no fixes: "taken on one day", "ran its named checks", no "robots.txt", no
  "accessibility rules", no "clicks", "about your business and check each
  statement against your own pages.", and `receipts` without the fixes clause.
- One stage missing: `crawlerReach` with `measured: false` drops only its
  clause, leaving "It ran the accessibility rules and counted the clicks from
  any page to reaching you."
- `auditedOn(view())` is "September 3, 2026"; `auditedOn` of a view with
  `generatedAt: ""` is null.
- `tocEntries`: five entries with "about" first; `tocEntries([])` is
  `["about", "ai-says", "control", "talk"]`; the fixture yields five.

`src/lib/report/report-copy.test.ts`: the existing loop over `TOC_TARGETS`
covers `id={TOC_TARGETS.about}`; one new assertion that the component calls
`primer(view, fixes)` and does not itself contain the copy ("two routes").

Smoke, new `tests/smoke/report-primer.spec.ts` against `/dev/audit-report`:

- 1280×800: `#about` exists once, precedes `#ai-says` in document order, its
  `h2` reads "What this report is", its kicker "In short", and its text
  contains "taken on September 3, 2026", "ran 76 named checks", "eight AI
  crawlers" and "about Example Studio". The list's first link is "What this
  report is" → `#about`, and the list's top is within 1px of the `h2`'s top at
  rest. Nothing is current at rest; after scrolling `#about` to the nav line,
  that entry is current.
- 390×844: the list's bottom is above the `#about` heading, and `#about` is
  above `#ai-says`.

`tests/smoke/report-toc.spec.ts`: the label list gains "What this report is"
first, and the below-`lg` test's first heading is `#about h2`. Locally the
smoke runs with `.audit-sample.json` moved aside, so the fixture renders as it
does in CI.

Manual before the PR leaves draft: the hard-case sample on `/dev/audit-report`
(fallback wording), and edit mode on staging (the primer offered as no target).

## Out of scope

- The PDF.
- The hero: its "Read on for what we found … or jump to what to fix" line
  stays.
- A measure cap for body prose in the report.

## Amendment, 2026-09-15 (during implementation)

Three things the build changed. First, the paper. With the primer on its own
`bg-paper` and the wrapper transparent, a phone showed the contents list on a
236px strip of plain white between the hero's paper and the primer's (hero
paper ending near y=640, primer starting at 876.8 at 390×844) — before this
branch the list's white ran into the white first finding. The wrapper
`div.relative` now carries `bg-paper`, the two white sections ("What an AI
says about you", "What to fix") paint `bg-white` over it, and the primer, the
control section and the appendix carry no background of their own. At `lg`
nothing changes; below `lg` the hero, the list and the primer are one paper
band. `report-copy.test.ts`'s "share one paper band" assertion reads the
wrapper's class now, and the phone smoke asserts the band behind the list,
the primer's heading and the first finding's heading. Second, the print route
also formats its date through `auditedOn(view)`; "keeps its own copy" above
is superseded, though the PDF still has no primer. Third, names: the derived
values in `Report.svelte` are `about` (the primer) and `auditDate`, not
`intro` and `audited`. The unit tests also run with `TZ=UTC` pinned in
`vitest.config.js`: the fixture's `09:00Z` stamp printed "September 2, 2026"
under `TZ=Pacific/Honolulu`, and CI is UTC.
