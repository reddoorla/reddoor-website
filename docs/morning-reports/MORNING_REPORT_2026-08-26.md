# Morning brief — 2026-08-26

> Written Tuesday evening 2026-08-25 via the `evening-review` skill, for your Wednesday read.
> **Scope:** both repos (`reddoor-website` + `reddoor-maintenance`), prospect-audit system first — it now spans both as one system.
> **Threshold:** LOW and above, as requested.
> **Your targets:** the analyze-stage drift, the logic of the output, and whether AI Visibility will ever be non-zero for a site we'd work with. All three are answered. The drift turned out to be a correctness bug rather than variance, and the zero has a structural cause that is fixable in one prompt.
> **Read-only.** No commits, pushes, PRs, or live-service writes.
> **Method:** git archaeology (14 days, both repos) + graded the 07-16 and 07-06 briefs' open loops + three review subagents (all returned) + local gates + empirical comparison of the three completed audit runs pulled from the live API.
> **Verification:** every finding below was re-checked by me against source, by executing the logic, or against run history — nothing is reported on a subagent's word alone. Three things changed as a result: a leak filed HIGH on the code was **downgraded to MEDIUM on evidence** (MED-10 — the workflow has run once and published nothing), a carousel failure was **confirmed and promoted** (HIGH-8), and one of my own reads was **wrong and corrected** (I called the SSR security headers missing; they are present, verified on the live routes).
> **Local gates:** website `vitest` 278 pass / 31 files ✓, `svelte-check` 0 errors ✓, `pnpm audit --prod` clean ✓. maintenance `vitest` 5319 pass / 434 files ✓, `tsc` ✓, `pnpm audit --prod` **1 high** (MED-6).

