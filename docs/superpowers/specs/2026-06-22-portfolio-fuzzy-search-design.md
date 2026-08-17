# Portfolio Fuzzy Search — Design

**Date:** 2026-06-22
**Status:** Shipped (2026-06-22)
**Scope:** Add a fuzzy, debounced text search to the portfolio archive grid.

> **Revision (2026-06-22, post-implementation):** After trying the first cut, the search
> felt too loose and unranked. Two decisions changed: (1) **match strictness** tightened from
> `threshold: 0.4` to `0.2`; (2) **result order** now ranks by Fuse relevance while a query is
> active (the sort dropdown is overridden and resumes when the query is cleared) — this was
> previously out of scope. A `displayProjects` derived re-sorts matched cards to the front in
> score order; unmatched cards stay in their relative order at the back (CSS-hidden). The card
> `flip` animation is shortened to ~500ms while searching (kept at 4500ms for sort changes).

> **Revision 2 (2026-06-22, animation rework):** `animate:flip` proved the wrong tool — it has
> documented glitches when items enter/leave/reorder at once (Svelte #10251: concurrent
> transitions stutter; siblings outro-collapse to one position) and is awkward on `flex-wrap`.
> Replaced the whole keep-everything-mounted + CSS-hide + `flip` approach with the native
> **View Transitions API**. We now render only `visibleProjects` (category ∧ search, ordered),
> and wrap every list-changing state update (category buttons, sort options, the debounced
> search) in a `withViewTransition(fn)` helper (`document.startViewTransition` + `await tick()`,
> with a reduced-motion / unsupported-browser fallback to an instant update). Each card gets a
> unique `view-transition-name: vt-{uid}`, and `::view-transition-*` CSS gives a uniform ~650ms
> smooth glide. This makes category-filter, search, and sort animate identically. Dropped the
> per-card `use:anim` scroll-reveal on archive cards (it double-fired with VT on re-entry).
> The `withViewTransition` seam is the single place to graft a JS animation (e.g. GSAP Flip)
> if the native feel ever falls short; today the unsupported / reduced-motion path is simply an
> instant update.

## Goal

Let visitors filter the portfolio archive grid ("But wait, there's more!" section at the
bottom of [`/portfolio`](../../../src/routes/[[preview=preview]]/portfolio/+page.svelte)) by
typing a search term. Matching is fuzzy (typo-tolerant) and runs on a short debounce so it
only fires once the visitor stops typing. The search lives in the existing control row
alongside the category buttons and sort dropdown, and combines with them.

The curated editorial showcase at the top of the page is **out of scope** — it is hand-built
markup, not driven by the project list, and stays untouched.

## Decisions

| Decision                      | Choice                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where matching runs           | **Client-side** (Approach A). The loader already ships full project data to the browser; no server changes, no added payload.                                                                                                   |
| Search scope                  | **Archive grid only** — the `{#each sortedProjects}` grid in the "But wait, there's more!" section.                                                                                                                             |
| Fields matched                | **title + services + tagline + first body paragraph**                                                                                                                                                                           |
| Fuzzy engine                  | **Fuse.js** (new dependency)                                                                                                                                                                                                    |
| Match strictness              | **Fuse `threshold: 0.2`** (notably strict) — close matches only, still tolerant of a one-character typo. _(Revised from 0.4; see Revision below.)_                                                                              |
| Debounce                      | **~250ms**, fires after typing stops                                                                                                                                                                                            |
| Result order                  | **Relevance while searching.** While a query is active, cards are ordered best-match-first by Fuse score (the sort dropdown is overridden); clearing the query restores the A-Z / Latest sort. _(Revised; see Revision below.)_ |
| Combine with category buttons | **AND** — search narrows within whatever categories are selected.                                                                                                                                                               |

## Data model (already available client-side)

Each `project` document (`ProjectDocument`) carries everything search needs in the existing
`data.allProjects` payload:

- `data.title` — `KeyTextField`
- `data.tagline` — `KeyTextField` (the descriptive subtitle shown over the project hero)
- service booleans (`branding`, `product`, `print`, `environmental`, `packaging`, `digital`)
  → rendered to a label string by the existing `mediumString(project)` util
- `data.slices` — slice zone; the first `rich_text` slice's `primary.content` is a
  `RichTextField` whose first paragraph is the "first body paragraph"

No extra fetching or server work is required.

## Components

### 1. Search util — `src/lib/utils/projectServices.ts`

Add a helper next to the existing `mediumString`:

