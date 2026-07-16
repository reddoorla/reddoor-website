# Morning brief — 2026-07-16

_Evening review run 2026-07-15, `main` @ `a5fbc8b` (#95). Scope: whole repo, everything incl. LOW (your call). Read-only — nothing changed except this brief and the pre-approved session allowlist. Method: 5 local gates + 2 deep review subagents (correctness — runtime-source-verified; drift/config/security) + git/GitHub archaeology + line-item regrade of the 07-01 brief. The day's shipping arc (16 intros published + verified live, PRs #93–95 merged, 78 branches pruned) is context, not the review._

**Gates:** `check` **0 errors / 0 warnings** · `lint` **clean** · `test:unit` **8/8** · `test:smoke` **26 passed, 1 flake, 1 by-design skip** (flake analyzed below — passes 8/8 isolated) · `pnpm audit` **1 moderate** (dev-only tooling chain) · Dependabot **0 open** (the #95 pins landed and rescanned clean).

**The shape of tonight:** the site you shipped today is in good health — but the review found that **the safety net under it has three real holes** (CI never runs your test suites; two CMS-editable pages can crash in production from ordinary editor actions; today's migration tool would not survive the re-run its own README recommends). None is burning right now; all three are cheap to fix.

---

## Top of stack (do this first)

1. **Wire the test suites into CI — one line (~15 min).** Add `"test": "pnpm test:unit && pnpm test:smoke"` to `package.json`. The fleet CI's "Test (if present)" step logs `no test script — skipping` on every run ([verified in the run log](https://github.com/reddoorla/reddoor-website/actions/runs/29458844803)) — the vitest suite and **all five Playwright smoke specs (accordion, portfolio-search, navigation-a11y, slideshow, pages) have never executed in CI**. Chromium is already installed by the a11y step; `playwright.config.ts:30` is already CI-aware (`reuseExistingServer: !CI`). While there, fix the flake magnet: `tests/smoke/portfolio-search.spec.ts:23` `SETTLE = 700` is shorter than the FLIP floor (`+page.svelte:214` `FLIP_MIN_DURATION = 900`) — replace the fixed waits with `expect.poll` on the visible count. (HIGH-1, MED-11)
2. **Fix the two CMS-triggerable production crashes (~30 min).** `LogoSoup.svelte:103,132,256,283,335` key five `{#each}` blocks on `brand.name` (optional, non-unique) — one duplicated brand row in Prismic hard-crashes **home and /about** at hydration (`each_key_duplicate` throws in prod, verified against svelte 5.56's `each.js` non-DEV path). Same class: `twenty-for-twenty/+page.svelte:217` keys on `card.number` defaulted to `0` — two blank numbers crash the page; and `twenty-for-twenty/+page.server.ts:28` calls `getByID` on relationships without checking `isBroken` — unpublishing a linked project 500s the whole route. Key by index; skip broken links. (HIGH-2, HIGH-3)
3. **Defuse migrate.mjs before anyone re-runs it (~20 min).** `scripts/portfolio-intro/migrate.mjs:127` strips **every** lead_text/text_columns/accordion in a doc, not just the leading intro — an editor-added mid-page Accordion is silently deleted on re-run; and on the 6 `dropExistingLead` docs a re-run can eat one organic paragraph per run (`:129-132`). The README explicitly recommends a re-run (`--only=summittrek`). I verified **no current doc is exposed** (none has `rich_text` post-intro today) — it's latent, not active. Fix: only treat the leading contiguous intro-type run as replaceable, and verify the drop-candidate's text matches data.json's lead before dropping. (HIGH-4)

---

## Findings — CRITICAL

**None.** No security incident, no committed secret (token history verified: `.env.local` never committed; the 307-char write token appears in zero commits), no active data-loss path, build green, live site verified 16/16.

---

## Findings — HIGH

### HIGH-1 — CI has never run the unit or smoke suites

`.github/workflows/ci.yml:11` → fleet workflow's "Test (if present)" runs `pnpm test` only if a `test` script exists; this repo has only `test:unit`/`test:smoke`. Run-log proof: `no test script — skipping`. Everything CI does run: prettier, eslint, svelte-check, build, `reddoor-maint audit --only a11y`, Lighthouse. Everything it doesn't: the 8 vitest tests (#70) and all 5 Playwright behavior specs — including the accordion tests shipped with #93. Local `pnpm test` compounds the trap: it exits 0 having run nothing.
**Fix:** the one-liner in Top-of-stack #1.

### HIGH-2 — LogoSoup crashes home + /about on a duplicate brand name (editor-triggerable)

`src/lib/components/LogoSoup.svelte:103,132,256,283,335` — five `{#each brands as brand, i (brand.name || i)}` keyed on an optional, non-unique KeyText. Duplicate name → `each_key_duplicate` → **production hydration crash** on the two highest-traffic routes. (Verified: svelte throws this in prod builds, not just dev.) The `|| i` fallback only covers _empty_ names, not duplicates.
**Fix:** key by `i` (the list is static per page load; index keys are correct here — same call already made in TextColumns/Accordion #93 review).

### HIGH-3 — /twenty-for-twenty: two independent editor-triggerable breaks

1. `+page.server.ts:28-29`: `isFilled.contentRelationship` does **not** exclude `isBroken` links (verified in @prismicio/client source) — unpublishing a referenced project → `getByID` throws → `Promise.all` rejects → route 500s (and drops out of prerender to an always-500 SSR route on the next build).
2. `+page.svelte:217`: `{#each … (card.number)}` with `number || 0` server-side default — two unset numbers → duplicate key `0` → prod crash of the scroll deck.
   **Fix:** filter `q.data.project.isBroken`; key by index.

### HIGH-4 — `scripts/portfolio-intro/migrate.mjs` idempotency claim is false (latent destroy path)

Detailed in Top-of-stack #3. The docs (`migrate.mjs:12`, `README.md:3`) promise idempotency; the code strips intro-type slices _anywhere_ in the doc and can eat one organic paragraph per re-run on the 6 drop-lead docs. Exposure tonight: **zero** (verified all 6 docs' post-intro slice is media, not rich_text; drafts also require manual Publish). But the README's own `--only=summittrek` instruction is the re-run most likely to happen.
**Fix:** leading-contiguous-run replacement + text-match guard before dropping; error (not silently no-op) on unknown `--only` uids (`:107`).

---

## Findings — MEDIUM

### MED-1 — Lighthouse gate can audit a stale deploy preview (false pass/fail vector)

`.github/workflows/lighthouse.yml:35-45` polls the preview URL for HTTP 200 only — on a PR update the _previous_ commit's preview is already live, so LHCI can score the old build. This is the exact incident documented in project memory (the gate read a stale preview on 6/23); the workflow was never hardened.
**Fix:** poll Netlify for a deploy with `commit_ref == head.sha` (or bake the SHA into a meta tag and compare) before running LHCI.

### MED-2 — Lighthouse gate silently drops the detail page from the matrix

`.github/workflows/lighthouse.yml:49-56` — if the `/portfolio/<uid>` scrape fails (markup refactor), it emits a warning and audits only `/` + `/portfolio`. The page class with the Vimeo carve-out silently exits the gate.
**Fix:** hard-fail when `DETAIL` is empty.

### MED-3 — Showcase overrides pair with the wrong projects after one broken link

`showcase/[uid]/+page.server.ts:27-31` filters unfilled/broken relationships; `showcase/[uid]/+page.svelte:95-128` reads overrides by `pageData.projects[i]` against the **unfiltered** group — one broken row shifts every subsequent card's image/title/subtitle/link overrides onto the wrong project. Bonus crash: `:95` keys by `project.uid` — the same project twice in a showcase group = prod `each_key_duplicate`. Related: `:60` `{"/portfolio/" + featured?.uid || ""}` — precedence bug ships `/portfolio/undefined` when unset.
**Fix:** build `{doc, groupItem}` pairs server-side; key by index; parenthesize the href fallback.

### MED-4 — `$state(new Set())` isn't reactive: the broken-video fallback is dead code

`ContentWidthMedia/index.svelte:21`, `ScreenWidthColumns/index.svelte:10` — Svelte 5 proxies only plain objects/arrays (verified in `proxy.js`); `hiddenVideos.add(i)` never invalidates, so the "hide failed Vimeo, show poster" swap can't ever run.
**Fix:** `SvelteSet` from `svelte/reactivity` (or a boolean array). Sister item: the `onerror` on a cross-origin iframe rarely fires at all (carried 07-01 LOW-4; `utils/vimeo.ts` has an unwired oEmbed probe) — fixing reactivity without wiring the probe still leaves this mostly cosmetic.

### MED-5 — Tailwind `safelist` is dead config; editor-selected colors survive by accident

`tailwind.config.js:4-26` — v4 ignores the legacy `safelist` key entirely. The CMS-driven classes (`bg-red`, `bg-gray`, `text-dark`… used via `bg-{slice.primary.background}` with zero literal occurrences in src) are in the built CSS **only because the oxide scanner happens to tokenize tailwind.config.js itself**. Deleting the "unused" block or moving the file kills editor-chosen backgrounds silently.
**Fix:** `@source inline("bg-{red,gray,white,paper,paper-red} text-{dark,white,red}")` in app.css, then delete the dead key.

### MED-6 — app.css: two unlayered element rules (the documented repo landmine, in-repo again)

`src/app.css:200` unlayered `button { cursor: pointer }` (duplicate of the `@layer base` copy at `:119` — beats every `cursor-*` utility); `:290` unlayered `::placeholder` with `!important` (unbeatable); `:294` `input[type="textarea"]` is dead CSS.
**Fix:** delete `:200` and `:294`; move `::placeholder` into `@layer base`, drop `!important`.

### MED-7 — CSP is still Report-Only, two weeks past its own promotion window

`netlify.toml:22-44` — the comment commits to enforcing "when the console is clean for a week"; shipped ~07-02. Report-only blocks nothing.
**Fix:** check the report console; rename the header. (Rest of the header set is solid.)

### MED-8 — Contact form cluster: unvalidated server input + placeholder-only labels + `type="phone"`

- `contact/+page.server.ts:65-84`: no presence/length validation — an empty direct POST returns `{success:true}`; megabyte payloads forwarded to ingest. Fix: require email+message, cap lengths, `fail(400)`.
- `contact/+page.svelte:116-149`: fields are named by adjacent `<p>` + placeholder only — no `<label for>`/`aria-label` (the only real `<label>` is the honeypot's). Carried from 06-05; the form rework never picked it up.
- `:137` `type="phone"` is invalid (no tel keypad on mobile) → `type="tel"`.

### MED-9 — Reduced-motion WCAG 2.2.2 cluster — **third consecutive brief**

Unchanged since 06-05, re-verified tonight (zero `matchMedia`/`motion-reduce` hits): autoplay `?background=1` Vimeo in `ScreenWidthImage.svelte:113`, `ScreenWidthMedia/index.svelte:45`, `ContentWidthMedia/index.svelte` (video branches), `ScreenWidthColumns/index.svelte`; plus `LogoSoup.svelte` scroll-scrub (also still unthrottled `getBoundingClientRect` per scroll tick, `:34,71,87-88` — and tonight's addition: its mobile dot nav is off by one, `:337` passes `i + 1`). The in-repo pattern to copy exists (`RevogenHero/VimeoBanner.svelte`). Un-sampled by any gate — this only gets fixed deliberately.

### MED-10 — Unguarded top-level loads: home/about/portfolio 500 on any Prismic hiccup

`+page.server.ts:9-13` (three bare awaits), `about/+page.server.ts:8`, `portfolio/+page.server.ts:9` — no try/catch anywhere; the detail routes guard, the money pages don't. Carried from 06-05 (flagged "not re-verified" on 07-01 — verified open tonight.)

### MED-11 — portfolio-search smoke flake (the one red test tonight)

`tests/smoke/portfolio-search.spec.ts:45` failed 43===43 in the full parallel run, passed 8/8 isolated. Mechanism: fixed 700ms settle vs 250ms debounce + 900–1550ms FLIP under 7-worker + background-gate CPU contention; per project memory, Playwright's `reducedMotion` emulation doesn't reach `matchMedia`-gated JS animation. With HIGH-1 fixed this lands in CI _with retries:2_, but fix it properly: `expect.poll(archiveCount)`.

### MED-12 — README is still 100% starter boilerplate

"Reddoor Wireframer and Site Scaffold… forkable starting point", a `//TODO: mirror prismic docs`, a stale "Bugs" note — nothing about the real stack, scripts, gates, or repo names. Upgraded from 07-01's LOW: it actively misleads onboarding now that the repo has real operational surface (scripts/, gates, fleet CI).

### MED-13 — Featured-rebuild spec drift, flagged 07-01, still unfixed

`docs/superpowers/specs/2026-06-30-portfolio-featured-rebuild-design.md` — zero mentions of `VimeoBanner`/`RevogenBanner` vs `portfolio/+page.svelte:553,580` using both. Append the Revision block.

### MED-14 — Padding scripts are a loaded footgun post-migration

`scripts/padding-restore.mjs` requires a gitignored snapshot no clone has; re-run today it would flatten asymmetric padding via `SLICE_DEFAULTS` (`:70-82`), no dry-run mode. The migration they served is long done.
**Fix:** delete both scripts (git history preserves them), drop `.gitignore:16`.

### MED-15 — Two abstractions are past the 4-copy threshold

- 9/9 slices open with the byte-identical hide-guard + `data-slice-*` shell → extract `<SliceSection {slice}>`.
- 4 slices carry the identical legacy `hasPadding` fallback `$derived` block (`ContentWidthMedia:27`, `RichText:13`, `ScreenWidthColumns:15`, `ScreenWidthMedia:14`) → extract `resolvePadding(primary)`.
  Do them together; the wrapper naturally hosts the padding props.

---

## Findings — LOW

- **LOW-1** `pnpm audit`: 1 moderate — `file-type <21.3.1` via slice-machine (dev-only; Dependabot auto-dismissed it). Same override idiom as #95 clears it if you want a clean zero: `file-type@<21.3.1: ">=21.3.1"`.
- **LOW-2** `[uid]/+page.server.ts:30-37` prerenders `/home` as a duplicate of `/` (SEO dup; sitemap correctly excludes it). Filter `uid !== "home"`.
- **LOW-3** `sitemap.xml/+server.ts:14` includes projects tagged `hide` — every listing surface filters them; the sitemap advertises them to crawlers.
- **LOW-4** `+layout.svelte:114` `{page.data.title ?? "Reddoor"}` — `""` from an empty CMS title passes `??` → empty `<title>`. Use `||`.
- **LOW-5** `portfolio/[uid]/+page.server.ts:31-33` — a `hide`-tagged detail page computes `findIndex` −1 → wrong `prevProject` (`allProjects[0]`). No crash; wrong nav.
- **LOW-6** Homepage load (`+page.server.ts:9`) omits `fetchLinks: ["gallery.images"]` that every other SliceZone route passes — a gallery slideshow authored on the homepage silently degrades to a plain image. _(Today-relevant: this is the #92 feature.)_
- **LOW-7** `RevogenHero/VimeoBanner.svelte:90` — `new URL(e.origin)` throws on sandboxed-frame `origin:"null"`, and the regex also matches `notplayer.vimeo.com`; `:76` effect doesn't re-run when `iframeEl` binds (first `load` listener can attach to undefined). Exact-match `e.origin !== "https://player.vimeo.com"` + add `iframeEl` to the guard. (Carried 07-01 LOW-1/2.)
- **LOW-8** Shared `Slideshow.svelte:41` computes `100 / tripled.length` → `Infinity` on zero slides; the Slideshow slice (`index.svelte`) passes `slice.primary.images` unguarded. Empty slice → broken-empty section, not a crash (07-01's MED-6, downgraded after re-verification against the rewritten component; `ContentWidthMedia`'s gallery path already guards). Also: `goToSlide` skips `isTransitioning`, so dot-clicks snap.
- **LOW-9** `@reddoorla/maintenance` is a prod `dependency` but only pulls dev/build tooling (carried 07-01 LOW-5).
- **LOW-10** Entry generators map `{ uid }` without filtering null uids (`showcase/[uid]`, `[uid]`, `portfolio/[uid]/+page.server.ts:186` region) — carried 07-01 LOW-6.
- **LOW-11** `src/lib/assets/images/` is still 69 MB tracked (16 MB `1800dentist.png`, 11 MB `roadmap.png`…) — carried 07-01 LOW-7.
- **LOW-12** `netlify.toml:4` declares a `functions/` dir that doesn't exist (carried N-4); `svelte.config.js:8` `handleHttpError: "warn"` lets broken internal links prerender green — consider `"fail"`.
- **LOW-13** Workflow action pins have drifted (checkout v6 in renovate.yml vs v4 in lighthouse.yml) — converge via Renovate coverage of workflow pins.
- **LOW-14** `migrate.mjs:122` prints raw `e.message` from the Prismic client — some error shapes embed the request URL with `?access_token=`; wrap with a redactor. (No token bytes are printed anywhere today — verified.)
- **LOW-15** `ScreenWidthImage.svelte:40-121` — the `onerror` video fallback is unreachable on cross-origin iframes; `utils/vimeo.ts` `checkVimeoVideo` oEmbed probe remains unwired (carried 07-01 LOW-4; pairs with MED-4).

---

## Open loops carried forward (graded)

**Closed since 07-01** ✅: LOW-8 stale branches — closed _emphatically_ today (local 37→2, origin 49→2, all evidence-verified; `video-handling`, a three-brief resident, is gone). Dependabot uuid/cookie alerts — closed by #95. `@lhci/cli` orphan, fuzzy-search spec — stayed closed.

**Still open, regraded tonight:** Revogen 4-theme animation (07-01 MED-1 → still animating all four stacks, `RevogenGraftsHero.svelte:75-77` unconditional, only the global off-screen pause exists); spec drift (MED-2 → MED-13); reduced-motion cluster (MED-3/4 → MED-9, **third brief**); twenty-for-twenty headings (MED-5 → absorbed into HIGH-3's page rework — fix headings while you're in there: `:161,178,253` triple `<h1>`); Slideshow ÷0 (MED-6 → LOW-8, downgraded post-rewrite); VimeoBanner LOW-1/2 (→ LOW-7); ScreenWidthImage fallback (LOW-4 → LOW-15); maintenance dep (LOW-5 → LOW-9); uid:null entries (LOW-6 → LOW-10); 69 MB images (LOW-7 → LOW-11); README (LOW-9 → MED-12, upgraded); netlify functions line (N-4 → LOW-12). 06-05 "not re-verified" items both confirmed open tonight: contact labels (→ MED-8), unguarded loads (→ MED-10).

**Intentionally not addressed tonight:** starter-repo divergence of the shared slices (ContentWidthMedia is documented as site-local legacy; a fleet-consistency audit is a different evening); the Prismic model↔content coupling question (what breaks if a slice model field is renamed with 16 live docs — worth a design note, not a bug tonight).

---

## Decisions deferred

1. **CSP promotion (MED-7):** needs your eyes on the violation reports before flipping to enforcing — I can't see the report sink.
2. **twenty-for-twenty's future:** carried from 07-01, still unanswered — is the page live/linked? If it's retired, HIGH-3 + the heading fix become "delete the route" instead. My provisional call: fix the crash paths regardless (cheap), decide the page's fate separately.
3. **Smoke-in-CI runtime cost (HIGH-1 fix):** wiring `test:smoke` adds ~1–2 min/PR. My call: worth it — that's the suite that catches hydration/behavior regressions the axe scan can't. If you disagree, wire `test:unit` only (still closes half the gap).
4. **file-type override (LOW-1):** Dependabot auto-dismissed it; pinning anyway is 2 lines for a clean-zero audit. Cosmetic — your call.

---

## What I did NOT do tonight

Read-only exercise: **no commits, no pushes, no PRs, no Prismic writes, no Netlify changes, no branch operations, no fixes** — even the one-liners. The only writes: this brief and the pre-approved `gh` read-only additions to `.claude/settings.local.json` (Phase-1, before you left). Local gates ran (tests/lint/check/audit — no shared-state mutation; the smoke run left an empty `test-results/` dir, gitignored). Working tree is clean at `a5fbc8b`.

---

## One thing you couldn't have gotten from today's diff

Three, tonight:

1. **Your test suites have never run in CI.** Not "since recently" — never. The fleet workflow's conditional test step has skipped this repo on every single run because nobody added a `test` script. Every smoke spec written since June — including the accordion coverage shipped with #93 _today_ — has only ever run on a laptop. One line fixes it.
2. **Editor-side landmines on the two biggest pages.** A content editor duplicating a logo row in Prismic takes down home and /about at hydration — no deploy, no code change, no CI signal (especially given #1). The same `each_key_duplicate` class we caught in review for #93's slices has been sitting in LogoSoup and twenty-for-twenty all along.
3. **The CMS color system survives by a scanner accident.** Tailwind v4 ignores the `safelist` key entirely; `bg-red`/`bg-gray`/`text-dark` exist in the built CSS only because the scanner tokenizes the dead config file itself. The next innocent cleanup of "unused config" silently breaks editor-selected backgrounds fleet-starter-style — with zero test or gate coverage to catch it (see #1).