> ### ⚠ There are TWO briefs dated 2026-08-26 — read this one second
>
> A concurrent session wrote **`reddoor-maintenance/docs/morning-reports/MORNING_REPORT_2026-08-26.md`** at 20:31 tonight (332 lines). I found it near the end of this run. They overlap very little, so keep both:
>
> |                 | that brief                                                                                                                  | this brief                                                                   |
> | --------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
> | **Covers**      | the ops repo: backup/rollback, the freeze's data-safety story, query plans, console JS                                      | the audit **product**: scoring logic, the report output, the cross-repo seam |
> | **Its CRIT-1**  | the backup verifier compares the dump against _itself_, and the freeze makes that dump the only rollback                    | —                                                                            |
> | **Its HIGH-1**  | **a proven SSRF in the prospect crawler's sitemap handling** (`crawl.ts:350-354`) — reaches `169.254.169.254`, one-line fix | —                                                                            |
> | **My CRIT-1/2** | —                                                                                                                           | the token reaching Google; verdicts contradicting their own evidence         |
>
> **Its HIGH-1 is in my scope and my agents missed it** — they reviewed the seam and the scorer, not the crawler. Treat it as belonging to this brief's subject even though it's written up in that one. Combined, the first three things to do tomorrow are: **my CRIT-1** (token → Google), **its HIGH-1** (SSRF, one line), **its top-of-stack 1** (don't flip `TURSO_IS_AUTHORITATIVE` yet).

## One-line verdict

Three things must land before another audit goes to a prospect. **(1)** Every view of a report hands its _only credential_ to Google Analytics — the token is in the URL path, gtag reads `location.href`, and the codebase has written doctrine against exactly this that the new route alone doesn't follow. **(2)** The audit's verdicts can contradict their own evidence: run 3 graded pricing **PARTIAL** while recording `evidence: null`, on the same site state run 2 correctly graded **NO** — that accounts for 10 of the 15-point Answers swing you asked about, and puts a self-contradiction inside a document we send out. **(3)** Your zero-score question has an answer: **no, not as built** — but the cause isn't the scorer, it's the prompt that generates the queries, and that's a paragraph to fix.

---

## Top of stack (do these first)

1. **Stop the token reaching Google (~15 min).** CRIT-1. Three-line guard. Do it before anyone opens a report link — a token in a GA4 property is in Google's retention, exportable to BigQuery, readable by everyone with access. Not walk-back-able.

2. **Fix the query generator (~20 min, one paragraph).** HIGH-1. The single change most likely to make AI Visibility a real number instead of a structural zero. Same edit should raise `slice(0, 3)` → `slice(0, 5)` so the queries we already pay for are used.

3. **Merge `reddoor-maintenance#611` to publish 0.88.0 (~5 min).** Six changesets sit merged-and-unpublished, including **`playwright-port-stability`** — the fix that currently blocks _every fleet site_ from taking 0.84+. Until it publishes it helps nobody, and it's what unpins the website from `^0.83.0`.

---

## Findings — CRITICAL

### CRIT-1 · The report token is sent to Google Analytics on every view

`src/app.html:46-77` (website)

gtag loads on **every** page including `/audit/{token}`, deferred until the first pointer/key/scroll — and someone reading a multi-section report scrolls within seconds. `gtag("config", GA_ID, …)` sends `page_location`, read from `location.href`.

**The token is the only credential on that document.** It lands in GA4 property data: readable by anyone with access, exportable to BigQuery, retained on Google's schedule. Anyone in that property can open any prospect's confidential report.

The codebase already wrote the doctrine, and this route is the one place that breaks it. `src/lib/url/stripQueryParams.ts:10-14`: _"anything that later reads `location.href` — gtag.js above all… That ordering is the only thing keeping a lead's address out of analytics."_ Four credential-bearing routes already set `meta_referrer: "no-referrer"` for the same reason (`cancel/[eventId]`, `calendar/[eventId]`, `reschedule/[eventId]`, `meeting-outcome`). `/audit/[token]` does neither.

The path-segment case is **strictly worse** than the query-param case those mitigations were built for: `stripQueryParams` structurally cannot help, because you cannot strip the URL the page _is_.

```js
function loadGA() {
  if (loaded) return;
  // Prospect audit URLs are the credential. Never hand one to analytics.
  if (location.pathname.startsWith("/audit/")) return;   // no `loaded = true`; listeners stay
  …
}
```

Bail inside `loadGA()`, not the IIFE, so analytics resumes if they navigate on to `/contact`. Add `meta_referrer: "no-referrer"` to both audit routes. Verify in a browser — found statically.

### CRIT-2 · A positive verdict can contradict its own evidence, and inflates the score

`src/prospect/analyze.ts` (`verifyEvidence`, ~:283) · `src/prospect/checks.ts:289-294`

**This is the answer to your drift question, and it is not variance.**

Answers is `Σ weight[answered] / count × 100` with `yes=1, partial=0.5, no=0`. Nothing checks a positive verdict is _supported_. `verifyEvidence` validates that evidence, **when present**, is a real verbatim quote — it never checks the inverse.

Pulled from the live API. Same unchanged site, 15 hours apart:

|                                          | run 2 (25 Aug)          | run 3 (26 Aug)               |
| ---------------------------------------- | ----------------------- | ---------------------------- |
| "How much does a branding project cost?" | **NO**, evidence `null` | **PARTIAL**, evidence `null` |
| "How long does a project take?"          | **NO**, evidence `null` | **PARTIAL**, evidence `null` |
| **Answers score**                        | **65**                  | **80**                       |

Run 3 awarded half credit twice for questions it recorded no supporting passage for. **Two ungrounded `partial`s = 1.0 point = 10 of the 15-point jump.**

The same report then prints **three** fixes telling them to publish pricing — while its own table says pricing is partially answered. The document contradicts itself in front of the prospect.

```ts
// A verdict we cannot point at a passage for is not a positive verdict. The score
// weights `partial` at 0.5, so an unsupported one silently adds 5 points per
// question to a number we put in front of the prospect.
if (q.answered !== "no" && q.evidence === null) return { ...q, answered: "no" as const };
```

Some questions may legitimately be answered by page structure rather than a quotable line — if so that needs its own explicit field, not silence.

---

## Findings — HIGH

### HIGH-1 · Your zero-score question: no, not as built — and the cause is the prompt, not the scorer

`src/prospect/analyze.ts:108-115` · `src/prospect/probes.ts:97,237-245`

Two compounding causes.

**(a) The score is 4-valued, not 0–100.** `buildQueries` does `categoryQueries.slice(0, 3)` (`probes.ts:97`) while `AnalyzeSchema` asks the model for **3–5** (`analyze.ts:47`). So up to two queries we pay to generate are silently discarded, the denominator is pinned at 3, and with one engine the only reachable values are **{0, 33, 67, 100}** — one citation moves it 33 points. It sits in the same row, same typography, same weight as three quasi-continuous scores, and nothing discloses the denominator.

**(b) The generator asks for queries the prospect cannot win.** The prompt says: _"3-5 searches a buyer types BEFORE they have heard of this company, **chosen so that this company deserves to appear in the results**"_ — with head-term examples. "Deserves to" is aspirational, and head terms in every service category are dominated by directories and listicles: exactly the pages that _aggregate_ small firms rather than surface their domains. Nothing biases toward the long-tail, niche-service or hyper-local queries where a 5–50 person regional firm actually ranks.

**So the score is 0 by construction, not by measurement.** For it to fire, the prospect would need to already rank top-10 for a generic category+geo term — i.e. already have the visibility the audit exists to sell them.

**Fix:** ask for a spread — one head term, two long-tail/service-specific/geo-qualified — and drop "deserves to appear" for something like "could plausibly rank for". Raise `slice(0, 3)` → `slice(0, 5)` in the same pass; that alone halves the granularity to 20-point steps.

_(This is also why our own site scores 0 on the metric we sell.)_

### HIGH-2 · A whole class of business names silently degrades to the domain — and the report then prints a false claim

`src/prospect/probes.ts:64-70` → `pipeline.ts:123` → `render.ts:330` & `render.ts:157`

`resolveBusinessName`'s `/\.\s/` guard exists to catch a model returning prose. It also catches **any abbreviation followed by a space**. Verified by executing the guard:

```
FELL BACK TO DOMAIN  St. Louis Roofing
FELL BACK TO DOMAIN  Mt. Vernon Dental
FELL BACK TO DOMAIN  Dr. Patel Orthodontics
FELL BACK TO DOMAIN  Smith & Co. Design
kept                 Acme Roofing
```

Every practice fronted by a doctor's name, every business in a `St.`/`Mt.` place name. The consequences chain:

1. Branded probes become `"who is stlouisroofing.com"` — engines answer that poorly, so `brandedRecognized` is depressed mechanically.
2. `mentionsBrand` now matches the domain, not the name, so the brand-mention path dies entirely.
3. **The report prints a falsehood.** `businessNameUsed` (`render.ts:330`) is computed from `result.businessName` — the _un-resolved_ value — so it's truthy, and `render.ts:157` fires: _"…they did not recognize it — a real citation of the site never showed up, **even with the name handed to them**."_ The name was never handed to them; the domain was. The comment above that line even says it gates on what we "actually queried with", which makes this a bug against stated intent rather than a design choice.
4. The prospect can see it: the `<h1>` says "Can AI and Google actually find St. Louis Roofing?" while the receipt cards below show the query as `who is stlouisroofing.com`.

### HIGH-3 · The report says "You were named" for answers that scored zero

`src/prospect/render.ts:173-177`

```ts
a.domainCited || a.brandMentioned ? "You were named in this answer." : "You were not named…";
```

This drops the `nameIsDistinctive` gate the score applies at `probes.ts:240`. So a card reads **"You were named in this answer"** while contributing **0** to the number directly above it — every single-token brand hits this.

Compounding it: `domainCited` is built from `web_search_tool_result` blocks (`probes.ts:348-352`), which are **every result the search tool retrieved**, not the ones the model cited in prose. So "named in this answer" can be true when the answer never mentions them. Two defects in one ternary, and the same mechanism means **"Who the engines cited instead"** (`render.ts:186`) is a retrieved-set dump including directories — and the operator's own CLI-supplied competitors, which are named inside the query and therefore guaranteed to come back as "discovered".

### HIGH-4 · A generic two-word name scores visibility for nothing

`src/prospect/probes.ts:142-144`

`isDistinctiveName` treats any multi-word name as unmistakable. Verified by execution against answers that never reference the business:

```
 33  AI Visibility for a business named "creative studio"   (1/3)
 33  AI Visibility for a business named "the agency"        (1/3)
 33  AI Visibility for a business named "design group"      (1/3)
  0  AI Visibility for a business named "reddoor creative"  (correct)
```

The doc comment above it is right that under-crediting is "the error worth making… 'you were mentioned here' has to survive them reading the snippet underneath it." This path violates its own stated principle — the snippet will show the words used as a common noun.

The mirror also holds. `mentionsBrand` requires an exact adjacent literal, so these all **MISS**: `acme roofing llc` vs "acme roofing" (and the analyze prompt explicitly allows legal suffixes into the name), `smith & jones design` vs "smith and jones design", `red-door creative` vs "red door creative", and any name split across a line break.

### HIGH-4b · The freeze switch does not reach three request-path writers — HIGH today, CRITICAL the moment you flip

`src/db/freeze.ts:49` · `src/db/fleet-state.ts:569-576,615-617` · `report-mirror.ts:64-79` (maintenance)

**Distinct from the other brief's CRIT-1.** That one is about the backup being the only rollback. This is about the switch not covering what you think it covers.

`TURSO_IS_AUTHORITATIVE` is consumed in exactly six places — the four mirror factories plus `write-audits-to-airtable.ts:282` and `forms/site-lookup.ts:32`. **Three request-path writers bypass all of it**, each opening its own db and calling raw `mirrorReportPatch` inside a hand-rolled log-and-swallow: `resend-webhook.mts:174-179` (delivery status), `approve-report.mts:119-126` (approve + override), `report-commentary.mts:66-70`. All carry the comment _"the sync converges it."_ Flipping the switch changes their behaviour by nothing.

The structural half: `mirrorReportPatch` and `storeRenderedHtml` return `Promise<void>`, discarding `numUpdatedRows` — while their Sites-side counterparts (`mirrorSiteFields:286`, `mirrorHealthFields:365`) return `numUpdatedRows > 0n`. So `report-mirror.ts` logs `mirrored=1` on an UPDATE that touched zero rows, where `site-mirror.ts:86-88` throws. The test file shows the asymmetry is unintentional: `freeze-semantics.test.ts:106` has _"a 0-row update REJECTS"_ for `makeSiteMirror`; the `makeReportMirror` block at `:136`, titled **"the same inversion,"** has no equivalent case.

**Why it's survivable today, and stops being so at the flip:** `checkFleetParity` runs inside `syncFleetState` (`sync.ts:31-41`) and `parity.ts:133-146` diffs `reports` row-by-row against Airtable hourly. A swallowed mirror is therefore both _converged_ and _detected_ within the hour. **Stopping the hourly import removes convergence and detection in the same action — they are the same cron.**

After the flip: a client's report hard-bounces → webhook fires → Airtable updates → the Turso write throws or matches zero rows → the log says `mirrored=1` → Turso, now the only store and what the cockpit and digest read, still says `sent`. Nothing converges it, nothing detects it, and the log asserts success.

**~Half a day**: return `numUpdatedRows > 0n` from the two writers and thread `matched`/`missed` through `report-mirror.ts` (~30 lines), route the three functions through `makeReportMirror` (~15 lines each), add the missing test case. **One decision, not code: keep parity running read-only through the one-week rollback window** — otherwise the flip removes your only instrument at the moment you most need it.

### HIGH-5 · The PDF can be a 404 page, emailed to the prospect

`src/prospect/pdf.ts:45-46`

`page.goto` resolves for **any** status and its return is dropped. A mid-deploy window, a `REPORT_BASE_URL`/`PROSPECT_REPORT_URL` mismatch, or Turso replica lag between the insert and the render, and chromium renders the marketing site's 404 — `page.pdf()` returns it as a valid PDF and `prospect-audit.ts:250` attaches it. Best-effort is right; _this_ is too forgiving, because nothing throws so **no warning is recorded**.

```ts
const res = await page.goto(printUrl, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT_MS });
if (!res || !res.ok())
  throw new Error(`renderReportPdf: ${printUrl} responded ${res?.status() ?? "no response"}`);
```

_Latent, not realised — tonight's PDF is ~275 KB, far too large for a 404 page._

### HIGH-6 · Any upstream 404 tells the prospect their report doesn't exist

`src/lib/report/fetch.ts:65` (website)

`if (res.status === 404) return null;` discards the body, so a not-yet-deployed function, a changed `path` config, a wrong `PROSPECT_REPORT_URL` (bare Netlify 404), or replica lag all render as a confident "Not found". Maintenance already sends the signal — `audit-report-json.mts:46,56` returns `{"error":"not-found"}` — we just don't read it. `load.test.ts:37` passes because it stubs a bare 404, which is the exact ambiguity.

### HIGH-7 · Scores aren't comparable between runs, so the 90-day re-audit doesn't work as built

Two runs of the same unchanged site produced **10 questions each, of which exactly 1 was the same**. The `categoryQueries` differ too — only one of five appears in both. Each run is a fresh questionnaire, model-graded, over a model-chosen denominator.

Findability (91/91/91) and Readability (83/83/82) are stable because they're deterministic counts. Answers (75/65/80) is the only model-derived score and the only one that moves.

**"We re-run this and show you the same numbers in ninety days" is in the report design, the client-facing draft, and the field guide I wrote today.** As built that delta compares two different questionnaires. Either pin the question set per prospect on first audit and reuse it, or stop promising a comparable number.

---

### HIGH-8 · An autoplaying Slideshow has no reachable pause on touch — WCAG 2.2.2, Level A

`src/lib/components/Slideshow/Slideshow.svelte:71-77` (website)

```ts
const chromeHidden = $derived(canAutoplay && isPlaying);
// then: "opacity-0 pointer-events-none group-hover:… group-focus-within:…"
```

While auto-advancing, the controls fade out and return on **hover** or **focus-within**. Both escape hatches are unavailable on touch: a touch device has no hover, and because the chrome is `pointer-events-none` a tap **cannot land on the play/pause button to focus it** — so `group-focus-within` can never fire from touch either.

Net: on a phone or tablet, an autoplaying Slideshow advances indefinitely with **no reachable way to pause it**. That is WCAG 2.2.2 (Pause, Stop, Hide), **Level A**. Desktop and keyboard both pass, which is exactly why it went unnoticed.

The comment at `:71` — _"Keyboard focus always reveals it, keeping the WCAG 2.2.2 pause reachable"_ — is correct reasoning that silently assumes a keyboard exists. Reduced-motion is handled properly (`:45`, `canAutoplay` excludes it), so this is strictly the touch + motion-allowed case.

**~6 lines**, reusing a pattern already in the file: add a `coarsePointer` `$state` from `matchMedia("(pointer: coarse)")` mirroring the `reduceMotion` effect at `:36-43`, then `chromeHidden = canAutoplay && isPlaying && !coarsePointer` — on touch the controls simply stay visible.

**No gate would have caught this.** axe has no 2.2.2 rule, and "no reachable pause" is not statically detectable. Our a11y suite is desktop-Chromium; the failure is touch-only.

## Findings — MEDIUM

- **MED-1 · A degraded probe run produces a confident number with a shrunken denominator.** `probes.ts:186-198` — a dropped answer never enters `answers`, so it leaves the denominator rather than failing the stage. 2 of 3 failing ⇒ the score is `{0, 100}` built on one answer, and nothing in `ProbesResult` records attempted-vs-returned, so nothing downstream _can_ disclose it. `render.ts:160-162`'s caveat only fires at **zero** category answers. Add `categoryAttempted`/`categoryAnswered`; null the score below a floor of 2.
- **MED-2 · No timeout on the cross-repo fetch.** `fetch.ts:63` has no `AbortSignal`. A hung maintenance app blocks the website's SSR function until Netlify kills it. `{ signal: AbortSignal.timeout(8000) }` — the abort throws, landing on the correct side of the 404/500 split.
- **MED-3 · The two repos disagree on what a token is.** `prospect-audits.ts:11` is `{22}`; `fetch.ts:27` is `{20,64}`. Not exploitable (superset; the DB gate is narrow), but `fetch.ts:24` _claims_ it's "the shape `generateToken()` produces" — it isn't. And `audit-report-json.mts:15-17` demands token handling stay identical across routes _because a divergence is a security difference, not a style one_. The website is the third route on that document and the one that diverged.
- **MED-4 · The root layout couples a prospect's report to Prismic.** `+layout.server.ts:47-55` runs `getByType("project")` on every request including `/audit/`. Prismic down ⇒ a report whose own data loaded fine fails anyway, plus a second hop on a page that already has one. The `isPrivateReport` flag at :29 already exists to hang the skip off.
- **MED-5 · `model.ts` guards the stage wrapper but trusts every field inside it.** `stage<T>()` (:78-82) is right; below it the casts are unchecked, and since `AuditReport = Record<string, unknown>` this is the _only_ runtime boundary on the seam. `.filter()` on `answers`/`buyerQuestions`/`fixes` (:159,:185,:160,:188) throws on a shape change; `findNamesake` calls `.replace` on `entry.domain`; `businessName` renders `[object Object]` in the `<title>`. `model.test.ts` covers absent and failed stages, never a wrong-_typed_ field.
- **MED-6 · maintenance `pnpm audit --prod`: 1 high** (`nanoid < 3.3.18`, GHSA-2v37-7h3g-55p8) via `eslint-plugin-svelte > postcss > nanoid`, a deliberate prod dep because the package ships `configs/eslint`. **Exposure is low** — lint-time code, never run by a site. Note the website already resolves the _patched_ `nanoid@3.3.18` on the identical path; the difference is purely lockfile age. `pnpm update` closes it.
- **MED-7 · 0.88.0 merged but unpublished.** Top of Stack 3.
- **MED-8 · The plan doc for today's work is not on `main`.** `docs/superpowers/plans/2026-08-25-prospect-report-route.md` lives only on `docs/prospect-report-route-plan`, which has **no PR**. Both merged PRs (#139, #140) link to it. Every other plan doc is on main.
- **MED-10 · A signed Airtable URL would be printed into a world-readable CI log — but it has not happened.** `src/reports/airtable/attachments.ts:23,37` embed the signed URL in the thrown Error (`(url=${url})`); `cli/bin.ts:92-96` catches and `console.error`s it to the workflow log; `reddoor-maintenance` is genuinely `PUBLIC`, so those logs are unauthenticated. **Filed HIGH by a sub-agent on the code alone; downgraded on evidence.** The only workflow that reaches it (`report-rerender.yml`) has run **once ever** — 2026-08-25 22:08 UTC, failed at the already-sent guard, nowhere near the attachment fetch, and the log contains no URL. It also only fires on a _failed_ fetch, where the common cause (expired/404) leaks an already-dead link; Airtable signed URLs last ~2h and cannot be individually revoked, so there is nothing to rotate and nothing published to purge. Grants report/header-image content, not credentials. **Still worth the one-line fix** — drop `(url=${url})` from both throws — because it is one failed dispatch away from being real.
- **MED-9 · README drift, both repos.** The website README (44 lines) never mentions `/audit/`. The maintenance README's `prospect-audit` entry (:70-74) omits `--email` (the flag the runner uses), still says "publish a shareable report" without saying it now lives on reddoorla.com, and lists neither `REPORT_BASE_URL` nor the PDF.

---

## Findings — LOW

- **LOW-1 · `delete_branch_on_merge = false` on both repos** — the root cause of a loop 07-16 closed "emphatically" (49→2) that has regressed to **9 stale branches in website, 233 in maintenance**. Nine of the website's ten have a MERGED PR; they're squash leftovers. A checkbox, not another sweep.
- **LOW-2 · `render.ts:401` mis-describes the scores.** _"read it as a score, not a percentage"_ — for AI Visibility it is exactly a percentage, and it doesn't run 0–100, it runs {0,33,67,100}.
- **LOW-3 · `render.ts:265` overclaims JS-dependence.** _"% of the words a visitor reads"_ — `avgMissing` is computed over a deduplicated token set (`checks.ts:52-56`), not reading volume. Directionally right, technically an overclaim, and the file is otherwise scrupulous about this.
- **LOW-4 · `REPORT_BASE_URL` isn't validated as an absolute origin.** `report-url.ts:14-16` only trims; a value without a scheme makes the redirect `Location` relative, keeping the prospect on the ops app.
- **LOW-5 · The cutover redirect is a 301.** Browsers cache those stickily; if the report moves again everyone who followed a link is pinned. 308 costs nothing.
- **LOW-6 · Tokens land in Netlify access logs** on both sites. Inherent to path credentials — worth being a recorded decision. (`audit-report-json.mts:49` correctly logs no token.)
- **LOW-7 · The malformed-token 404 skips the headers the success path sets.** `load.ts:28` throws before `setHeaders` at :33. No confidential content on that response; noted only because the file's framing is that both routes refuse identically.
- **LOW-8 · A dangling TODO.** `src/lib/report/fetch.ts:16` says "see the TODO issue for the bump" — **no such issue exists.** Mine, from today. File it, or delete the block once 0.88.0 publishes.
- **LOW-9 · `netlify.toml:42-47` is stale.** It documents the SSR-header gap as open and prescribes the fix that has since shipped. Verified live tonight: both audit routes return CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS.
- **LOW-10 · Two open "Dependency Dashboard" issues** in website (#120, #9). Renovate duplicate; close the older.
- **LOW-11 · Orphaned WIP stash in maintenance.** `stash@{0}: WIP on autotick-coverage-extension`. Land it or drop it.
- **LOW-12 · `type-question` used for non-questions** in `ReportDisclosure.svelte` and `FixList.svelte`. Cosmetically fine; semantically the class stops indicating what it claims.

---

## Reviewed adversarially and found sound (stated, not padded)

Worth recording, because "we looked hard and it held" is information too.

- **The cockpit's Google auth — nothing CRITICAL or HIGH.** All six files read adversarially, including `google.ts` opened specifically to check it: PKCE S256, `openid email` only, `email_verified !== true` rejected, and a deliberate choice to spend a userinfo round trip rather than leave an unverified-JWT decoder in the codebase. `timingSafeEqual` with byte-length pre-checks in both `signing.ts:54` and `basic-auth.ts:48`; `safeReturnTo` covers `//`, `/\` and control-char header injection; the allowlist fails closed on empty; `verify` never decodes attacker bytes before authenticating them. **For one-day-old code with exactly one real sign-in, that is a genuinely good result** — it did not need generous grading.
- **`computeScores`' null-vs-zero discipline** (`checks.ts:216-304`). `findability` is gated on _both_ `crawlerAccessMeasured` and `pageCount > 0`; `readability` on `avgMissing !== null`; unmeasured sidecars score 0.5, neither penalising a transport failure nor crediting an unverified presence; weights sum to exactly the divisor. "Not measured" renders as a distinct grey state, never as a zero. The only gap is MED-1, where degradation is subtractive rather than nullifying.
- **The analyze-failure cascade.** analyze fails → `categoryQueries: []` → branded-only → `categoryAnswers.length === 0` → `visibilityScore = null` → card reads "Not measured" _and_ prints the branded-only caveat. That chain works end to end.
- **SSRF and open-redirect on the new seam.** `fetchReport`'s URL build is anchored base64url, validated at both route and callee; the redirect's destination is a constant origin never derived from the request. _(The crawler's sitemap path is a different story — see the cross-reference above.)_
- **Cross-prospect serving.** No path found: the edge keys on URL, durable cache is excluded and tested, `no-store` is set, and there is no shared in-memory cache anywhere on the seam.
- **Chromium lifecycle** (`pdf.ts:56-59`) — `close()` in `finally`, tested on both success and navigation-failure paths. No process leak.
- **Sitemap containment** — explicit allowlist plus named Prismic types; `/audit/` structurally cannot appear.

## Open loops carried forward (graded)

**Closed ✅**

- **Turnstile mis-classification (07-06 HIGH-1)** — `turnstile.ts` maps `timeout-or-duplicate`/`internal-error` → `unverifiable`. The blocker on the `Require Turnstile` opt-in is gone.
- **`feat/approve-preflight-gate` (07-06 top-of-stack)** — shipped; `approveBlockers` live at `digest-collectors.ts:189`.
- **Dead `playwrightA11yConfig` alias (5th brief)** — removed.
- **"Test suites have never run in CI" (07-16)** — closed; `test: pnpm test:unit && pnpm test:smoke` exists and CI runs it.
- **Tailwind safelist scanner accident (07-16)** — closed; `app.css` uses `@source inline(…)`.
- **LogoSoup `each_key_duplicate` (07-16)** — closed; keys are the index at `:130,159,283,310`.
- **SSR security-header gap (07-16)** — closed, verified live on both new routes.

**Still open**

- **Revogen 4-theme animation (07-01 MED-1 → 4th brief).** `RevogenGraftsHero.svelte:70-78` still renders all four stacks, gated only by opacity. Four briefs is where it either gets fixed or written down as deliberate.
- **twenty-for-twenty headings** — improved 3 → 2 `<h1>`, still more than one.
- **Reduced-motion (3rd brief) — DOWNGRADED.** Quantified: 27 components use transition/animate, 18 guard reduced motion. Of the 9 that don't, only **LogoSoup** (5 motion refs) and **Testimonial** (1) have real transform motion; the rest are colour-only. A 2-file fix, not a cluster.
- **GA SPOF (5th brief)** — _not re-verified_; outside tonight's scope.

**Regressed**

- **Branch hygiene (07-16 LOW-8)** — cleared by hand in July, back to 9 + 233. Root cause found: LOW-1.

---

## Decisions deferred

1. **CRIT-2's fix shape.** _Provisional: downgrade unsupported positives to `no`._ The alternative — a field distinguishing "answered by structure" from "answered by a quotable passage" — is more honest but a schema change. Ship the downgrade now; consider the field at the design pass.
2. **HIGH-7: pin the question set, or drop the re-audit promise?** _Provisional: pin it._ Store the set on first audit, reuse on re-audit. That's the difference between a retainer hook and a claim we can't support. The questionnaire then ages — revisit annually.
3. **GA on `/audit/` — exclude entirely or just suppress `page_location`?** _Provisional: exclude entirely._ Per-report analytics is worth little against that failure mode. If you want view counts, count server-side where the token never leaves our systems.
4. **MED-3: whose token pattern wins?** _Provisional: export a predicate from the package and use it both sides._ Collides with `./audit` being types-only — a runtime predicate needs a deliberate home, same decision as whether that entry should also export `parseProspectAuditResult()`.
5. **The design pass you flagged.** Both new documents are marked "machinery" in-source. Nothing here pre-empts it — CRIT-2 and the HIGH-1..4 cluster are correctness, and should land regardless of what the visuals become.
6. **Nothing deferred here any more — both late findings landed and were verified.** They are written up as HIGH-8 and MED-10. Worth recording _how_ one of them changed: a sub-agent filed the CI-log leak as HIGH on the code alone, and checking the run history downgraded it to MEDIUM — the workflow has run exactly once, failed before reaching the attachment fetch, and published no URL. The code justified HIGH; the evidence didn't. That is the correct direction for a review to move in, and it is why "verify before promoting" is worth the time it costs.

---

## What I did NOT do tonight

Read-only, as contracted: **no commits, pushes, PRs, merges, Netlify changes, live-service writes, or fixes** — including the three-line one in CRIT-1. The only writes were this brief and the pre-cleared permission additions to both repos' `.claude/settings.local.json` (Phase 1, before you left). Nothing prompted you.

Network reads only, all GET: the live audit API (comparing the three runs), the two live report routes (verifying headers), npm, and the GitHub API.

Not done: the GA SPOF loop (out of scope), opening the emailed PDF byte-by-byte (inferred from ~275 KB that it's a real report, not a 404), the website smoke suite (unit + check + audit only), and the third subagent's ground.

Working trees: website clean at `f128866`; maintenance carries one pre-existing stash (LOW-11) and several worktrees from today.

---

## One thing you couldn't have gotten from today's diff

**Four, and none are in a diff.**

1. **The Answers score can disagree with itself.** Only visible by pulling two completed runs out of the live API and comparing field by field: the same question, the same null evidence, graded `NO` in one run and `PARTIAL` in the next. No test asserts a positive verdict has evidence, because the pass that walks evidence was written to catch _fabricated quotes_ and nobody asked the opposite question. True since the analyze stage was written — running it three times is what made it visible.

2. **The zero isn't a measurement, it's a construction.** The scorer is fine. The prompt asks for queries the prospect _deserves_ to rank for, which produces head terms, which return directories. A 5–50 person firm cannot win those, so the number was always going to be 0 — including for our own site, on the metric we sell. That's one paragraph of prompt, and it's the highest-leverage twenty minutes in the system.

3. **A closed loop reopened because we fixed the symptom.** July's brief cleared 49 branches to 2 and called it closed emphatically. It's 9 and 233 now, because `delete_branch_on_merge` is `false` on both repos. The sweep was the wrong fix. Worth watching for that pattern elsewhere — a brief closing by hand what the settings quietly reopen.

4. **The fix that unblocks the fleet is merged and helping nobody.** `playwright-port-stability` went into `main` tonight; `0.88.0` sits in an unmerged release PR. Every fleet site is still pinned below 0.84 for a reason that no longer exists. Merged is not shipped, and for a published package the gap between them is a release PR nobody watches.
