# Morning brief — 2026-06-05

_Evening review run 2026-06-04. Scope: whole repo. Severity: everything incl. LOW. Read-only — nothing was changed except writing this brief and refreshing project memory._

Local gates are all green on `main`: `pnpm check` → **0 errors / 0 warnings**, `pnpm build` → clean prerender, `pnpm lint` (prettier + eslint) → **clean**. The canonical-tooling onboarding (PR #6) genuinely landed — the old "prettier fails on 94 files" pain from the migration is gone. So the repo is in a shippable state; the findings below are about resilience, security, and a11y/SEO correctness, not broken builds.

This was a deep pass: 4 parallel reviewers (state/effects, Prismic/routes, a11y/SEO, config/security) + manual verification of every CRITICAL/HIGH against current code. Findings that two reviewers independently flagged are marked **[2×]** — those are the safest bets.

---

## Top of stack (do this first)

Three high-leverage moves, ~30 min each, that clear the most risk per minute:

1. **Fix the OG image one-liner** — `src/routes/+layout.svelte:104`. Social/link previews are broken on _every_ page right now (see HIGH-1). Literally `meta_image.url` → `meta_image`. Verify one unfurl after.
2. **Bump `@sveltejs/kit` + `svelte` and re-resolve the lockfile** — clears 1 high + several moderate CVEs in one shot (HIGH-4). `@sveltejs/kit >=2.60.1`, `svelte >=5.55.7`. Then `pnpm audit --prod` to confirm.
3. **Rotate the Prismic write token** — the migration that needed it is done; a long-lived write credential shouldn't keep sitting in `.env.local` (HIGH-5). It is _not_ leaked (gitignored, never committed) — this is hygiene, not an incident.

---

## Findings — CRITICAL

**None.** No active security incident, no committed secret, no data-loss bug, no broken build. (Stating this plainly rather than inflating a HIGH — the repo is genuinely in good shape.)

---

## Findings — HIGH

### HIGH-1 — OG/Twitter image is broken on every page **[2×]**

`src/routes/+layout.svelte:104` renders `<meta name="og:image" content={page.data.meta_image.url} />`, but **every** load function already resolves `meta_image` to a _string_, not an ImageField:

- `+page.server.ts:22` and `[uid]/+page.server.ts:24` → `page.data.meta_image.url` (string)
- about / contact / portfolio / twenty-for-twenty → an imported asset (string)
- `portfolio/[uid]:169`, `showcase/[uid]:41` → `…url || …` (string)

So `meta_image.url` is `.url` on a string → `undefined`. The `{#if page.data.meta_image}` guard passes (truthy string), so the tag emits empty. **No page has a working OG image**, and `twitter:card="summary_large_image"` ships with no image.
**Why it matters:** every shared link (social, Slack, iMessage) unfurls with no image. Pure SEO/brand loss on a marketing site.
**Fix:** `content={page.data.meta_image}` (it's already the URL). Also make it absolute — OG requires absolute URLs; the imported-asset paths are root-relative. Consider prefixing the site origin.

### HIGH-2 — Contact form: Turnstile is decorative; submission path needs a deploy-preview check **[2×]**

`src/routes/[[preview=preview]]/contact/+page.svelte:110` renders `<Turnstile siteKey="0x4AAAAAAAh2fGW6xIcdsqNr" />` (public sitekey — correct, no secret in client). But there is **no server-side `siteverify` anywhere** in the repo — `contact/+page.server.ts` has only a `load`, no `actions`; no `hooks.server.ts`; the `functions/` dir declared in `netlify.toml` is empty. The token is generated and never validated.
The form _does_ have the Netlify Forms wiring (`data-netlify="true"`, `form-name=contact` hidden input, `bot-field` honeypot, `+page.svelte:107-154`), and the page prerenders, so Netlify _should_ detect and capture submissions — but the client intercepts submit with `preventDefault()` + `fetch("/contact", urlencoded)`, and Netlify-Forms-through-an-SSR-adapter is a fragile combination.
**Why it matters:** this is the site's only lead-capture path. Spam protection today is effectively just the honeypot — Turnstile adds a false sense of security. And if Netlify doesn't register the form, inbound contacts vanish silently (user sees the generic error).
**Fix:** (a) **Verify end-to-end in a Netlify deploy preview** — submit the form, confirm it lands in the Netlify Forms dashboard. (b) Either drop Turnstile (don't ship security theater) or wire real verification: a SvelteKit `actions.default` (or Netlify Function) that POSTs `cf-turnstile-response` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with a server-only `TURNSTILE_SECRET` (`$env/static/private`) before accepting the message.

### HIGH-3 — Project detail page can 500 / fail the build on a mis-tagged "related project" override

`src/routes/[[preview=preview]]/portfolio/[uid]/+page.server.ts:37-58` resolves overrides with `allProjects[allProjects.findIndex(... === override.uid)]`. If an editor points `relatedprojectoverride1/2` at a project that's filtered out (e.g. tagged `hide`) or deleted, `findIndex` returns `-1`, `allProjects[-1]` is `undefined`, and `relatedProjectOne`/`Two` becomes `undefined` while `isOneSet`/`isTwoSet` stays `true`.
The template (`+page.svelte:81-130`) has **no `{#if data.relatedProjectOne}` guard** — it does `data.relatedProjectOne.data.hero.url`. `.url` is `|| ""`-guarded but `.data` is not, so `undefined.data` throws during SSR. Same exposure if the portfolio has 0–1 visible projects (`mostRelatedProject = allProjects[0]` → `undefined`).
**Why it matters:** these pages prerender at build time, so bad CMS data doesn't just 500 a live page — it can **fail the production build** (a load/render throw during prerender isn't covered by `handleHttpError:'warn'`, which only catches fetched-link HTTP errors). Latent until an editor creates the data, then the next deploy breaks.
**Fix:** after resolving each override, guard against `undefined`/`-1` (fall back to prev/next or skip); wrap the template blocks in `{#if data.relatedProjectOne}` / `{#if data.relatedProjectTwo}`.

### HIGH-4 — Production dependency CVEs (one high, several moderate)

From `pnpm audit` (full tree: 4 high / 11 moderate / 3 low — most highs are dev-only via `@lhci/cli`, but these ship):

- **`devalue` GHSA-9rmh-mm8f-r9h6 (high, DoS)** — transitive via `@sveltejs/kit`; installed range vulnerable, patched `5.8.1`.
- **`svelte` 5.55.4 → SSR XSS ×3 + ReDoS (moderate)** — patched `5.55.7`. This is an SSR/prerender site rendering Prismic rich text, so the surface is real. `svelte` is pinned `"^5"`, so a plain reinstall won't move it — the lockfile holds 5.55.4; re-resolve it.
- **`@sveltejs/kit` 2.57.1 → batched-query cross-talk GHSA-hgv7-v322-mmgr (moderate)** + **`cookie` <0.7.0 (low)** — both cleared by the kit bump.
  **Fix:** `@sveltejs/kit >=2.60.1`, `svelte >=5.55.7`; re-resolve `pnpm-lock.yaml`; re-run `pnpm audit --prod`. **Also add `pnpm audit --prod --audit-level high` as a CI gate** — none exists today, which is why these accumulated silently.

### HIGH-5 — Live Prismic write token sitting in `.env.local`

`/.env.local:1` holds a live `PRISMIC_WRITE_TOKEN` JWT (machine2machine, domain `reddoor-la`). **Correctly gitignored (`.gitignore:11`) and confirmed never committed** (`git log --all`), so not leaked — but it's a long-lived _write_-capable prod credential left over from a one-shot migration (`scripts/padding-restore.mjs`).
**Fix:** revoke/rotate it in Prismic (Settings → API & Security → Write APIs) now the migration is done; regenerate only when next needed.

---

## Findings — MEDIUM

### MED-1 — Duplicate `<title>` on every content page **[2×]**

`+layout.svelte:96` emits `<title>{page.data.title ?? "Reddoor"}</title>`, and each page _also_ emits its own `<title>` (home `+page.svelte:16`, portfolio `:125`, about `:186`, contact, twenty, showcase, all `+error.svelte`). Two `<title>` tags per page — invalid HTML, "last wins", and the two sources often disagree (layout uses Prismic `page.data.title`; pages hardcode e.g. `"Reddoor Creative | Home"`). The recent "title fallback" commit added the layout one without removing the page-level ones.
**Fix:** pick one source. Either drive all titles through the layout and delete per-page `<title>`, or drop the layout one.

### MED-2 — `LandscapeModal.svelte:12` — unguarded `screen.orientation.type` can tear down the effect scheduler

`screen.orientation` is `undefined` on some iOS Safari versions; `screen.orientation.type` then throws _inside an `$effect`_. An uncaught throw in an effect is the same blast-radius class as the `x = f(x)` self-write bug from the migration (kills pending effects). This component runs specifically on mobile Safari — exactly where the API is flakiest.
**Fix:** `screen.orientation ? screen.orientation.type !== "portrait-primary" : window.innerWidth > window.innerHeight` — or drop the `screen.orientation` branch entirely since `isLandscape` already covers it.

### MED-3 — `Slideshow/index.svelte` divides by zero on an empty slice

`:14,22` — if a Slideshow slice is published with zero images, `slideWidth = 100 / 0 = Infinity`, transforms go `NaN`, and the autoplay `$effect` (`:91`) keeps mutating `currentIndex` into `NaN` every 5s. One mis-authored slice → visibly broken section.
**Fix:** early-return the markup / guard `startAutoPlay` + `moveSlide` with `if (!mediaArray.length) return;`.

### MED-4 — `LogoSoup.svelte` scroll handler: unthrottled layout reads + no reduced-motion guard

The mobile scroll-scrub runs through an `$effect` that re-fires on every `scrollY` tick and calls `getBoundingClientRect()` + `offsetHeight` (`:34-35,69-71`) with **no rAF coalescing** (unlike `OpeningAnimation`, which does it right). On a tall mobile spacer this is layout thrash on the hot path. It's also the **only** animated component with **no `prefers-reduced-motion` guard** (OpeningAnimation + `animateIn` both honor it).
**Fix:** route through a single-in-flight rAF like `OpeningAnimation.handleScroll`; cache `offsetHeight`; gate the scroll-scrub on reduced-motion.

### MED-5 — No security headers served

`netlify.toml` has no `[[headers]]`; the generated `build/_headers` only sets cache-control on immutable assets. No CSP, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS anywhere.
**Fix:** add `static/_headers` (copied verbatim into the build) or a `netlify.toml [[headers]]` block with at least `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`.

### MED-6 — Contact form inputs have no programmatic labels (WCAG 1.3.1 / 4.1.2 / 3.3.2)

`contact/+page.svelte:74-165` — every field uses a sibling `<p>Name</p>` + `placeholder` as its visual label; none use `<label for>`/`id`. Screen readers announce these as unlabeled (placeholder ≠ accessible name, and it vanishes on input). Ironically the honeypot is the only properly-wrapped label. This is the primary conversion path.
**Fix:** convert each `<p>` to `<label for="…">` with a matching `id` on the input (or wrap the input).

### MED-7 — Heading structure: multiple `<h1>` per page, headings used for sizing

- `OpeningAnimation.svelte` renders several `<h1>`s (duplicated across hidden/visible animation layers; some `role="presentation"` on an `<h1>`, which is contradictory).
- `twenty-for-twenty/+page.svelte` has `<h1>20</h1>` plus an `<h1>` per card rendering just the number ("01", "02"…) → ~20+ h1s; numbers pollute the document outline.
- `about/+page.svelte` picks heading levels by size (`<h5>` lead, `<h2>` with no preceding visible h1).
  **Why it matters:** screen-reader users navigate by headings; numeric/duplicate h1s make the outline meaningless (WCAG 1.3.1).
  **Fix:** one `<h1>` per page; convert decorative big-type ("20", card numbers) to styled `<span>`/`<p>` with `aria-hidden`; reserve heading levels for real hierarchy.

### MED-8 — No skip link + no focus management on overlays (WCAG 2.4.1 / 2.4.3 / 2.1.2)

- **No "skip to content" link** anywhere — keyboard users tab through the full nav (and the focus-heavy hero) on every page.
- The mobile menu overlay (`+layout.svelte:118`), the OpeningAnimation menu (`:140`), and the about-page popup (`about:223`, which _claims_ `aria-modal="true"`) all open without moving focus in, trapping Tab, closing on Escape, or restoring focus to the trigger. `LandscapeModal` is a full-screen blocker with no role and no dismiss.
  **Fix:** add a visually-hidden-until-focus `<a href="#main">` as the first body child + `id="main"` on `<main>`; on overlay open, move focus in, trap Tab, close on Escape, restore focus on close.

### MED-9 — `DefaultButton.svelte:53-69` renders `<a><button>…</button></a>` (nested interactives)

The `href` branch nests a `<button>` inside an `<a>` — invalid HTML, double tab stop, inconsistent AT semantics. This is the site's primary CTA, used widely.
**Fix:** render a single `<a>` styled as a button for the link branch (one `<button>` for the click branch).

### MED-10 — Autoplay Vimeo backgrounds + page transitions ignore reduced motion (WCAG 2.2.2)

`twenty-for-twenty/+page.svelte:181` and `ScreenWidthImage.svelte` autoplay Vimeo backgrounds regardless of `prefers-reduced-motion`; the layout page-transition `fade`/`fly` (`+layout.svelte`) and nav fly also don't check it. (Good news: `OpeningAnimation` and `animateIn.ts` _do_ honor it.)
**Fix:** gate autoplay + layout/nav transitions behind a reduced-motion check.

### MED-11 — `entries()` / EntryGenerators can emit `{ uid: null }`

`[uid]/+page.server.ts:32`, `project/[uid]:182`, `showcase/[uid]:49` map `page.uid` (Prismic `uid` is `string | null`) without filtering. A UID-less doc yields a bad prerender entry. (The sitemap correctly filters `doc.uid`; the entry generators don't.)
**Fix:** `.filter((p) => p.uid).map(...)`.

### MED-12 — Top-level loads have no try/catch (home/about/portfolio/twenty)

The detail routes (`[uid]`, `project/[uid]`, `showcase/[uid]`) correctly try/catch → `error(404)`. But `/` (`getByUID("page","home")` + `getSingle("logo_soup")` + `getSingle("opening_animation")`), about, portfolio, and twenty call Prismic bare. A missing singleton or API hiccup → raw 500. Note `+page.svelte:18` does `data.openingAnimation.data.slides` — if that singleton is ever unpublished, `.data` throws (the empty-slides case is handled, but a _null document_ isn't).
**Fix:** wrap singleton/getByUID calls; `error(404)` on missing doc; make the homepage resilient to a missing `opening_animation`.

---

## Findings — LOW

- **LOW-1 — `/dev/a11y-fixtures` ships to production** `[2×]`. `src/routes/dev/a11y-fixtures/+page.svelte` prerenders (`prerender="auto"`) and is publicly reachable; not in robots.txt or sitemap, but crawlable. Add `<meta name="robots" content="noindex">` and/or `Disallow: /dev/`, or gate with `if (!dev) error(404)`.
- **LOW-2 — No canonical URLs anywhere.** With the `[[preview=preview]]` optional param, content is reachable at multiple paths. Add `<link rel="canonical" href={page.url…}>` in the layout.
- **LOW-3 — OG/Twitter tags incomplete + nonstandard.** `og:title` uses `name=` instead of `property=` (`+layout.svelte:101`); missing `og:type`, `og:url`, `og:description`, `og:site_name`, `twitter:title/description`. JSON-LD Organization has no `logo`.
- **LOW-4 — Decorative images given meaningful alt.** `about` (`alt="keys"`, `"beach"`, `"moving car"`), home (`alt="megaphone"`, `"pencil"`) are decorative flourishes → should be `alt=""`. Conversely, audit Prismic alt fields for _meaningful_ images (LogoSoup brand logos, project heroes) — unset alts silently become `alt=""`.
- **LOW-5 — Hero caption contrast.** White project-name/services captions over rotating photos with only `bg-black opacity-25` scrim (`OpeningAnimation` ~line 230) likely miss 4.5:1 on bright slides (WCAG 1.4.3). The portfolio detail page uses a stronger 0.42→0.86 gradient — match it.
- **LOW-6 — Hero scroll button may cover the slide caption link.** The full-bleed `inset-0` "Scroll to continue" `<button>` sits above the `pointer-events-auto` project-link caption in the hero; verify the caption link is actually clickable by mouse.
- **LOW-7 — `app.html` sloppiness.** Duplicate `style` attribute on the body wrapper div (second is ignored, so `display:contents` may not apply); also a viewport meta in `app.html` _and_ re-emitted in the layout (duplicate, last-wins).
- **LOW-8 — `showcase/[uid]/+page.svelte:38` `data.title.slice(0, -18)`** to strip `" | Reddoor Creative"` is brittle — breaks silently if the suffix length changes. Pass the raw title from the load instead (as the project page does).
- **LOW-9 — `ScreenWidthImage.svelte:86` `onerror` on a cross-origin iframe is dead code** — a Vimeo 404/privacy-block loads the iframe document fine (no element `error` event), so the `showVideo=false` fallback never fires. `utils/vimeo.ts` has a real `checkVimeoVideo` oEmbed probe that isn't wired in. Either drop the cosmetic machinery or gate the iframe on the probe.
- **LOW-10 — `Slideshow` `moveSlide` setTimeout never cleared on unmount** (`:39-57`). Benign in Svelte 5 (writes to orphaned `$state` are tolerated) but it's an untracked timer; clear it in the existing effect cleanup.
- **LOW-11 — Dev-only dep CVEs** (`@lhci/cli` chain: `uuid`, `qs`, `tmp`, `inquirer/external-editor`). Don't ship to prod; clear opportunistically with a `pnpm update`.
- **LOW-12 — Duplicate sharp libvips binaries** locally (`@img+sharp-libvips-darwin-arm64@1.0.4` and `@1.2.4`); build warns "may cause spurious crashes." Local macOS only (Netlify build is Linux). A clean `pnpm install`/dedupe fixes it.
- **LOW-13 — Large tracked source images** — `src/lib/assets/images/1800dentist.png` (16 MB), `roadmap.png` (11 MB), `stJames.jpg` (7 MB). Repo bloat; optimize or move to Prismic/CDN. Not a regression.
- **LOW-14 — Centralize the site origin.** `reddoorla.com` is hardcoded across `+layout.svelte`, `sitemap.xml`, and several loads; the repo name lives in `slicemachine.config.json` as `reddoor-la`. Consider one constant.
- **LOW-15 — `index`-keyed `{#each}` in `OpeningAnimation.svelte:223`** (`(index)`). Static slides so low-risk today, but the opacity cross-fade + `{#key safeIndex}` depend on stable identity if slides are ever reordered. Key by `slide.project_name ?? index`, matching LogoSoup.

---

## Open loops carried forward

- **CI doesn't run `pnpm audit`, Lighthouse, or anything beyond a11y.** `lighthouserc.json` is present but never invoked by a workflow; CI runs prettier/eslint/check/build/playwright + `reddoor-maint audit --only a11y`. Adding a `pnpm audit --prod --audit-level high` gate (HIGH-4) and an lhci run would close the loop so dep CVEs and perf regressions surface on PRs instead of in evening reviews.
- **`renovate.yml` references `secrets.RENOVATE_TOKEN`** — confirm that secret exists in repo settings, else the scheduled Renovate run silently no-ops.
- **Stale branch `video-handling`** is 1 commit ahead of main ("show video by default", Sep 2025) but 120 behind, and that commit edits a Svelte-4-era `ScreenWidthImage.svelte` (`$:` reactive syntax, `NodeJS.Timeout`) that no longer resembles `main`. It's almost certainly abandoned — recommend deleting it (local + `origin/video-handling`) to stop it showing up in archaeology. The other unmerged branches (`nav-on-open`, `opening-anim`, `staging`, `svelte-5`) are all fully merged (0 ahead) and safe to prune too.
- **Two completed plan docs are unarchived** in `docs/superpowers/plans/` — both `2026-05-21-opening-animation-prismic-slides.md` and the twenty-for-twenty anchor-links plan **shipped** (verified: `opening_animation` + `twenty_for_twenty` custom types exist, `openingBgs` assets deleted, `PrismicImage` wired, the implementation even improved on the plan with a `safeIndex` out-of-range guard). Consider moving them to a `done/` subfolder so future reviews don't re-investigate them.

## Decisions deferred

- **Turnstile: fix or remove? (HIGH-2)** I can't run a Netlify deploy preview from here, so I can't confirm whether form submissions actually land. Provisional call: **verify the submission path first** (deploy preview → submit → check Netlify Forms dashboard); _then_ decide. If you want real bot protection, wire server-side `siteverify`; if the honeypot is deemed enough, remove Turnstile so it isn't security theater. Needs your read on how much spam the form actually gets.
- **OG image absolute-URL strategy (HIGH-1).** The one-line `.url` fix makes the tag non-empty, but imported-asset paths are root-relative and OG wants absolute. Whether to prefix the origin for asset-based pages vs. only fixing Prismic-image pages is a small product call — I left it as a note rather than guessing.

## What I did NOT do tonight

Read-only review. **No commits, no PRs, no pushes, no Prismic/Netlify writes, no dependency changes, no branch deletions.** The only writes were this brief (`docs/morning-reports/MORNING_REPORT_2026-06-05.md`) and a refresh of two stale entries in my own project-memory (the migration is done; `pnpm lint` now passes — the old memory said it failed on 94 files). The repo working tree is unchanged and clean. The session allowlist I added to `.claude/settings.local.json` is read-only commands + the morning-report write path; prune it whenever you like.

---

### One thing you couldn't have gotten from today's diff

The **related-projects crash (HIGH-3)** and the **`og:image` bug (HIGH-1)** are both latent — they don't show in any recent commit and the build is green. HIGH-3 in particular is a build-breaker waiting on a single editor action (point a "related project" override at a hidden project), and `handleHttpError:'warn'` won't save you because it's a render throw, not a fetched-link error. Worth a guard before it bites mid-deploy.