```ts
import { asText } from "@prismicio/client";

export interface ProjectSearchRecord {
  uid: string;
  title: string;
  services: string;
  tagline: string;
  body: string;
}

export function toSearchRecord(project: ProjectDocument): ProjectSearchRecord {
  const firstRichText = project.data.slices.find((s) => s.slice_type === "rich_text");
  // first paragraph = first block of the first rich_text slice's content
  const firstParagraph = asText(firstRichText?.primary.content?.slice(0, 1) ?? []);
  return {
    uid: project.uid ?? "",
    title: project.data.title ?? "",
    services: mediumString(project),
    tagline: project.data.tagline ?? "",
    body: firstParagraph,
  };
}
```

Notes:

- "First paragraph" = the first block of the first `rich_text` slice's content
  (`content.slice(0, 1)`), run through `asText`. Bounded and cheap; avoids indexing entire
  bodies. Yields `""` when there is no `rich_text` slice.

### 2. Fuse setup — in `portfolio/+page.svelte` (memoized)

```ts
import Fuse from "fuse.js";

// Shared source of truth: Fuse's minMatchCharLength, the ranking guard, and the
// no-results / live-region gates all key off this one constant.
const MIN_QUERY = 2;

const fuse = $derived(
  new Fuse(data.allProjects.map(toSearchRecord), {
    keys: [
      { name: "title", weight: 3 },
      { name: "services", weight: 2 },
      { name: "tagline", weight: 1.5 },
      { name: "body", weight: 1 },
    ],
    threshold: 0.2, // notably strict — close matches only (revised from 0.4)
    ignoreLocation: true, // match anywhere in the field
    minMatchCharLength: MIN_QUERY,
  }),
);
```

`fuse` rebuilds only when `data.allProjects` changes — effectively once.

### 3. Debounce + ranking — in `portfolio/+page.svelte`

```ts
let searchQuery = $state(""); // bound to the input (instant)
let debouncedQuery = $state(""); // what search actually uses

// ~250ms debounce. It writes DIFFERENT state vars (debouncedQuery / orderString)
// than the one it reads synchronously (searchQuery), and the reads run inside the
// timeout — outside the effect's tracked scope — so this does NOT trip the Svelte 5
// $effect self-write scheduler bug. The whole update is wrapped in withViewTransition
// (§4) so the resulting grid change animates.
$effect(() => {
  const q = searchQuery;
  const id = setTimeout(
    () =>
      withViewTransition(() => {
        const wasActive = debouncedQuery.trim().length >= MIN_QUERY;
        const nowActive = q.trim().length >= MIN_QUERY;
        debouncedQuery = q;
        // Auto-engage Relevance when a search becomes active; restore the real
        // sort when it clears — but never override a sort the visitor picked.
        if (nowActive && !wasActive) orderString = RELEVANCE;
        else if (!nowActive && wasActive && orderString === RELEVANCE) orderString = DEFAULT_ORDER;
      }),
    250,
  );
  return () => clearTimeout(id);
});

// Fuse hits ordered best-match-first; null === "no active query".
const rankedUids = $derived.by<string[] | null>(() => {
  const q = debouncedQuery.trim();
  if (q.length < MIN_QUERY) return null;
  return fuse.search(q).map((r) => r.item.uid);
});
```

`debouncedQuery` is a _different_ state var from the one the effect reads (`searchQuery`),
and the reads run inside the timeout, so this does not trip the Svelte 5 `$effect`
self-write scheduler bug.

### 4. Rendered list + view-transition motion

There is **no keep-mounted / CSS-hide layer**. The grid renders only the cards that should
be visible; the View Transitions API animates the delta between the old and new DOM.

```ts
function categoryMatch(project: ProjectDocument<string>): boolean {
  return Boolean(
    showAll ||
    (project.data.branding && showBrand) ||
    (project.data.digital && showDigital) ||
    (project.data.environmental && showEnvironmental) ||
    (project.data.print && showPrint) ||
    (project.data.product && showProduct) ||
    (project.data.packaging && showPackaging),
  );
}

// Category-filtered, then (while searching) reduced to Fuse matches. Ordered by
// relevance only when the Relevance sort is active; with any real sort active the
// matches keep that sort's order (sortedProjects is already sorted), just filtered.
const visibleProjects = $derived.by(() => {
  const inCategory = sortedProjects.filter(categoryMatch);
  if (rankedUids === null) return inCategory;
  const rank = new Map(rankedUids.map((uid, i) => [uid, i]));
  const matched = inCategory.filter((p) => rank.has(p.uid ?? ""));
  if (orderString !== RELEVANCE) return matched;
  return matched.sort((a, b) => (rank.get(a.uid ?? "") ?? 0) - (rank.get(b.uid ?? "") ?? 0));
});
```

The `{#each visibleProjects (project.uid)}` cards each carry
`style="view-transition-name: vt-{uid}"` + `data-vt-uid`, and **every** list-changing state
update — category buttons, sort options, and the debounced search — is wrapped in
`withViewTransition(fn)`:

- **Fallback first** — if `document.startViewTransition` is missing or the user prefers
  reduced motion, it runs the update synchronously (no animation).
