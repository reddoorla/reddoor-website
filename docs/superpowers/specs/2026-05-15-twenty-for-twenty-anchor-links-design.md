# Twenty-for-Twenty Anchor Links — Design

## Problem

`/twenty-for-twenty` is a sticky-scroll page: 20 project cards are stacked and revealed as the visitor scrolls, driven by a single `cardStackProgress` value (0→1) derived from `window.scrollY` against the outer `cardsSection` bounds. There is no per-card DOM scroll target. Today there is no way to share a link to a specific project — every visitor lands at the top and must scroll through the deck.

## Goal

Support shareable URLs of the form `/twenty-for-twenty#04-brand-cocktail`. Opening such a URL lands the visitor on that card. While they scroll, the URL hash updates to reflect the currently visible card so they can copy the URL at any moment.

## Hash format

`#NN-name-slug` — two-digit zero-padded project number, hyphen, kebab-cased project name.

- Example: `#04-brand-cocktail`
- Slug rule: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`
- **Inbound parsing matches on the leading number only.** The slug is decorative. `#04`, `#04-anything`, and `#04-old-name` all resolve to project number 4. This makes renames safe.
- If `card.name` is null/empty, the slug portion is omitted: `#04`.

## Behavior

### Inbound (initial load and `hashchange`)

1. Parse leading integer from `location.hash` (regex: `/^#(\d+)/`).
2. Find the card with matching `card.number`. If none, do nothing.
3. Compute target `cardStackProgress`:
   - `progress = (cardIndex) / (L - 1)` where `cardIndex` is the 0-indexed position in `projectCardArray` and `L = projectCardArray.length`.
   - Special-case `L === 1`: `progress = 0`.
4. Convert progress to absolute scroll position using the inverse of `calculateTargetProgress`:
   - `scrollStart = cardsSection.offsetTop`
   - `scrollEnd = scrollStart + cardsSection.getBoundingClientRect().height - viewportHeight - (40 * viewportHeight) / 100`
   - `scrollY = scrollStart + progress * (scrollEnd - scrollStart)`
5. `window.scrollTo({ top: scrollY, behavior: "instant" })`.
6. Set `cardStackProgress = targetProgress` directly (bypassing the lerp) so the visitor sees the destination immediately, not a card-shuffle animation.

### Outbound (during scroll)

In the existing `handleScroll` path, after `calculateTargetProgress` updates `targetProgress`:

1. If `pageScrollTop < scrollStart` or `pageScrollTop > scrollEnd` → if the URL has a hash, clear it via `history.replaceState(null, "", location.pathname + location.search)`.
2. Otherwise:
   - `currentIndex = Math.round(targetProgress * (L - 1))` (clamped to `[0, L-1]`).
   - Resolve `card = projectCardArray[currentIndex]`.
   - Build hash from `card.number` and `card.name`.
   - Only call `history.replaceState` when the resolved hash differs from `location.hash`.

### Edge cases

- **Cards not yet rendered.** The effect that wires up the listeners depends on `cardsSection` being bound. The inbound hash resolution happens inside that effect, after `cardsSection` and `viewportHeight` are both available. If `projectCardArray.length === 0`, skip entirely.
- **Hash points to a card number that doesn't exist** (deleted/typo). Ignore — page loads at top as normal.
- **User pastes a hash mid-session via address bar.** Handled by `hashchange` listener that runs the same inbound flow.
- **Card numbers are not array indices.** Always resolve via `card.number`, not by indexing. The current data shows sequential 1–20, but we don't rely on that.

## Code layout

- **`src/lib/twenty-for-twenty/hash.ts`** (new) — two pure functions:
  - `slugForCard(card: { number: number; name: string | null | undefined }): string` — returns e.g. `"04-brand-cocktail"` or `"04"`.
  - `parseCardNumberFromHash(hash: string): number | null` — returns the integer or null.

  Pure functions, easy to unit-test, no DOM access.

- **`src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte`** — extend the existing `$effect` block:
  - Add `hashchange` listener alongside the existing `scroll` listener.
  - Run inbound resolution once on mount (after `cardsSection` is bound).
  - Extend `handleScroll` to call the outbound sync after updating `targetProgress`.

  No new component, no action, no store. The behavior is scoped to this one page and uses the existing `cardsSection` ref and `cardStackProgress` state.

## What we are NOT building

- An on-page table of contents / index of project links.
- Smooth-scroll behavior on inbound — `instant` is correct so the visitor doesn't watch the page scroll past the hero.
- `pushState` for back/forward navigation between cards. Browser back goes to the previous page, not the previous card.
- A `<svelte:head>` canonical-URL update — the canonical of the page is still `/twenty-for-twenty` regardless of hash.

## Acceptance criteria

1. Loading `/twenty-for-twenty#04-brand-cocktail` in a fresh tab puts the visitor at card 4 with no visible scroll animation past prior cards.
2. Loading `/twenty-for-twenty#04` (no slug) does the same.
3. Loading `/twenty-for-twenty#99-nonexistent` lands at the top of the page, unchanged.
4. Scrolling from the top through the cards updates the URL hash card by card. Pasting the URL into another tab lands on the same card.
5. Scrolling **past** the cards section into the closing CTA clears the hash.
6. Pressing the browser back button after arriving via a hash returns to the previous page, not the previous card.
7. Renaming a project in Prismic does not break existing shared links (number-based match).
