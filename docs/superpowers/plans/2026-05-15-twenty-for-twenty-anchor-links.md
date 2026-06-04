# Twenty-for-Twenty Anchor Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable `#NN-name-slug` anchor links to `/twenty-for-twenty` so visitors can jump directly to a specific card and copy the current URL to share what they're viewing.

**Architecture:** Two pure helper functions (`slugForCard`, `parseCardNumberFromHash`) live in a small module. The page's existing `$effect` is extended to (a) read the hash on mount/hashchange and jump scroll, and (b) update the URL hash via `history.replaceState` as `cardStackProgress` advances. No new components, no new actions, no new stores.

**Tech Stack:** SvelteKit + Svelte 5 (`$state`, `$effect`, `$derived`), Playwright for smoke testing. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-15-twenty-for-twenty-anchor-links-design.md](../specs/2026-05-15-twenty-for-twenty-anchor-links-design.md)

---

## File Structure

- **Create** `src/lib/twenty-for-twenty/hash.ts` — pure helpers for slug generation and hash parsing.
- **Modify** `src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte` — extend the existing `$effect` block (~line 74) to add hash sync.
- **Modify** `tests/smoke/pages.spec.ts` — append one Playwright test exercising the anchor-link flow end to end.

No file gets large; the page script script grows by ~40 lines and stays well under 150 lines total.

---

## Task 1: Playwright smoke test (failing)

We TDD the feature through the smoke test. The pure helpers are simple enough to read and verify by eye; the real risk is the integration with the scroll machinery, which only an end-to-end test catches.

**Files:**

- Modify: `tests/smoke/pages.spec.ts` (append at end)

- [ ] **Step 1: Add the failing test**

Append to `tests/smoke/pages.spec.ts`:

```typescript
test("/twenty-for-twenty supports anchor links to specific cards", async ({ page }) => {
  const errors = attachConsoleWatcher(page);

  // Inbound: hash by number only should jump past the hero.
  await page.goto("/twenty-for-twenty#04", { waitUntil: "domcontentloaded" });
  await expect(page.locator("footer")).toBeVisible();

  // Card 4 of 20 should land roughly 3/19 of the way through the cards
  // section. The hero section is ~100vh, so scrollY should be well past it.
  const viewportHeight = page.viewportSize()?.height ?? 720;
  const scrollY1 = await page.evaluate(() => window.scrollY);
  expect(scrollY1, "card-4 hash should scroll past hero").toBeGreaterThan(viewportHeight);

  // Outbound: after scrolling further down, hash should self-correct to a
  // higher card number (or include the canonical slug).
  await page.evaluate((dy) => window.scrollBy(0, dy), viewportHeight * 4);
  // Settle: the lerp + replaceState happens on subsequent scroll events.
  await page.waitForTimeout(500);
  const hashAfter = await page.evaluate(() => location.hash);
  const matchAfter = hashAfter.match(/^#(\d+)/);
  expect(matchAfter, `hash "${hashAfter}" should match #NN…`).not.toBeNull();
  expect(Number(matchAfter![1]), "hash should advance past card 4").toBeGreaterThan(4);

  // Bogus hash should not throw or scroll past the hero.
  await page.goto("/twenty-for-twenty#99-nonexistent", {
    waitUntil: "domcontentloaded",
  });
  const scrollY2 = await page.evaluate(() => window.scrollY);
  expect(scrollY2, "bogus hash should leave page at top").toBeLessThan(50);

  expect(errors, "console errors on /twenty-for-twenty").toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:smoke -g "supports anchor links"`
Expected: FAIL — the inbound `#04` won't move the scroll position; `scrollY1` will be near 0.

- [ ] **Step 3: Stop. Do not commit yet.**

We commit after each subsequent task once the corresponding behavior turns the assertions green.

---

## Task 2: Pure helper module

**Files:**

- Create: `src/lib/twenty-for-twenty/hash.ts`

- [ ] **Step 1: Create the helper file**

Create `src/lib/twenty-for-twenty/hash.ts`:

```typescript
type CardLike = {
  number: number;
  name: string | null | undefined;
};

const SLUG_NON_ALNUM = /[^a-z0-9]+/g;
const SLUG_EDGE_HYPHENS = /^-+|-+$/g;

/**
 * Build the canonical hash slug for a card.
 *
 * Examples:
 *   slugForCard({ number: 4, name: "Brand Cocktail" }) // "04-brand-cocktail"
 *   slugForCard({ number: 12, name: null })            // "12"
 */
export function slugForCard(card: CardLike): string {
  const num = card.number.toString().padStart(2, "0");
  if (!card.name) return num;
  const slug = card.name.toLowerCase().replace(SLUG_NON_ALNUM, "-").replace(SLUG_EDGE_HYPHENS, "");
  return slug ? `${num}-${slug}` : num;
}

/**
 * Extract the leading integer from a URL hash. Returns null if absent.
 *
 * Accepts:
 *   "#04"               -> 4
 *   "#04-brand-cocktail"-> 4
 *   "04"                -> 4
 *   "#"                 -> null
 *   "#brand-cocktail"   -> null
 *   ""                  -> null
 */
export function parseCardNumberFromHash(hash: string): number | null {
  const match = hash.match(/^#?(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check`
Expected: PASS (no new errors). If you see errors, they are in your new file — fix them before moving on.

- [ ] **Step 3: Commit (await user approval first)**

Show the diff (`git diff --staged` after staging) and wait for the user to commit. The user has a saved rule against autonomous commits.

```bash
git add src/lib/twenty-for-twenty/hash.ts
# Then ask the user to run:
#   git commit -m "feat(twenty-for-twenty): add hash slug helpers"
```

---

## Task 3: Wire inbound hash resolution

When the page mounts (and on `hashchange`), parse the hash, find the matching card, compute the target scroll position, and jump there.

**Files:**

- Modify: `src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte`

- [ ] **Step 1: Add the import**

At the top of the `<script>` block in `+page.svelte`, after the existing imports, add:

```typescript
import { slugForCard, parseCardNumberFromHash } from "$lib/twenty-for-twenty/hash";
```

- [ ] **Step 2: Add the inbound resolution function**

Inside `<script>`, immediately above the existing `handleScroll` function (around line 66), add:

```typescript
const scrollRangeForCard = (cardIndex: number) => {
  if (!cardsSection || typeof window === "undefined") return null;
  const cardsRect = cardsSection.getBoundingClientRect();
  const sectionOffsetTop = cardsSection.offsetTop;
  const scrollStart = sectionOffsetTop;
  const scrollEnd =
    sectionOffsetTop + cardsRect.height - viewportHeight - (40 * viewportHeight) / 100;
  const L = projectCardArray.length;
  if (L === 0) return null;
  const progress = L === 1 ? 0 : cardIndex / (L - 1);
  return {
    scrollY: scrollStart + progress * (scrollEnd - scrollStart),
    progress,
  };
};

const resolveHashToScroll = () => {
  if (typeof window === "undefined") return;
  const number = parseCardNumberFromHash(window.location.hash);
  if (number === null) return;
  const cardIndex = projectCardArray.findIndex((c) => c.number === number);
  if (cardIndex < 0) return;
  const target = scrollRangeForCard(cardIndex);
  if (!target) return;
  window.scrollTo({ top: target.scrollY, behavior: "instant" });
  // Skip the lerp on initial paint so the visitor lands without animation.
  targetProgress = target.progress;
  cardStackProgress = target.progress;
};
```

- [ ] **Step 3: Wire the function into the existing `$effect`**

Replace the existing `$effect` block (lines 74–83) with:

```typescript
$effect(() => {
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("hashchange", resolveHashToScroll);
  animationFrameId = requestAnimationFrame(animate);
  handleScroll();
  resolveHashToScroll();

  return () => {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("hashchange", resolveHashToScroll);
    cancelAnimationFrame(animationFrameId);
  };
});
```

- [ ] **Step 4: Type-check and exercise locally**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm dev` and visit `http://localhost:5173/twenty-for-twenty#04` in a fresh tab.
Expected: page opens already scrolled into the cards section, with card 4 in view. No visible card-shuffle animation as it lands.

- [ ] **Step 5: Run the smoke test**

Run: `pnpm test:smoke -g "supports anchor links"`
Expected: the first two assertion blocks pass (inbound scroll past hero, bogus hash leaves page at top). The outbound assertion still fails — that's Task 4.

- [ ] **Step 6: Commit (await user approval first)**