- **Constant velocity** — otherwise it snapshots the grid, runs the update + `await tick()`,
  then measures (via `getBoundingClientRect` on `[data-vt-uid]`) how far the farthest
  _visible_ card travels and sets `--vt-duration = distance ÷ VT_VELOCITY`, clamped to
  `[VT_MIN_DURATION, VT_MAX_DURATION]`. A big filter collapse and a small sort nudge thus
  move at the same on-screen pace.
- **Off-screen start-clamp** — a card whose start is far off-screen has its start pulled to
  just past the viewport edge (`VT_VIEWPORT_MARGIN`), so it slides in from the edge instead
  of rocketing across the page — by rewriting that card's `::view-transition-group(vt-{uid})`
  keyframes after `transition.ready`.

The motion constants (`VT_VELOCITY`, `VT_MIN_DURATION`, `VT_MAX_DURATION`,
`VT_VIEWPORT_MARGIN`, `VT_EASE`) are grouped and commented as the tuning knobs.

### 5. No-results + live region

```ts
const visibleCount = $derived(visibleProjects.length);
const isSearching = $derived(debouncedQuery.trim().length >= MIN_QUERY);
```

When a query is active and `visibleCount === 0`, the grid is replaced by a centered
"No projects match "{debouncedQuery}"" message plus a **Clear search** button
(`clearSearch()` resets `searchQuery` and refocuses the input). A separate
`aria-live="polite"` `sr-only` region announces the match count and any active category
filters (e.g. _"3 projects match "ranch" in Brand, Print"_), so screen-reader users hear
the result of each search/filter change.

### 6. UI — search input in the control row

- Placed in the existing flex control row, left of the category buttons (sits naturally above
  the grid alongside the sort dropdown).
- Styled to match the sibling controls: `border-1 border-light text-light`, focus →
  `border-primary text-primary`.
- Leading Lucide `Search` icon; trailing clear (×) button shown only when `searchQuery` is
  non-empty (resets to `""`).
- `type="search"`, with a visually-hidden `<label>` / `aria-label` ("Search projects") for
  accessibility.
- Optional: include `searchQuery` in the existing `$effect` that closes the sort dropdown on
  filter change, so the dropdown collapses when the user starts typing.

## Data flow

```text
input → searchQuery (state, instant)
      → [250ms debounce $effect, wrapped in withViewTransition]
           → debouncedQuery (state)  + auto-engage / restore the Relevance sort
      → fuse.search(debouncedQuery) → rankedUids (string[] best-match-first | null)
                                          │
category buttons → showBrand/… → categoryMatch(project)
sort dropdown    → orderString → sortedProjects (already sorted)
                                          ▼
        visibleProjects = sortedProjects.filter(categoryMatch),
        then while searching filter to rankedUids
        (ordered by rank only when the Relevance sort is active)
                                          ▼
        {#each visibleProjects} — only matches are in the DOM; each card has
        view-transition-name: vt-{uid}; withViewTransition animates the delta
        (constant velocity + off-screen edge-clamp)
                                          ▼
                  visibleCount === 0 → no-results state
```

## Error / edge handling

- **Empty query** → `matchedUids = null` → all category-matching cards visible (today's
  behavior, unchanged).
- **Project with no body / no rich_text slice** → `body = ""`; still searchable by title /
  services / tagline.
- **Missing `uid`** → coerced to `""`; such a project simply never matches a non-empty query
  (it also can't be linked to, so this is acceptable).
- **No matches** → no-results message + Clear action; sort/category controls remain usable.
- **Rapid typing** → only the latest debounced value runs; prior timeouts are cleared.

## Out of scope (YAGNI)

- (Relevance-ranked ordering was originally out of scope but is now implemented — see Revision.)
- Searching the curated top showcase.
- Server-side / Prismic `fulltext` querying.
- Search across full body copy beyond the first paragraph.
- URL/query-param persistence of the search term.
- Result highlighting.

## Testing

- **Util:** `toSearchRecord` returns title/services/tagline and the first body paragraph;
  empty/missing fields degrade to `""`.
- **Matching:** exact substring matches; a one-character deletion typo still matches
  (e.g. "lonehllow" → "Lonehollow Ranch") within `threshold: 0.2`.
- **Relevance:** while a query is active, the best match is ordered first; clearing restores
  the sort-dropdown order.
- **Combine:** search + an active category button shows only projects matching both.
- **Debounce:** filtering does not change on every keystroke, only after the pause.
- **No-results:** an unmatched term shows the message; Clear restores the full grid.
- **Order:** results respect the active sort option, not match score.

## Dependency note

Adds `fuse.js` to `dependencies`. It is a stable package with no recent release, so the
pnpm 11 24h release-age cooldown will not block install.
