# Morning brief — 2026-06-23

_Evening review run 2026-06-22. Scope: whole repo, branch-aware (`feat/portfolio-search`). Severity: everything incl. LOW. Read-only — nothing changed except writing this brief, a throwaway Lighthouse run, and a refresh of two stale project-memory entries._

**Gates are green.** `pnpm check` → **0 errors**, `pnpm lint` (prettier + eslint) → **clean**, `pnpm build` → **clean**, smoke suite → **12/12 pass** (incl. the new Relevance test). `pnpm audit` → 9 advisories (2 high / 5 moderate / 2 low), but **all in build/dev/tooling chains — none in the deployed runtime** (MED-4).

**I ran Lighthouse against a production preview (desktop preset) — your perf-regression hunch comes back clean:**

| Route                | Perf | A11y | Best-Pr | SEO | LCP   | CLS   | TBT   |
| -------------------- | ---- | ---- | ------- | --- | ----- | ----- | ----- |
| `/`                  | 95   | 100  | 100     | 100 | 1.4 s | 0.004 | 0 ms  |
| `/portfolio`         | 99   | 98   | 100     | 100 | 0.6 s | 0     | 70 ms |
| `/dev/a11y-fixtures` | 100  | 100  | 100     | 100 | 0.4 s | 0.004 | 0 ms  |

