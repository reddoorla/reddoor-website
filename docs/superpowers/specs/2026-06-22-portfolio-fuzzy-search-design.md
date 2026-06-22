# Portfolio Fuzzy Search — Design

**Date:** 2026-06-22
**Status:** Approved (pending spec review)
**Scope:** Add a fuzzy, debounced text search to the portfolio archive grid.

## Goal

Let visitors filter the portfolio archive grid ("But wait, there's more!" section at the
bottom of [`/portfolio`](../../../src/routes/[[preview=preview]]/portfolio/+page.svelte)) by
typing a search term. Matching is fuzzy (typo-tolerant) and runs on a short debounce so it
only fires once the visitor stops typing. The search lives in the existing control row
alongside the category buttons and sort dropdown, and combines with them.

The curated editorial showcase at the top of the page is **out of scope** — it is hand-built
markup, not driven by the project list, and stays untouched.

## Decisions

| Decision                      | Choice                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where matching runs           | **Client-side** (Approach A). The loader already ships full project data to the browser; no server changes, no added payload.                              |
| Search scope                  | **Archive grid only** — the `{#each sortedProjects}` grid in the "But wait, there's more!" section.                                                        |
| Fields matched                | **title + services + tagline + first body paragraph**                                                                                                      |
| Fuzzy engine                  | **Fuse.js** (new dependency)                                                                                                                               |
| Debounce                      | **~250ms**, fires after typing stops                                                                                                                       |
| Result order                  | **Sort dropdown stays authoritative.** Fuse decides membership (match / no-match); the existing A-Z / Latest sort controls order. No relevance reordering. |
| Combine with category buttons | **AND** — search narrows within whatever categories are selected.                                                                                          |

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

const searchRecords = $derived(data.allProjects.map(toSearchRecord));

const fuse = $derived(
  new Fuse(searchRecords, {
    keys: [
      { name: "title", weight: 3 },
      { name: "services", weight: 2 },
      { name: "tagline", weight: 1.5 },
      { name: "body", weight: 1 },
    ],
    threshold: 0.4, // forgiving / typo-tolerant
    ignoreLocation: true, // match anywhere in the field
    minMatchCharLength: 2,
  }),
);
```

`searchRecords` / `fuse` rebuild only when `data.allProjects` changes — effectively once.

### 3. Debounce + matching — in `portfolio/+page.svelte`

```ts
let searchQuery = $state(""); // bound to the input (instant)
let debouncedQuery = $state(""); // what search actually uses

$effect(() => {
  const q = searchQuery;
  const id = setTimeout(() => (debouncedQuery = q), 250);
  return () => clearTimeout(id);
});

const matchedUids = $derived.by(() => {
  const q = debouncedQuery.trim();
  if (!q) return null; // null === "everything matches"
  return new Set(fuse.search(q).map((r) => r.item.uid));
});
```

`debouncedQuery` is a _different_ state var from the one the effect reads (`searchQuery`),
so this does not trip the Svelte 5 `$effect` self-write scheduler bug.

### 4. Visibility predicate

Today the per-card visibility lives in an inline class ternary (category match → `relative`,
else `absolute … opacity-0 pointer-events-none`). Extract it into a readable helper and add
the search condition:

```ts
function isVisible(project: ProjectDocument): boolean {
  const categoryMatch =
    showAll ||
    (project.data.branding && showBrand) ||
    (project.data.digital && showDigital) ||
    (project.data.environmental && showEnvironmental) ||
    (project.data.print && showPrint) ||
    (project.data.product && showProduct) ||
    (project.data.packaging && showPackaging);

  const searchMatch = matchedUids === null || matchedUids.has(project.uid ?? "");

  return categoryMatch && searchMatch;
}
```

The `{#each sortedProjects}` block keeps the CSS-hide pattern: visible → `relative`; hidden →
`absolute top-1/2 left-1/2 opacity-0 pointer-events-none`. Cards stay mounted so
`animate:flip` continues to animate sort reordering.

### 5. No-results state

```ts
const visibleCount = $derived(sortedProjects.filter(isVisible).length);
```

When `visibleCount === 0`, render a centered message in place of the grid:
"No projects match "{debouncedQuery}"" plus a **Clear search** button that resets
`searchQuery = ""`.

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

```
input → searchQuery (state, instant)
      → [250ms debounce $effect] → debouncedQuery (state)
      → fuse.search(debouncedQuery) → matchedUids (Set | null)
                                          │
category buttons → showBrand/… ───────────┤
sort dropdown   → sortedProjects ─────────┤
                                          ▼
                            isVisible(project) per card
                       (CSS-hide; sort controls order)
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

- Relevance-ranked ordering (sort dropdown stays authoritative).
- Searching the curated top showcase.
- Server-side / Prismic `fulltext` querying.
- Search across full body copy beyond the first paragraph.
- URL/query-param persistence of the search term.
- Result highlighting.

## Testing

- **Util:** `toSearchRecord` returns title/services/tagline and the first body paragraph;
  empty/missing fields degrade to `""`.
- **Matching:** exact substring matches; a one-character typo / transposition still matches
  (e.g. "lihgting" → a "Lighting" project) within `threshold: 0.4`.
- **Combine:** search + an active category button shows only projects matching both.
- **Debounce:** filtering does not change on every keystroke, only after the pause.
- **No-results:** an unmatched term shows the message; Clear restores the full grid.
- **Order:** results respect the active sort option, not match score.

## Dependency note

Adds `fuse.js` to `dependencies`. It is a stable package with no recent release, so the
pnpm 11 24h release-age cooldown will not block install.
