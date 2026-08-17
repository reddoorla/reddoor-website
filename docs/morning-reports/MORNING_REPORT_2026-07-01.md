# Morning brief — 2026-07-01

_Evening review run 2026-06-30. Scope: whole repo (anti-recency-bias), branch `feat/portfolio-featured-redesign`. Severity: everything incl. LOW/nits. Read-only — nothing changed except this brief and the Phase-1 session allowlist in `.claude/settings.local.json`. Method: 4 parallel gates + 3 review subagents (today's PR-#78 code / wider repo / config-CI-deps-docs) + git archaeology + grading of the 06-05 and 06-23 briefs._

**Gates are green.** `pnpm check` → **0 errors**, `pnpm lint` (prettier + eslint) → **clean**, `pnpm test:unit` → **8/8**, `pnpm audit` → **3 advisories** (1 low / 2 moderate), all in the slice-machine / Prismic / maintenance **dev-tooling** chains — `pnpm audit --prod` shows only the single framework-owned `cookie <0.7` low (kit-pinned). None in your deployed runtime. Advisory count is **down from 9** (06-23) → the fleet-level relock + #77 worked.

**The headline: there is very little to worry about.** The 06-23 evening review drove PRs #46–70 and closed almost the entire backlog — Lighthouse now gates real routes (#56/#57), security headers + Report-Only CSP shipped (#53/#62), GA hardened (#61), axe coverage wired (#63), skip link + focus trap (#52/#60), LandscapeModal orientation guard (#50), DefaultButton single-`<a>` (#51), portfolio/showcase heading-order (#59), dead category state removed (#49), sharp deduped (#47/#72), Fuse lazy-loaded (#69), vitest added (#70), package identity fixed (#68). All **verified still holding** tonight. Today's PR #78 (portfolio featured rebuild + live Revogen/Vimeo banners) is green and did **not** regress any of them.

So the findings below are a short list of resilience/a11y/perf items — no critical, no high.

---

## Top of stack (do this first)

1. **Merge PR #78, then fix its own spec (10 min).** The branch is green and verified (all four checks, live-preview confirmed). But `docs/superpowers/specs/2026-06-30-portfolio-featured-rebuild-design.md` still describes Rubrik and Revogen as **static full-bleed images** — the spec has zero mention of the live `VimeoBanner` or interactive `RevogenBanner` hero that actually shipped (we pivoted mid-build). Add a "Revision 2" block like the fuzzy-search spec has, so the next person doesn't build from the stale plan. (MED-2)
2. **Reduced-motion sweep on the autoplay background videos + LogoSoup scroll (~30 min).** The single biggest genuinely-open cluster: four components autoplay `?background=1` Vimeo and one scroll-scrubs, **none honoring `prefers-reduced-motion`** — a WCAG 2.2.2 (Level A) gap that's been carried since 06-05. Today's `VimeoBanner`/`RevogenBanner` already model the exact pattern (`motion-reduce:` + `matchMedia` poster fallback); copy it across. (MED-3, MED-4)
3. **Stop the 3 inactive Revogen theme-stacks from animating (~15 min, `RevogenGraftsHero.svelte`).** While the hero is on-screen, all **four** theme backgrounds animate — 12 `will-change:transform` radial-gradient layers + 4 blur pseudo-elements — but only one is visible. Gate `animation` to the active (and outgoing-during-fade) theme so the compositor isn't ticking 9 invisible gradients. Cheap protection for the mobile Lighthouse gate you just fought for. (MED-1)

---

## Findings — CRITICAL

**None.** No security incident, no committed secret, no data-loss path, build green. Stated plainly.

---

## Findings — HIGH

**None.** The one item the wider-repo sweep initially rated HIGH — `about/+page.svelte:80` `document.querySelector` inside a `setTimeout` — runs only from a click handler (`handleMobilePopupOpen`), never during SSR/hydration, so it can't throw on the server. Downgraded to nit (N-3).

---

## Findings — MEDIUM

### MED-1 — Revogen hero animates all 4 theme backgrounds at once while visible _(perf; today's code)_

`src/lib/components/RevogenHero/RevogenGraftsHero.svelte:68-80, 329-338` — every `option-N` theme block (3 `.graft-layer` radial-gradient layers each, plus an `add-noise::after { filter: blur(0.5px) }`) is always in the DOM and only opacity-toggled. So on-screen you have **12 continuously-animating gradient layers + 4 blurred overlays** composited every frame, of which 9 layers are invisible (`opacity-0`). Bounded by the off-screen `paused` gate (won't hurt LCP/TBT at load) but heavier than needed on the mobile Lighthouse gate.
**Fix:** toggle `animation` (or `animation-play-state`) off on the inactive theme layer-sets via a `class:` binding, keeping it only on the active theme (and the outgoing one during the 2400 ms cross-fade).

### MED-2 — Today's featured-rebuild spec is already drifted from what shipped _(doc drift; non-obvious)_

`docs/superpowers/specs/2026-06-30-portfolio-featured-rebuild-design.md` — the Featured-sequence table and Assets list describe **static full-bleed images** for Rubrik ("full-bleed image → caption") and Revogen ("full-bleed image → 2-col"). What shipped (`+page.svelte:475`, `:504`) is `<VimeoBanner vimeoId="1205996665">` (a live background video) and `<RevogenBanner>` → `RevogenGraftsHero` (a live interactive ported hero). The spec never mentions "vimeo", "live", "interactive", `VimeoBanner`, or `RevogenBanner`. A maintainer following it would rebuild the abandoned static plan.
**Fix:** append a post-implementation Revision block documenting the two live components (same pattern the fuzzy-search spec now uses).

### MED-3 — Autoplay background Vimeo ignores `prefers-reduced-motion` (WCAG 2.2.2) _(carried from 06-05 MED-10, still open)_

Four surfaces autoplay `?background=1&autoplay=1` with **no** reduced-motion gate:

- `src/lib/components/ScreenWidth/ScreenWidthImage.svelte:113`
- `src/lib/slices/ScreenWidthMedia/index.svelte:45`
- `src/lib/slices/ContentWidthMedia/index.svelte:110, 186`
- `src/lib/slices/ScreenWidthColumns/index.svelte:78, 143`

(Today's `VimeoBanner` and `RevogenBanner` **do** honor it — so the pattern already exists in-repo.)
**Fix:** gate the `autoplay`/`background=1` params behind a `matchMedia('(prefers-reduced-motion: reduce)')` check (poster/static fallback), or reuse the `VimeoBanner` approach for these slices.

### MED-4 — `LogoSoup.svelte` scroll-scrub: unthrottled layout reads + no reduced-motion guard _(carried from 06-05 MED-4, still open)_

`src/lib/components/LogoSoup.svelte:34, 71` call `getBoundingClientRect()` on an `$effect` that re-runs on every `scrollY` tick (`:87-88`, `bind:scrollY` at `:93`) — layout thrash on the mobile scroll hot path, with **no rAF coalescing** (unlike `OpeningAnimation`, which does it right) and **no `prefers-reduced-motion` guard** (the only animated component still missing one).
**Fix:** route through a single-in-flight `requestAnimationFrame`; cache `offsetHeight`; gate the scrub on reduced-motion.

### MED-5 — `twenty-for-twenty` uses decorative / multiple `<h1>` — the heading-order sweep never reached it _(carried from 06-05 MED-7, still open)_

`src/routes/[[preview=preview]]/twenty-for-twenty/+page.svelte:161, 178` render `<h1>20</h1>` (decorative number) and `:253` an `<h1>` per card — multiple/decorative h1s pollute the outline. #40/#59/#64–66 fixed homepage/portfolio/about/rich-text heading order but skipped this page.
**Fix:** one `<h1>` per page; convert the decorative "20"/card numbers to `aria-hidden` `<span>`; reserve heading levels for real hierarchy. (Confirm this page is still linked/live first — it may be a legacy campaign page, which would drop this to LOW.)

### MED-6 — `Slideshow` divides by zero on an empty slice _(carried from 06-05 MED-3, still open)_

`src/lib/slices/Slideshow/index.svelte:17` — `slideWidth = $derived(100 / tripledArray.length)`; if a Slideshow slice is published with zero images, `100/0 = Infinity`, transforms go `NaN`, and the autoplay interval keeps mutating `currentIndex` into `NaN`. One mis-authored slice → visibly broken section.
**Fix:** early-return / guard `if (!mediaArray.length) return;` in the markup and the autoplay start.

---

## Findings — LOW

- **LOW-1 — `VimeoBanner.svelte:75-123` heartbeat effect tracks only `mount`, not `iframeEl`.** When `mount` flips true the effect runs in the same flush before the `{#if mount}` `<iframe bind:this>` has committed, so `iframeEl` can be `undefined` at first `subscribe()`/`addEventListener("load")`. The `?.` guards make it a silent no-op and the postMessage `ready` path usually recovers it, but the `load`-nudge can attach to null. Fix: `if (!mount || !iframeEl) return;` so it re-runs once the ref binds. _(today's code)_
- **LOW-2 — `VimeoBanner.svelte:90` `new URL(e.origin).host` can throw on a non-URL origin** (`origin:"null"` from a sandboxed frame, some extensions) — the throw is outside the `try`, surfacing as an uncaught console error on unrelated cross-frame chatter. Mildly BP-relevant (console-errors feed best-practices). Fix: first line `if (e.origin !== "https://player.vimeo.com") return;` (exact match, throw-free). _(today's code)_
- **LOW-3 — Index-as-key `{#each}` in the carousels/slideshow** (`Slideshow/index.svelte`, `ScreenWidthColumns/index.svelte`, `ContentWidthMedia/index.svelte`). For the rotating Slideshow this can mis-fire transitions / leak element state on reorder. Key by a stable field. _(wider repo)_
- **LOW-4 — `ScreenWidthImage.svelte` hero video fallback is cosmetic dead code + eager load.** The `onerror` on a cross-origin Vimeo iframe never fires (loads fine even on 404/privacy-block), so the `showVideo=false` poster fallback is unreachable; `src/lib/utils/vimeo.ts` has a real `checkVimeoVideo` oEmbed probe that isn't wired in. Either drop the machinery or gate the iframe on the probe. (06-05 LOW-9, still open.)
- **LOW-5 — `@reddoorla/maintenance` is a prod `dependency` that pulls only dev tooling** (`package.json:54` → eslint/prettier/@playwright/test/@axe-core/playwright/typescript-eslint…). No runtime import in `src/` (only build-time `configs/svelte` in `svelte.config.js`). A `pnpm install --prod` drags all of it in. Consider moving to `devDependencies` (verify the build's config resolution still works first).
- **LOW-6 — Entry generators can emit `{ uid: null }`.** `showcase/[uid]/+page.server.ts:50`, `[uid]/+page.server.ts:33`, `portfolio/[uid]/+page.server.ts:186` map `page.uid` (Prismic `string | null`) without filtering — a UID-less doc yields a bad prerender entry (the sitemap filters; these don't). Low impact if all these custom types always have uids. (06-05 MED-11.) Fix: `.filter((p) => p.uid)`.
- **LOW-7 — Large tracked source images / repo bloat.** `src/lib/assets/images/` is **69 MB**: `1800dentist.png` 16 MB, `roadmap.png` 11 MB, `stJames.jpg` 7.3 MB, `CEO_HERO…jpg` 4.3 MB, `annualReport.png` 4.2 MB, `headquarters.png` 4.0 MB, `longHollow.png` 3.7 MB. Optimize or move to Prismic/CDN. (06-05 LOW-13, still open.) Note: today's 6 Revogen PNGs are 380–600 KB each (~2.9 MB total) — on the heavier side but served as optimized avif/webp via `?as=run`, so runtime-fine; the originals just sit in git.
- **LOW-8 — Stale local branches (~30).** `git branch --no-merged main` lists ~30 branches, most **squash-merged** (git can't detect it) and safe to prune (`a11y/*`, `fix/*`, `perf/*`, `chore/*`, `ci/*`, `test/*`, `feat/portfolio-search`, etc.). `video-handling` (abandoned Sep 2025, Svelte-4-era `ScreenWidthImage`) **persists across all three briefs now** — delete local + `origin/video-handling`. Confirm merges via `gh pr list --state merged` before pruning.
- **LOW-9 — README is the unmodified starter scaffold.** Still "Reddoor Wireframer and Site Scaffold… forkable starting point," with a `//TODO: mirror prismic docs` and a "Bugs" section — no mention of the live site, CSP, or Lighthouse gate. Cosmetic doc drift.

---

## Nits

- **N-1 — `RevogenGraftsHero.svelte:50-59` IntersectionObserver has no `rootMargin`** (unlike `VimeoBanner`'s `300px`), so the ambient gradient starts exactly at the viewport edge instead of warming up just before. Cosmetic. No leak (teardown disconnects).
- **N-2 — Graft `<button>`s expose no toggle state to AT.** Intentionally non-navigating, but a screen-reader user gets "Surgical Grafts, button" with no `aria-expanded`/`aria-pressed` for the description reveal, and `cursor-default` hides interactivity on desktop. Optional: `aria-expanded={active}` + `aria-controls` on each. _(today's code)_
- **N-3 — `about/+page.svelte:80` unguarded `document.querySelector`** inside a `setTimeout` — only ever runs from a click handler (never SSR), so defensive-only.
- **N-4 — `netlify.toml:4` declares `functions = "functions/"`** but no such directory exists (adapter-netlify emits its own to `.netlify/`). Stale no-op line.

---

## Open loops carried forward (graded)

**Closed since 06-23** ✅ (verified in the current tree tonight): Lighthouse real-route PR gate (#56/#57 — assertMatrix regex verified: detail pages warn-only BP, home/list hard-gate), security headers + Report-Only CSP (#53/#62 — directives cover Vimeo/Prismic/Typekit/GA/Fonts, nothing blocked), GA deferred/hardened (#61), axe coverage (#63), skip link + focus trap (#52/#60), LandscapeModal `screen.orientation?.` guard (#50), DefaultButton single-`<a>` (#51), portfolio/showcase heading-order (#59), dead `showWeb`/unreachable `showPackaging` resolved + PACKAGING button (#49), sharp deduped to single version via override (#47/#72), Fuse lazy-load (#69), vitest + projectServices tests (#70), package identity `reddoor-website`/v1.0.0 (#68), fuzzy-search spec drift (Revision 2, MED-9 06-23 → resolved), `@lhci/cli` orphan removed with no dangling refs (#75).

**Still open** (all graded above): reduced-motion on autoplay video (MED-3) + LogoSoup (MED-4), twenty-for-twenty headings (MED-5), Slideshow ÷0 (MED-6), entry-generator `uid:null` (LOW-6), large tracked images (LOW-7), `video-handling` branch (LOW-8), README (LOW-9).

**Not re-verified tonight** (carried from 06-05, dropped off the 06-23 grading — worth a targeted pass next time): MED-6 06-05 contact-form programmatic labels (the contact path was reworked to a `FORMS_INGEST` server post — its label/a11y state is unconfirmed) and MED-12 06-05 unguarded top-level `load`s (home/about/portfolio call Prismic bare with no try/catch → raw 500 on an API hiccup; the detail routes do guard). Flagging so they don't silently vanish.

---

## Decisions deferred

1. **PR #78 merge + the interaction-gated Vimeo UX.** The video only autoplays after the visitor's first pointer/scroll/tap (deliberate — keeps the third-party cookie out of the Lighthouse best-practices audit). A visitor who lands and never moves sees the poster. Confirmed acceptable in the session, but re-flagging: if you want true on-load autoplay, that means relaxing the BP gate for `/portfolio` instead. Your call at merge time.
2. **twenty-for-twenty (MED-5):** is that page still linked/live? If it's a retired campaign page, the heading fix drops to LOW (or delete the route).
3. **`@reddoorla/maintenance` dep classification (LOW-5):** move to `devDependencies`, or is there a reason it's a runtime dep? I found no `src/` runtime import.

---

## What I did NOT do tonight

Read-only review. **No commits, no pushes, no PRs, no Prismic/Netlify/service writes, no dependency changes, no branch deletions, no code fixes** — even the obvious ones. The only writes were: this brief, and the Phase-1 session allowlist in `.claude/settings.local.json` (read-only command set + the morning-report write path, approved before the run). The working tree is unchanged and green; PR #78 is untouched and ready to merge. The three review subagents and the four gate runs were all read-only (gates mutate no shared state).

---

## One thing you couldn't have gotten from today's diff

The two most useful findings are both invisible to a diff of today's work:

1. **Today's own spec already lies about today's code (MED-2).** We pivoted from static images to a live Vimeo banner + a live interactive Revogen hero mid-build, and the shipped `+page.svelte` proves it — but `2026-06-30-portfolio-featured-rebuild-design.md` still documents the static plan and never names either live component. The most significant thing you built today is undocumented.

2. **The reduced-motion gap is systemic and un-sampled (MED-3/MED-4).** Today's new components honor `prefers-reduced-motion` perfectly — but four older autoplay-video slices and the LogoSoup scroll-scrub never did, and nothing measures them: the Lighthouse gate audits `/`, `/portfolio`, and one detail page, none of which render `ScreenWidthMedia`/`ContentWidthMedia`/`ScreenWidthColumns`/`Slideshow`. So a WCAG 2.2.2 Level-A violation ships on the slice-heavy pages with zero automated signal — exactly the "un-gated + un-sampled" shape the 06-23 brief warned about, one layer down.
