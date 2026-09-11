# reddoorla.com — Work Journal

Running log of build work: what was done, why, and where it landed.
Chronological — newest entry at the bottom. [README.md](../README.md) says what
the stack is and how to run it; this is the history of getting it there.

The convention is in [CLAUDE.md](../CLAUDE.md) under "The work journal". In
short: every working session appends a dated entry, prose over bullets, why
over what, and history is never edited to be right — a later entry corrects an
earlier one and says so.

---

## 2026-09-05 — Journal opened, and 560 commits summarised rather than reconstructed (`chore/work-journal`)

The journal starts today, so this first entry is a **backfill**: a deliberately
coarse summary of what came before, written from the commit log rather than
from memory. Detail below this line is trustworthy; detail above it is not, and
nothing here should be cited as though someone wrote it down at the time. The
commit log — and, for the lead funnel, `docs/inquiry-funnel.md`, which already
grades its own claims verified/documented/inferred — remains the record for
anything before 2026-09-05.

**What this repo is.** [reddoorla.com](https://reddoorla.com), Reddoor
Creative's own site. It is a portfolio and marketing site that has grown into
the studio's sales apparatus: an industry landing page at `/medtech`, a
two-step inquiry funnel that syncs to the CRM, a booking flow at `/schedule`,
and a per-prospect audit report served at `/audit/[token]`. SvelteKit 2 /
Svelte 5 / Tailwind v4 / Prismic on Netlify. 560 commits, `Initial commit` on
2024-07-29 to here.

**The eras, coarsely.** 145 commits in 2024, 99 in 2025, 316 in 2026 — the
shape of a site built once and then adopted as the place the studio's own
tooling gets tried first.

2024 is the original build, 83 commits in August alone with messages like `a`,
`f` and `gap`: nav and footer, home and about, portfolio and showcase, the
slice library, the animate-in work. 2025 is quiet — 17 commits in September,
41 in October — and mostly one feature, the "twenty for twenty" anniversary
piece, plus 404 pages and alt text.

2026 is where the character changes. April: the Svelte 5 migration, npm to
pnpm, jsconfig to tsconfig. June is 88 commits — onboarding onto
`@reddoorla/maintenance` and the fleet's shared configs, then a remediation
wave worked off an evening review: axe fixtures, heading order, a skip link,
focus trapping, CSP in Report-Only and later enforcing, ~3.3MB of payload cut,
the FontAwesome Pro kit replaced with Lucide, and a Lighthouse gate against the
real deploy preview. July continues that and rebuilds the portfolio featured
section from a new Figma design. August is the largest month at 113 and runs
two tracks at once: the `/medtech` page and the inquiry-to-booked-call funnel
(server-side CRM sync over the official API, branded reschedule, cancel and
unsubscribe pages), and the prospect audit report with a print route designed
for paper rather than a stylesheet over the page. September so far is 37
commits, nearly all of them that report — rebuilt as one narrative, split by
what the client actually controls, with an all-pass fixture so the
"check, check, check" version of it can be seen.

**Where it stands.** `main` is at `25b40cf`, a promotion merge from `staging`
on 2026-09-02. Renovate and feature work target `staging`, which is then
promoted into `main`. The working checkout sits on `feat/report-stack-readout`
at `7fc59da` with a clean tree, 11 commits ahead of `main` and 4 behind — the
audit report's Tier 0 battery readout, still in flight — and five more feature
branches are checked out as worktrees under `.worktrees/`.

**What changed today.** There was no `CLAUDE.md` in this repo; there is one
now, and it carries the convention. This branch is cut from `main` rather than
from the checkout's own feature branch, so the PR carries these two files and
nothing else. This entry is the only one written from the log — everything
after it gets written the day it happened.

## 2026-09-11 — Operator edit mode, and a security property the platform quietly undid (#181, `feat/report-edit-mode`)

Plan B of the operator-edit feature, all five code tasks. An operator opens a
report at `/audit/{token}/edit`, clicks any line that resolves uniquely,
retypes it, and the change lands on the live report. Plan A — the storage,
serving and save layers in reddoor-maintenance — merged and deployed the night
before, and the whole chain is now proven end to end (see below).

**The finding worth keeping is that the design's central property did not hold
on the platform.** Editing lives on a separate path rather than `?edit=` on the
report URL for one reason: the address an operator edits at must not be one
query string away from the address they paste to a prospect. The key is
exchanged for a cookie and the route 303s to the bare path, which is what is
supposed to clear it. Measured on the deploy preview, the `Location` header
still carried `?k=<key>`. The route redirects to a path with no query and this
repo defines no redirect rules, so something downstream appends it — **cause
not isolated**, because the sandbox refuses to let a dev server bind and the
preview had a rotated key baked in by the time the question was asked. Rather
than leave the property depending on an unexplained behaviour, the page now
scrubs the key itself with `replaceState`, and a browser test asserts the URL
is clean including after a Back press. The server redirect stays as the primary
mechanism. **Someone should still find out why.**

**Proven end to end, against the live site**, which had been blocked since the
feature began because nothing could write an override until plan A's save
endpoint existed:

```text
PRECONDITION  original is on the live page ......... true
1. SAVE       POST /api/audit-report/:token/overrides  200 {"ok":true}
2. API        serves the override back, editedAt set .. true
3. PAGE       renders the edit, original gone ........ true
3b. PRINT     renders it too, so the PDF follows ..... true
4. REVERT     mark gone, original restored ........... true
```

The first run of that proof was **a green-looking nothing**, and the reason is
worth writing down. It picked `siteChecks.data[0].why`, whose text the report
does not render — so "the edited text is not on the page" was true, and so was
"the original is not on the page", and the run looked like a clean failure of
the feature rather than a bad choice of subject. The fix was to check the
precondition first: of 230 candidate strings, only 145 are actually rendered.
Pick one of those and the whole chain lights up. A probe that does not verify
its own subject is on screen is measuring nothing.

**Four vacuous tests were found across this feature, three of them mine.** The
last one was in this plan's own Task 2: the plan stubs `cookies: { get: () =>
"s3cret" }`, a getter that answers to ANY name, so it passes just as well
against an implementation reading the wrong cookie. Proven by mutation — under
a wrong cookie name the plan's test stayed green and only the name-pinning test
added here went red. The symptom of that bug would have been `opened_at`
silently recording every operator preview as a prospect read, which is exactly
the signal the header exists to protect and which nothing else would have
contradicted. A fourth was in the ordering test written here, which used a
fixture producing health rows but no derived sentences and therefore compared
nothing; it now uses the full fixture and asserts both families exist first.

**Two things the plan got wrong that would have shipped.** `keyMatches` was
specified with `a.length === b.length &&` under a comment about constant-time
comparison, which leaks the configured key's length — the third instance of
that pattern in the fleet, after `src/forms/token.ts` and
`/api/meeting-outcome`, both of which still have it and are deliberately
untouched. And the plan says to generate `REPORT_EDIT_KEY` with `openssl rand
-base64 32`, but that key travels in a URL as `?k=`, and base64 contains `+`,
which a query string decodes to a space — so a generated key would work or fail
depending on whether it happened to contain one, and regenerating would appear
to fix it. Hex now, and the reason is recorded in `.env.example`.

**One operator-facing trap closed before it could bite.** The edit route and the
save proxy were each specified to read `env.REPORT_EDIT_KEY` directly. Once the
route started trimming a pasted newline, that divergence would have produced the
worst available state — an editor that opens and accepts typing while every save
404s, so the operator watches their work fail to persist with nothing explaining
it. Both now read through one shared helper, mutation-proven.

**Also:** `resolveTargets` was lifted out of the component into a plain module.
The rule it encodes — skip anything ambiguous, never guess — is the entire
safety argument for click-to-edit, and in the plan it was provable only by a
browser test that skips itself without a live token. It has five unit tests now.
Ambiguity is refused in both directions: one string naming several targets, and
one target rendered in several places.

**Mistake worth recording:** an end-to-end probe printed a `Location` header
without redacting it, putting a live `REPORT_EDIT_KEY` and a prospect report
token into a session transcript. The key was rotated within minutes and the
rotation verified by fingerprint on both sites. The lesson is narrow and cheap:
a probe that handles credentials should redact at the point of printing, not
rely on the author remembering which header happens to contain one.