No regression; Best-Practices is **100 everywhere** (the #44 cookie gate holds — and GA, see MED-7, isn't currently tanking it). The only deductions: `/portfolio` a11y 98 = **heading-order** (h1→h4 skip; the "But wait, there's more!" title is a styled `<div>`, not a heading — the #40 homepage heading fix never reached this page; MED-10), plus a `valid-source-maps` best-practices info flag.

**The catch:** those are _desktop, local, uncontended_ numbers — and the single most important systemic finding is that **Lighthouse never measures these pages in any gate** (HIGH-1). The pages most likely to regress on mobile (the image-heavy grids, MED-1) are exactly the ones nothing samples.

---

## Top of stack (do this first)

You're already going to be in `portfolio/+page.svelte` tomorrow tuning the VT constants — three high-leverage moves, smallest first:

1. **Resolve the dead/unreachable category state** (~10 min, same file) — `showWeb` is fully dead (no button, no `categoryMatch` clause, no `web` field in `prismicio-types`) and `showPackaging` is _unreachable_ (real `packaging` field + a live `categoryMatch` clause, but no button, so packaging-only projects can never be filtered). Delete `showWeb`; decide whether Packaging gets a button or gets removed. Keeps state/buttons/`categoryMatch` 1:1 before more search work lands on top. (MED-3)
2. **Add the `sharp` override** (~10 min) — kills the `objc … GNotificationCenterDelegate … implemented in both … @1.0.4 … and … @1.2.4` warning you see on every test/build run. Add `overrides:` → `sharp: "0.34.5"` to `pnpm-workspace.yaml`, reinstall, then `pnpm build` + smoke to confirm transforms still work and `pnpm why sharp` reports one version. (MED-2)
3. **Propagate the #44 image pipeline to the archive grid** — the biggest _realized_ perf win left. The archive `<img src={hero.url}>` serves original-format, full-res masters; add `imgixParams={{ auto: ['format','compress'] }}` + `sizes`/`widths` + `loading="lazy" decoding="async"` (keep the first 1–2 cards eager). Start with the grid you're already editing, then fan to slices/detail heroes. (MED-1)

---

## Findings — CRITICAL

**None.** No security incident, no committed secret, no data-loss path, build green. Stated plainly rather than inflated.

---

## Findings — HIGH

### HIGH-1 — Lighthouse is installed but never gates this repo's PRs; perf is effectively ungated _(non-obvious)_

`@lhci/cli` is a devDep and `lighthouserc.json` exists, but **nothing in CI runs them**. The repo's CI is the shared `reddoorla/.github` reusable workflow (`ci.yml:11` → prettier/eslint/svelte-check/build/playwright/`reddoor-maint` a11y audit) — no lhci step, no package.json script, no hook. Lighthouse runs only in the `@reddoorla/maintenance` nightly fleet cron, against the **deployed apex URL only**, and the shared `lighthouserc` `collect.url` is **`/dev/a11y-fixtures`** in **dev mode** with perf as warn-only (MED-5). So every perf claim in #34/#37/#41/#44/#45 was hand-measured and can silently regress with zero CI signal; the orphaned config _implies_ a local gate that doesn't exist.
**Why it matters:** this is the root cause of the image-pipeline drift (MED-1) going unnoticed — no automated signal on the real pages.
**Fix / decision:** either add an `lhci autorun` step against a prod-build preview of real routes (`/`, `/portfolio`, one `/portfolio/[uid]`), or delete the orphaned `@lhci/cli` + `lighthouserc.json` from per-site repos and document that perf is fleet-nightly-only. (Open question 1.)

---

## Findings — MEDIUM

### MED-1 — The #44 image pipeline is siloed to the homepage hero; grid/slice/detail images serve original format at full size _(non-obvious)_

`imgixParams` appears essentially once in `src/` (`OpeningAnimation.svelte:237`, the homepage hero). The archive grid (`portfolio/+page.svelte:748-753`), related/showcase grids, the eager LCP detail heroes (`portfolio/[uid]/+page.svelte:19`, `showcase/[uid]/+page.svelte:22`) and every slice `PrismicImage` omit `imgixParams`, so imgix serves the uploaded PNG/JPEG (not avif/webp) at full resolution.
**Why it matters:** didn't dent my _desktop_ run (below-fold, fast local), but on mobile/throttled PSI this is the classic modern-formats / properly-size / efficiently-encode failure — and per HIGH-1, nothing measures it.
**Fix:** `imgixParams={{ auto: ['format','compress'] }}` + `sizes`/`widths` + `loading="lazy" decoding="async"` on the grids (first 1–2 cards eager); same params on slice images and the eager heroes. A shared opt wrapper prevents re-drift.

### MED-2 — Two `sharp` (+ two native libvips) versions installed — root cause of the objc duplicate-class warning _(non-obvious)_

Disjoint caret ranges pull two majors: `sharp@0.33.5` via `@zerodevx/svelte-img` → vite-imagetools → `imagetools-core@6.0.4 (^0.33.1)` (build-time), and `sharp@0.34.5` via `@reddoorla/maintenance@0.40.0 (^0.34.5)`. `^0.33.1` and `^0.34.5` can't dedupe; both native libvips dylibs are on disk and built → the `GNotificationCenterDelegate implemented in both …1.0.4 … and …1.2.4` warning. svelte-img can't move off 0.33 (2.1.2 is latest).
**Why it matters:** the _warning_ is macOS-local (Netlify is Linux — per the 06-05 brief), but the _duplicate_ is real everywhere: doubled native install size, slower CI, and objc's "which is used is undefined" native-crash class.
**Fix:** add `overrides: { sharp: "0.34.5" }` to `pnpm-workspace.yaml` (intentionally bypassing the declared `^0.33.1`); build + smoke to confirm `imagetools-core@6.0.4` still transforms on 0.34, and `pnpm why sharp` shows one version. Fall back to `0.33.5` only if the build breaks.

### MED-3 — Dead + unreachable portfolio category state _(non-obvious)_

`portfolio/+page.svelte`: `showWeb` (`:44`) is `$state(false)`, OR'd into `showAll` (`:55`) and the close-effect deps (`:77`), but has **no button, no `categoryMatch` clause, and no `web` boolean** in `prismicio-types` — pure dead code, can never be true. `showPackaging` (`:42`) **is** read by `categoryMatch` (`:311`, `packaging` is a real Prismic field) but has **no toggle button** (the five rendered are BRAND/PRINT/ENVIRONMENTAL/PRODUCT/DIGITAL), so packaging-only projects can never be isolated — a missing feature masquerading as working. Both span non-adjacent committed regions, so a diff-only review misses them.
**Fix:** keep state vars ↔ `categoryMatch` clauses ↔ buttons in 1:1 correspondence. Delete `showWeb` entirely; either add a PACKAGING button or drop `showPackaging` + its clause. (Open question 2.)

### MED-4 — pnpm audit: 9 advisories — all build/dev/tooling, none in the deployed runtime

2 high (`html-minifier` ReDoS via maintenance→mjml; `tmp` path-traversal via `@lhci/cli`), 5 moderate (`mjml`, `file-type`, `uuid`, `js-yaml`, `http-proxy-middleware` — slice-machine-ui/lhci/maintenance chains), 2 low (`cookie` <0.7 in every SvelteKit copy — not exploitable as used; `tmp` symlink). **None sit in the visitor-facing SSR/edge runtime.** Note: `@reddoorla/maintenance` is a _prod_ dep that pulls `@lhci/cli`, so the lhci-chain advisories also appear under `--prod` — they don't execute at runtime but bloat the prod install.
**Fix:** prefer upstream bumps (Renovate); for immediate mitigation, targeted verified overrides (`tmp>=0.2.6`, `uuid>=11.1.1`, `js-yaml>=4.1.2`, `cookie>=0.7.0`, `http-proxy-middleware>=2.0.10`; html-minifier/mjml are the riskiest to force). **The 06-05 brief's "add `pnpm audit --prod --audit-level high` as a CI gate" is still unaddressed** — that's why these accumulate silently.

> **Update (2026-06-23):** Deferred out of this repo — the `pnpm audit` CI gate and the
> advisory overrides are being handled at the fleet level (`reddoorla/.github` workflow +
> `@reddoorla/maintenance`), not in reddoor-website. Cleared from this repo's backlog.

### MED-5 — The Lighthouse gate only audits `/dev/a11y-fixtures`, in dev mode, perf warn-only _(non-obvious)_

The shared `@reddoorla/maintenance/configs/lighthouse` sets `collect.url = ['http://localhost:5173/dev/a11y-fixtures']`, `startServerCommand: "npm run vite:dev"` (dev, not prod build), and assertions a11y≥0.95 / bp≥0.9 / seo≥0.9 as **errors**, perf≥0.7 as a **warn**. The nightly deployed run only hits the apex URL. So no automated Lighthouse ever exercises portfolio/detail/showcase/slice-heavy pages — the ones most likely to fail.
**Fix:** add real routes to a per-site `lighthouseUrl` override, or extend fleet deployed-mode to sample a few routes per site.

### MED-6 — Sort dropdown is a non-ARIA custom listbox

`portfolio/+page.svelte:703-730`: a bare `<button>` toggling `isOrderSelectOpen` over a stack of option `<button>`s. No `aria-haspopup`/`aria-expanded`, no `role=listbox/option`, no roving arrow-key nav, no Escape-to-close, no click-outside handler (it only closes via the `$effect` at `:69-83`). Open it, click empty space → stays open. The Relevance work refactors this exact each-loop, so it's the right moment.
**Fix:** `aria-haspopup="listbox"` + `aria-expanded` on the trigger; `role="listbox"`/`role="option" aria-selected` on the list; `onkeydown` for Escape/Arrows; a `window` pointerdown/focusout listener (cleaned up in the effect teardown).

### MED-7 — Google Analytics gtag.js loads unconditionally for every visitor — not gated like #44's toolbar

`app.html:40-49` loads `gtag/js?id=G-2CZMPGL9RR` for all visitors, setting `_ga`/`_ga_*` cookies, with no consent gate and no `anonymize_ip`/cookie-flags. #44 gated the Prismic toolbar's third-party cookies; GA is the remaining one.
**Why it matters:** **my LH run shows BP still 100 _with_ GA present**, so it isn't currently tanking Best-Practices — this is a privacy/consent + future-risk finding, not a current regression.
**Fix:** consent-gate / post-interaction load / set `anonymize_ip` + SameSite, or document why GA is exempt. (Open question 4.)

### MED-8 — `@axe-core/playwright` is orphaned: a fixture page + config route exist, but no test runs axe

`@axe-core/playwright (^4.11.3)` is installed and `/dev/a11y-fixtures` self-describes as "a stable target for @lhci/cli and Playwright + axe-core coverage", but `tests/` has **zero** `axe`/`AxeBuilder`/`injectAxe` usages — the two specs only assert console-error-free loads + search behavior. The dep + fixture page + config route were built for an a11y test that was never written.
**Fix:** add `tests/a11y/fixtures.spec.ts` importing `a11yRoutes` from `@reddoorla/maintenance/configs/playwright-a11y` + `AxeBuilder`, asserting `violations.toEqual([])`. If a11y gating is deferred, remove the dep + route so it stops implying coverage.

### MED-9 — Design spec body still documents the dropped keep-mounted/CSS-hide/flip approach _(non-obvious, doc drift)_

`docs/superpowers/specs/2026-06-22-portfolio-fuzzy-search-design.md`: the Revision-2 header (lines 16-26) records that keep-everything-mounted + CSS-hide + `animate:flip` was replaced by View Transitions, but the body (sections 3-5 + Data flow, lines ~149-213) still presents `matchedUids` as a `Set`, an `isVisible()` helper, and the CSS-hide pattern — none of which shipped (`+page.svelte` uses `rankedUids: string[]|null`, a `visibleProjects` derived that renders only matches, per-card `view-transition-name`). Status still "Approved (pending spec review)" though shipped. A maintainer following sections 3-5 would build the abandoned design.
**Fix:** rewrite sections 3-5 + the data-flow diagram (or strike them into the Revision-2 note); set Status → "Shipped".

### MED-10 — `/portfolio` heading-order (the a11y-98 deduction); #40's homepage fix didn't propagate

`/portfolio` jumps h1 (Portfolio) → h4 (project sections) and renders the archive title as a styled `<div>`. #40 fixed homepage heading-order to a11y 100; other pages still skip levels. (Generalizes the 06-05 MED-7.)
**Fix:** one logical heading hierarchy per page; convert decorative big-type to `aria-hidden` spans.

**Carried forward from 2026-06-05, verified still open:**

### MED-11 — `LandscapeModal.svelte:12` unguarded `screen.orientation.type` can throw inside an `$effect`

`const isNotPortrait = screen.orientation.type !== "portrait-primary"` — `screen.orientation` is `undefined` on some iOS Safari versions; the throw inside an `$effect` is the same scheduler-kill blast radius as the self-write bug, on the exact platform the API is flakiest. **Still open.** (was MED-2)

### MED-12 — No security headers

`netlify.toml` has no `[[headers]]`, no `static/_headers`. No CSP, X-Frame-Options/`frame-ancestors`, X-Content-Type-Options, Referrer-Policy, or HSTS. **Still open.** (was MED-5)

### MED-13 — `DefaultButton.svelte:46-47` renders `<a><button>` (nested interactives)

The `href` branch nests `<button>` inside `<a>` — invalid HTML, double tab stop, on the site's primary CTA. **Still open.** (was MED-9)

### MED-14 — No skip link / no overlay focus management

No "skip to content" link; overlays (mobile menu, OpeningAnimation menu, about popup, LandscapeModal) open without moving/trapping/restoring focus. **Still open.** (was MED-8)

---

## Findings — LOW

**Today's WIP — fold into tomorrow's VT tuning session (same file, `portfolio/+page.svelte`):**

- **LOW-1** — Per-card VT override only tweens `transform`; if cards ever differ in size (featured card, responsive breakpoint mid-transition), far cards snap-resize while near cards tween (latent, gated on uniform `lg:w-1/2 aspect-4/3`). Add a one-line invariant comment, or carry width/height in the keyframe. (`:250-253`) _The reviewer's "fades instead of slides" worry does NOT occur — a real slide keyframe is emitted; the risk is size, not slide-vs-fade._
- **LOW-2** — Rapid successive transitions: the skipped transition's `.finished` rejection runs the shared `clear()`, which can wipe the _new_ transition's overrides (timing-fragile, single shared sheet). Tag each transition with a generation token; only clear if still latest. (`:262-269`)
- **LOW-3** — Debounce fires a full View Transition + `getBoundingClientRect` sweep even when the query is unchanged/empty (incl. the mount no-op). Guard `if (q === debouncedQuery) return;` **inside the timeout, before `withViewTransition`** — _not_ by reading `debouncedQuery` in the tracked effect body (that's the guard you reverted earlier; see LOW-5). (`:276-294`)
- **LOW-4** — Sort dropdown closes on every keystroke: the close-effect tracks raw `searchQuery` (`:80`), not `debouncedQuery`. Track `debouncedQuery` or drop it from the deps. (`:69-83`)
- **LOW-5** — Self-write guardrail (not a current bug): the debounce is correct _because_ `debouncedQuery`/`orderString` are read inside the `setTimeout` (untracked). A refactor hoisting those reads into the effect body would reintroduce the scheduler-kill bug. Keep them in the callback. (`:272-294`)
- **LOW-6** — Category toggles lack `aria-pressed`; the no-results live region doesn't mention an active category filter. (`:655-685`, `:732-736`)
- **LOW-7** — The page imports `fuse.js` + builds the index upfront on the edge-cached page, even for non-searchers. Lazy-import Fuse on first focus/input. (`:26`, `:112-124`)

**Repo hygiene / perf nits:**

- **LOW-8** — Grid `<img>` set `fetchpriority="low"` but omit `loading="lazy"`/`decoding="async"` → thumbnails still fetch eagerly (no CLS risk — fixed aspect containers). Fix with MED-1.
- **LOW-9** — Slideshow renders 3× all slides eagerly (`tripledArray`), no lazy/imgix. (`Slideshow/index.svelte:15,137-141`)
- **LOW-10** — Async-font work half-finished: only Typekit CSS preloaded, no woff2 face preload, kit is `font-display:auto` (FOIT). (`app.html:16-28`)
- **LOW-11** — ISR CDN cache doesn't `Vary` on the preview cookie → a previewer can be served edge-cached published HTML (static inference, not runtime-confirmed). (`+layout.server.ts:22-26`)
- **LOW-12** — No `engines` pin despite the Node 24 migration (only `.nvmrc` 24.16.0 + CI input "24"). Add `"engines": { "node": ">=24", "pnpm": ">=11" }`.
- **LOW-13** — Production site still carries starter identity: `name: "sveltekit-starter-prismic-minimal"`, `version 0.0.1`. Rename + version in the same housekeeping pass as LOW-12.
- **LOW-14** — Stale FontAwesome console allowlist in `tests/smoke/pages.spec.ts:14-19` (FA removed in #42) — dead suppressors that could mask a real regression; plus a README "replace font awesome" TODO and plan-doc drift (`docs/.../plans/2026-06-22-portfolio-fuzzy-search.md` still hardcodes threshold 0.4→shipped 0.2, the `matchedUids`/flip approach, and "Relevance out of scope"→built).
- **LOW-15** — No vitest / no unit tests for `toSearchRecord`/`mediumString` despite the spec's Testing section calling for them. Add vitest + `projectServices.test.ts` (first-paragraph extraction, empty/missing-field degradation, comma-join label).
- **LOW-16** — `/dev/a11y-fixtures` is publicly crawlable in prod. It's the LH/axe target (keep it), but `noindex` / `Disallow: /dev/` or gate with `if (!dev) error(404)` while still allowing the test harness. (was LOW-1)
- **LOW-17** — `minimumReleaseAge: 0` disables pnpm 11's 24h supply-chain cooldown (documented, deliberate; revisit when Renovate respects a window + `minimumReleaseAgeExclude: ['@reddoorla/*']`).
- **LOW-18** — #45 (Vimeo `dnt=1`) rides in this feature branch, **not on `main`** (verified: `97a224a` is not an ancestor of main; main's `ContentWidthMedia` has 0 `dnt=1`, this branch has 2). The privacy fix is currently gated behind the portfolio-search PR. Cherry-pick to main if it should ship independently. (Open question 5.)
- **LOW-19** — `valid-source-maps` flag on `/portfolio` (prod source maps missing/invalid for some scripts; BP still 100). Low priority.

---

## Open loops carried forward (graded)

**Closed since 2026-06-05** ✅ — the prior brief drove these:

- **HIGH-1 (OG image broken on every page)** → **fixed** (`+layout.svelte:113` now `content={metaImageUrl}`).
- **HIGH-3 (related-projects SSR/build crash)** → **fixed** (server `-1`/`findIndex` guard at `[uid]/+page.server.ts:44-48` + `{#if data.relatedProjectOne/Two}` template guards).
- **HIGH-5 (live Prismic write token in `.env.local`)** → **resolved** (`.env.local` no longer holds it).
- **Heading-order / canonical** → **partial** (#40 fixed the homepage; `/portfolio` still skips levels — MED-10; layout-wide canonical still absent).

**Still open** (graded above): security headers (MED-12), skip link (MED-14), LandscapeModal crash (MED-11), DefaultButton nesting (MED-13), `/dev/a11y-fixtures` public (LOW-16), `pnpm audit` not a CI gate (MED-4), the FA console allowlist (LOW-14).

**Branch cruft:** 4 fully-merged local branches safe to delete (`nav-on-open`, `onboard/canonical-tooling`, `opening-anim`, `svelte-5`); ~9 more are squash-merged-but-lingering (`git branch --merged` can't see squashes — confirm via `gh pr list --state merged`). `video-handling` (abandoned, Sep 2025) is still present — the 06-05 brief already recommended deleting it.

---

## Decisions deferred / open questions (need you)

1. **Lighthouse in CI:** gate this repo's PRs (add `lhci autorun` on real routes), or accept fleet-nightly-only and delete the orphaned `@lhci/cli` + `lighthouserc.json`? (HIGH-1)
2. **Web / Packaging categories:** delete `showWeb` (no field at all) — but do you want a **Packaging** filter button _added_, or `showPackaging` + its clause _removed_? (MED-3)
3. **`sharp` override target:** 0.34.5 (keeps maintenance's runtime dep current; small risk `imagetools-core@6.0.4` was authored against 0.33) vs 0.33.5 (safer for the pipeline, downgrades maintenance). I'd try 0.34.5 first. (MED-2)
4. **GA vs Best-Practices=100:** consent-gate / post-interaction GA, or is GA business-required unconditional (document the exemption)? BP currently still measures 100. (MED-7)
5. **#45 Vimeo `dnt=1`:** cherry-pick to `main` independently now, or leave it riding the portfolio-search PR? (LOW-18)
6. **Your standing rule:** none of these are committed. Which (if any) do you want applied tomorrow vs. left as a reviewed brief?

---

## What I did NOT do tonight

Read-only review. **No commits, no PRs, no pushes, no Prismic/Netlify/service writes, no dependency changes, no branch deletions.** Writes were: this brief; a throwaway `/tmp/rd_lhci.json` + the gitignored `.lighthouseci/` artifacts from the Lighthouse run; and a refresh of two stale project-memory entries (the stack memory said pnpm 10 / Node 22 — now pnpm 11.7 / Node 24). Your uncommitted velocity + Relevance WIP is **untouched and still green**, ready for tomorrow's tuning. A `pnpm preview` server is still running on `:4173` from the Lighthouse run — it'll close at session end (or kill the process).

---

## Things you couldn't have gotten from today's diff

1. **The measurement gap.** Your perf hunch comes back clean on desktop (95–100, BP 100) — but the reason that's not the whole story is that the Lighthouse "gate" only ever audits a synthetic `/dev/a11y-fixtures` page in dev mode (HIGH-1/MED-5). So the one realized perf inconsistency — **every portfolio/slice/detail image still serving original-format full-res masters** (MED-1), the #44 win that never propagated past the homepage — is completely unsampled. It won't show in any green check; it shows up as a slow mobile PSI on the heaviest pages. Un-gated + un-sampled = a regression here ships silently. Highest-leverage thing to close.
2. **The dead category state** (MED-3) and **the spec describing an abandoned design** (MED-9) — both span non-adjacent committed regions, invisible to a diff of today's WIP, and both will mislead the next person (or agent) who builds on the search feature.
