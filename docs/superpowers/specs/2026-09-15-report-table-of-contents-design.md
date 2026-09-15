# Report table of contents — design

_2026-09-15. Branch `feat/report-toc`. Applies to the audit report at
`/audit/[token]` (and therefore edit mode and the `/dev/audit-report` fixture).
The PDF at `/audit/[token]/print` is out of scope._

## Goal

A reader of the audit report can see at a glance what the document contains,
jump to any section, and always know which section they are in. The report is
long (five bands, up to a dozen blocks) and its only wayfinding today is one
sentence in the hero ("jump to what to fix") and the scrollbar.

## Decisions already taken

Asked and answered on 2026-09-15:

1. **Web only, anchor links.** No table of contents in the printed PDF; it has
   no page numbers to point at.
2. **A sticky left rail on desktop**, not an inline list and not a chip strip.
3. **Top-level sections only.** Five entries at most; no nested sub-sections,
   no per-fix entries.
4. **The rail becomes the map.** The report already renders every block as a
   `RailRow` whose 240px rail holds the red sub-section label ("Your scores",
   "Does it work"). A sticky list cannot share that column with the labels, so
   at `lg`+ the labels move above their blocks — which is already how they
   read below `lg` — and the rail carries the list.
5. **Approach: a sticky column overlaid on the existing rows.** The rows keep
   their grid; a wrapper around the post-hero sections hosts one absolutely
   positioned column whose sticky child is the nav. Rejected: rebuilding the
   report as a single document grid (the alternating full-bleed paper bands
   make that a rewrite) and a JS-positioned fixed nav (layout by measurement).

## Layout

`src/lib/report/Report.svelte`:

- The four sections after the hero — "What an AI says about you", "What you
  control", "What to fix", and the appendix band ("Checked and fine" / "Under
  the hood") — are wrapped in one `div.relative`. The hero stays before it
  and the closing red band stays after it, so the sticky nav starts at the
  first section and stops at the appendix's end. It never overlays the red
  band, for the same reason the floating CTA hides there.
- First child of the wrapper: a positioning column that copies
  `ContentWidth`'s horizontal geometry so its left edge is the rail's left
  edge. At `lg`+: `absolute inset-y-0 left-[4%] w-[92%] max-w-[1220px]`, and
  at `xl` `inset-x-0 mx-auto max-w-[1440px]`, `pointer-events-none`. Inside it
  the nav is `sticky top-24 w-[240px] pointer-events-auto` (`top-24` matches
  the `scroll-mt-24` the page already uses for `#fixes` and `#passes`).
- Below `lg` the positioning column is `static` and the nav is an ordinary
  block: one `ContentWidth` under the hero, above the first section heading,
  with the same list. It is the same element at every width; nothing is
  duplicated or moved with CSS.
- The nav is `<nav aria-label="In this report">` containing a `p.type-kicker`
  reading "In this report" and an `<ol>` of links. Links are the rail's 16px
  type, `text-muted` by default, `text-primary` with a leading mark when
  current, underline on hover and focus. `print:hidden` on the nav.

`src/lib/components/RailRow.svelte` gains `labelAbove?: boolean` (default
`false`). When set, the label element renders as the first child of the
content column with `mb-6`, at every width, and the rail cell renders empty
(the cell itself stays, so the grid and the content column's left edge do not
move). Every `RailRow` in the report passes `labelAbove`, including the closing
band's "Next" (`text-white`), so the report has one rule. The industry landing
pages do not pass it and are unchanged.

## Entries

One pure function, `tocEntries(view, fixes)` in `src/lib/report/narrative.ts`
beside `headlineFinding` and `allFixes`, returns the entries in page order:

| Label                             | Target     | Present when        |
| --------------------------------- | ---------- | ------------------- |
| What an AI says about you         | `#ai-says` | always              |
| What you control                  | `#control` | always              |
| What to fix                       | `#fixes`   | `fixes.length > 0`  |
| What passes, and how we measured  | `#passes`  | always              |
| Talk it through                   | `#talk`    | always              |

Labels are the section titles without their dynamic parts ("3 things to fix,
in order" lists as "What to fix"). The ids live on the `section` elements.
`#fixes` exists today. `#passes` today sits on a `div` inside the appendix
band (`WhatPasses.svelte`); it moves to the band's `section` so the jump lands
at the band's top, and the two in-page links that already point at `#passes`
keep working. The ids are exported from the same module as a `TOC_TARGETS`
table so a rename in one place fails a test rather than a jump.

Clicking an entry is an ordinary same-page anchor. The existing delegated
click handler records `returnTo`, so the "Back to where you were" button
appears exactly as it does for the hero's link today. No new return logic.

## Current section

One `IntersectionObserver` over the five target elements, `rootMargin:
"-96px 0px -60% 0px"`: the section whose top has crossed the line under the
fixed nav is current, and while the closing band is on screen "Talk it
through" is current. The current link gets `aria-current="true"` and the red
treatment. Nothing is current while the hero is on screen. `prefers-reduced-
motion` changes nothing; nothing moves.

Observers, not scroll listeners with pixel thresholds, for the reason the
existing `pastHero` / `closingInView` code gives: the sections' heights change
with the content.

## Edit mode, print, fixtures

- Edit mode (`/audit/[token]/edit`) renders the same `Report` under
  `EditLayer`, which offers report text for editing by matching leaves against
  report data. The nav's text is not report data, so it is not offered. To be
  confirmed by hand on staging.
- The web page's print stylesheet hides the nav (`print:hidden`). The
  `/print` route renders its own flat layout and is untouched.
- `/dev/audit-report` renders the all-pass fixture, so it has no "What to
  fix" section and a four-entry list; with `.audit-sample.json` present it
  renders the hard-case sample with all five.

## Accessibility

- One `nav` landmark with an accessible name; an ordered list, because the
  order is the document's order.
- `aria-current="true"` on the current entry; colour is not the only signal
  (the leading mark).
- Heading levels are unchanged: the labels keep their element (`h3`, `h2`,
  `p`) when they move above the content, so the outline `RichTextBody`/axe
  see today is the outline tomorrow.
- Focus: the links are ordinary anchors in document order; the nav precedes
  the first section in the DOM at every width, so keyboard users meet it
  before the content.

## Testing

Unit, `src/lib/report/narrative.test.ts`:

- `tocEntries` returns the five entries in order for a view with fixes.
- It omits "What to fix" for the all-pass fixture.
- Every target it emits is in `TOC_TARGETS`, and `TOC_TARGETS` has exactly the
  ids `Report.svelte` renders (asserted by importing the table, not by
  string-matching the component).

Smoke, `tests/smoke/report-toc.spec.ts` against `/dev/audit-report`:

- 1280px: the nav is inside the rail's x-range and visible; after scrolling to
  "What you control" it is still on screen (sticky) and that entry has
  `aria-current`, "What an AI says" does not.
- 1280px: clicking "What passes, and how we measured" puts `#passes` within
  96px of the top and shows "Back to where you were".
- 390px: exactly one `nav[aria-label="In this report"]`, rendered as a block
  under the hero; every block's label is above its content.
- The fixture page's axe scan (the existing a11y suite's tag set) stays clean
  with the landmark present.

Manual before the PR leaves draft: the hard-case sample on
`/dev/audit-report`, and edit mode on staging.

## Out of scope

- The PDF.
- Nested entries or per-fix entries.
- Any change to the industry landing pages' `RailRow` usage.
- Smooth scrolling (the site gates it on reduced motion already; the anchors
  inherit whatever the page does).