```bash
git add src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte
# Then ask the user to run:
#   git commit -m "feat(twenty-for-twenty): scroll to card from URL hash on load"
```

---

## Task 4: Wire outbound hash sync

As the visitor scrolls, replace the URL hash with the current card's canonical slug. Clear the hash when scrolled outside the cards section.

**Files:**

- Modify: `src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte`

- [ ] **Step 1: Add the outbound sync function**

Inside `<script>`, immediately above the existing `handleScroll` function (and above the `scrollRangeForCard` you added in Task 3), add:

```typescript
let lastWrittenHash = "";

const syncHashFromScroll = () => {
  if (typeof window === "undefined") return;
  if (!cardsSection) return;
  if (projectCardArray.length === 0) return;

  const cardsRect = cardsSection.getBoundingClientRect();
  const sectionOffsetTop = cardsSection.offsetTop;
  const scrollStart = sectionOffsetTop;
  const scrollEnd =
    sectionOffsetTop + cardsRect.height - viewportHeight - (40 * viewportHeight) / 100;
  const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;

  const inside = pageScrollTop >= scrollStart && pageScrollTop <= scrollEnd;

  if (!inside) {
    if (window.location.hash) {
      const url = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
      lastWrittenHash = "";
    }
    return;
  }

  const L = projectCardArray.length;
  const currentIndex = Math.max(0, Math.min(L - 1, Math.round(targetProgress * (L - 1))));
  const card = projectCardArray[currentIndex];
  const nextHash = "#" + slugForCard(card);
  if (nextHash === lastWrittenHash) return;
  if (nextHash === window.location.hash) {
    lastWrittenHash = nextHash;
    return;
  }
  window.history.replaceState(null, "", nextHash);
  lastWrittenHash = nextHash;
};
```

- [ ] **Step 2: Call it from the scroll handler**

Update `handleScroll` (currently lines 66–68) to:

```typescript
const handleScroll = () => {
  calculateTargetProgress();
  syncHashFromScroll();
};
```

- [ ] **Step 3: Type-check and exercise locally**

Run: `pnpm check`
Expected: PASS.

Run: `pnpm dev` and visit `http://localhost:5173/twenty-for-twenty`.
Expected:

- Scroll down through the cards: URL hash updates as each new card centers.
- Scroll past the closing CTA: URL hash clears.
- Visit `/twenty-for-twenty#04-old-name`: hash self-corrects to `#04-<canonical-slug>` on the next scroll tick.
- Browser back button returns to the previous page (not the previous card).

- [ ] **Step 4: Run the full smoke suite**

Run: `pnpm test:smoke`
Expected: ALL tests pass, including the new `supports anchor links` test.

- [ ] **Step 5: Commit (await user approval first)**

```bash
git add src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte tests/smoke/pages.spec.ts
# Then ask the user to run:
#   git commit -m "feat(twenty-for-twenty): sync URL hash to the current card on scroll"
```

---

## Task 5: Manual QA pass

Smoke tests cover the basics; eyes on the actual experience catch the rest.

- [ ] **Step 1: Inbound from cold**

In a fresh browser tab (or incognito), open `/twenty-for-twenty#10-<any-slug-or-no-slug>`. Confirm:

- The page lands with card 10 in view.
- There is no visible scroll-down animation past the hero.
- The hero is offscreen above; the CTA is offscreen below.

- [ ] **Step 2: Outbound during scroll**

From the top of the page, scroll slowly through. Confirm:

- The hash updates as each card centers.
- The URL bar reflects `#NN-name-slug` consistently.
- Scrolling fast doesn't leave the hash stuck on a stale card.

- [ ] **Step 3: Off-section behavior**

Scroll to the very top: hash clears. Scroll past the cards into the closing CTA: hash clears.

- [ ] **Step 4: Renamed-card resilience**

In your browser console, run:

```javascript
window.location.hash = "#04-some-old-name-that-doesnt-match";
```

The page should scroll to card 4 (matching by number), and the hash should self-correct on the next scroll event.

- [ ] **Step 5: Mobile sanity**

Open Chrome DevTools device emulation, set to iPhone 14, reload. Confirm the same inbound + outbound behavior works.

---

## Done

After Task 5 passes, the feature is complete. Push when the user is ready.
