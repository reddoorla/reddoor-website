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
still carried `?k=<key>`.

**Cause isolated, and it is the platform: Netlify preserves the query string
across redirects.** Found with a control, after a first pass that could only say
"something downstream appends it". Our 303 to `/audit/{token}/edit` came back
carrying `?k=<key>&zzzmarker=1` — the entire original query, including a marker
param added to test precisely this — and Netlify's _own_ trailing-slash 308,
which this repo does not author, preserved it too. Two redirects, one ours and
one the platform's, both appending. **No server-side `Location` can defeat
this**, so the client-side `replaceState` scrub is not a second line of defence;
it is the only mechanism that clears the key, and the separate-path design rests
on it. A browser test asserts the URL is clean, including after a Back press.

Worth generalising beyond this feature: anywhere in the fleet that strips a
sensitive query parameter by redirecting to a bare path, on Netlify, is not
doing what it looks like it is doing.

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

## 2026-09-14 — The CMS could not frame the slice simulator (#184, `fix/slice-simulator-framing`)

Tucker's screenshot showed the Prismic Page Builder with a red "Error" where
every slice's preview should be, in the Boise document and the medtech one
alike, and he had Slice Machine running. First hypothesis, abandoned within
minutes: the slice screenshots. Every local slice model has an empty
`imageUrl`, so the pushed models all point at Slice Machine's shared
placeholder image, and a dead placeholder would explain a repository-wide
failure. It resolves fine, and the one slice with a real screenshot
(`rich_text`) resolves too. The thumbnails were never the mechanism.

The mechanism is framing. Slice Machine at `localhost:9999` and the Page
Builder at `prismic.io` both load `/slice-simulator` in an iframe, and a dev
server answered that route with `X-Frame-Options: SAMEORIGIN` and
`frame-ancestors 'self'`, which refuse any cross-origin frame. Those headers
reached dev responses in `97b5d15` on 2026-08-19, when `hooks.server.ts`
started applying the site policy to everything the server renders. The
comment in `netlify.toml` said the simulator framed only the local dev server
"so neither is affected", which was true while dev responses carried no
headers and became false that day. The belief survived four weeks because
nobody opened the Page Builder with Slice Machine running until tonight.

The fix is one exemption, not a weaker policy: `/slice-simulator` is the
single entry in `CMS_FRAMED_ROUTES`, gets no `X-Frame-Options` (the header has
no multi-origin form) and a `frame-ancestors` that names localhost and
prismic.io, and is `prerender = false` so the hook rather than the static
`[[headers]]` block decides its headers on every host. Netlify cannot exempt
one path from a `/*` block without sending two policies, both of which apply.
The page renders nothing but the slices it is handed, so there is nothing on
it to clickjack. Two unit cases pin the exemption to that one path and
same-origin everywhere else, and the header smoke spec now fetches the route.
Prismic's documentation pages for the simulator returned 404 at the two URLs
tried, so the framing origins come from observation, not a spec.

## 2026-09-14 — The `hide` tag makes a document staging-only (#185, `feat/hide-tag-staging-only`)

Tucker asked for it in one line: a document tagged `hide` should be staging
only. Two facts turned that from a feature into an incident. Sixteen published
documents already carried the tag (the `boise` page, nine projects, six
showcases), and the site honoured it in exactly four places as "unlisted": the
layout's latest-four, both portfolio queries and the sitemap's project list.
The page itself still rendered. And the `boise` document had been published at
00:34 with the tag on it, so `reddoorla.com/boise` was public with my
unreviewed copy and the placeholder hero, and in the live sitemap, while the
tag did nothing. Tucker chose to leave it up and ship the enforcement rather
than unpublish, and confirmed the 15 older documents should leave production
too.

**The belief that did not survive contact: a client-level default filter.** The
design was one `defaultParams.filters` entry on the shared Prismic client,
covering all 25 query sites, the prerender entry lists, the sitemap and the OG
route at once. The live repository disagreed within a minute: with only the
default set, `getByUID("industry", "boise")` returned the hidden page,
`getAllByType("project")` returned 52 of 52, and `getByID` of a hidden project
returned it; only the raw `dangerouslyGetAll` honoured the filter (65 of 81).
The client's source explains it: every typed method appends its own filters
and ends in `get()`, which calls `buildQueryURL`, and that method spreads the
call's params over `defaultParams`, so `filters` is replaced, never merged. The
seam is `buildQueryURL` itself. A subclass that appends the filter there passes
the whole matrix: hidden `getByUID` and `getByID` throw not-found, projects
list 43 of 52, showcases 5 of 11, `getAllByIDs` of one hidden and one public id
returns one, a four-item page returns four untagged documents. The API also
rejects the bare-string form of `filter.not("document.tags", …)`; the array
form works.

The decision is a pure function of three inputs and fails safe: shown under
`vite dev` (so the smoke suite, which runs on the dev server, sees every
published document), shown when `PRISMIC_HIDDEN_CONTENT` is `show` (set on the
`reddoor-staging` Netlify site only), shown inside a Prismic preview session
(the cookie is set only through the dashboard's token flow, so Tim can Preview
a hidden page on production), hidden otherwise, deploy previews included.
`/health` says which. The unit test for the client builds a query URL against a
stubbed repository fetch, since `buildQueryURL` resolves the ref before it
builds anything.

**The hazard the change creates is the one worth remembering.** Prerendering
follows every link in a prerendered page and `svelte.config.js` makes a 404
fatal, so a public page that links to a hidden document fails the production
build. Reproduced at the branch head with the variable unset:
`Error: 404 /portfolio/strategy-advantage-website (linked from /medtech)`. The
medtech logo grid links to a hidden project; `/boise` and the `logo_soup`
document link to none. Tucker chose to drop the link rather than untag the
project, so the edit sits in Prismic release `aqiaQxMAAFcNpGFf` for Tim to
publish, and promotion to `main` waits on it. The failure is the guard, not a
bug: the alternative is a public page shipping a dead link. The rule is in
`.env.example` and the industry runbook.

The evening's other fix, #184, is unrelated in mechanism and related in
timing: the Page Builder Tucker was using to inspect the Boise document showed
"Error" on every slice, because the site's framing headers had been refusing
the simulator iframe since 2026-08-19. Both surfaced because someone finally
opened the editor with Slice Machine running.

Verification at the head: 540 unit tests, 179 smoke green with one
load-induced failure that passed three times alone (other sessions pushed the
load average to 45 during the run), and a staging-mode build that prerenders
`/boise`, its OG card and the hidden projects. The eleven `/boise` smoke tests
live on the Boise branch (#183) and go green there once this merges beneath
them, since the document is now published.

## 2026-09-14 — `/boise`, `/bew` and the per-city content pipeline (#183, `feat/boise-industry-lp`)

Tim is working Boise Entrepreneur Week (28 September to 2 October, JUMP,
downtown Boise) and asked for "the medtech funnel, pointed at Boise". The
page that shipped is a **city** page, not an event page: `/boise` is a second
`industry` document that outlives the week, and `/bew` is a static route that
302s to it with `utm_source=bew&utm_medium=event&utm_campaign=bew-2026`
attached. Any incoming `utm_*` overrides the matching default, so one route
serves the booth card (`utm_content=booth-card`), the closing slide and the
email signature; every other parameter is dropped and the destination is a
fixed path. San Antonio is the next city, and this branch is the proof that a
niche page is now a data file, a folder of assets and one command. The five
inquiry questions and the $10k+ gate were reused byte for byte: `funnel` in
the CRM is the page uid, so the second page cost nothing on the CRM side.

**The medtech build's repeatability claim held**, with two exceptions worth
naming. No models, no slices, no CRM schema and no route code changed for the
second document; the `[uid]` route's page→industry fallback needed nothing,
and the OG card at `/og/industry/boise.png` came free. The first exception is
the chase link: `/inquiry` honours `funnel=` but defaults to `medtech`, and
the A-102-1 message body in the CRM never sends the parameter. Until someone
appends `&funnel={{contact.funnel}}` in the workflow builder (body text is not
API-writable), every abandoned lead, Boise included, is chased back to
`/medtech`. The site half is in place and pinned by a smoke test. The second
exception was a belief corrected on contact: the design assumed the `utm_*`
values ride into the CRM as custom fields. They do not. The four utm fields
were removed from the sync on 2026-08-18 because GHL blanks them on
API-created contacts, so the values survive only as text in the contact's
attribution note and in central ingest. A BEW lead and an organic Boise lead
are therefore identical to a smart list. Tucker chose a first-touch tag,
`bew`, applied on both touches (the add-tags endpoint appends, so the repeat
is harmless). The code review then caught that the redirect deliberately lets
collateral override `utm_source`, which would have left exactly the printed
cohort untagged; the tag now fires on the source or the campaign, read from
`src/lib/bew.ts` so the strings have one owner.

**Scoping found two things nobody had written down.** The live `/medtech` hero
is still the unlicensed iStock comp (`hero-PLACEHOLDER-istock-comp.png` in
Prismic); it is not fixed here, and the Boise hero is a named placeholder
(`hero-PLACEHOLDER-licensed-boise-photo-needed.png`, 3058×1720) until Tim
supplies a licensed Boise image, so the gap is at least visible in the CMS.
And the site's own `logo_soup` document is a ready-made logo source: colour
mark, knockout, rollover art and project link per brand, which is where nine
of the grid's logos came from without a Figma board.

**The board-less logo fit has numbers.** `scripts/industry/fit-logos.mjs` pads
each mark onto a 900×315 canvas (3× the 300×105 LogoGrid box) so that ink
fills at most 72% of the width or 62% of the height. The 72% is not taste:
648px on the canvas is 216 CSS px at 3×, inside the 220px the component
already declares in `sizes`, so nothing decodes more than it asked for. A
near-square mark paints narrow under that rule (St. James' Episcopal School's
ink is 173×195 and lands at about 19% of the canvas width while the wordmarks
in the same row reach 72%), and the script does not guess: `FILL_OVERRIDES`
is where a human raises one logo after looking at the row. `--check` verifies
the canvas size, orphaned knockouts, ink centring to ±1px, the fill cap and
undersize (the tightest Boise mark reaches 0.9938 of its cap; the floor is
0.98). Re-running the script over its own output can move a mark by one pixel
on the first pass and then converges, so `--check` is the oracle, not a byte
diff. Rollover art is resized to 3840 wide and cut to the 1080×1920 portrait
the grid serves below 768px with sharp's `attention` position; two brands
needed overrides (Hearts & Minds `centre`, SummitTrek `entropy`), and Hearts
& Minds has no 9:16 crop that keeps its subject, which is recorded as a
content gap rather than hidden. The smoke test that refuses an untouched
auto-crop as the phone backdrop is what makes the distinct mobile crop a
requirement rather than a habit.

**Defects, named.** Moving the medtech helpers one directory deeper broke the
credential paths in `fetch-dropbox-assets.mjs` silently, because both reads
were wrapped in `.catch(() => "")`; nothing failed until the script ran with
empty tokens. The fix was one more `../` on each, and the verification
command then used the wrong absolute path because a worktree sits two levels
below the main checkout: the depths are correct for the main checkout, and the
script now says so. Enzo's van PNG carries an alpha channel, and writing it as
a JPEG flattened the transparency to black; the stager now refuses to write
`.jpg` from a non-opaque source (`isOpaque` guard) and the brand board leads
the case study instead. The `qrcode` CLI, run from a background shell to make
the event QR codes, sat for eight minutes with empty output: `bin/qrcode`
checks `process.stdin.isTTY` and otherwise waits for stdin to end, which a
background job never does. The codes were generated through the library
(1024px, level H, quiet zone 2) and decoded back with jsQR to prove the
payloads. And one smoke test, "draws each arrow before its copy fills in",
flaked once in two full runs and passed three times alone after the industry
spec grew from 13 to 20 tests; the commit does not touch it, so the mechanism
is worker contention on an animation-timing assertion, and CI's two retries
absorb it.

**Sequencing.** Eleven smoke tests for `/boise` are red on this branch by
design: the dev server reads Prismic's published ref, and the `boise` document
is a draft in a migration release (`aqh9xRMAACcApDnG`), which Tim will find
under the Releases view, not the Migration tool. The full run at the PR head
is 556 unit tests green and 182 smoke tests green, 7 skipped, those eleven
red, plus two that failed only under load and passed in isolation: a
`/twenty-for-twenty` navigation timeout, and `/sitemap.xml` answering 500,
because the route's three Prismic fetches have no fallback when one of them
fails. Other sessions were driving the load average past 96 during the run,
which is the number to remember before trusting a red smoke suite on this
machine. The eleven go green with no code change when Tim publishes, and the
`reddoorla` Netlify project already has a Prismic build hook on `main` (from
2024-08-22), so the publish builds production on its own. Two of the eleven
came from the reviews: `/boise` advertises `/og/industry/boise.png`, the
generated card, and the card itself is fetched and must be a PNG, the first
test that has ever rendered an industry card (medtech's passes today). The
satori route's known failure mode is a function that 502s while CI stays
green; whether the card is actually prerendered is still a manual
post-publish check, since a `vite dev` run cannot tell prerendered from
on-demand. The same review removed a shadowed name from the industry smoke
spec: the six composition checks loop over every industry page while the
numeral-geometry checks pin one, and the pinned constant was called `PATH`,
the same identifier the loop bound, so a reader 300 lines down could not tell
"each industry" from "the one page these pin". It is `PINNED_PATH` now. The copy is my draft from the spec's positioning; the eleven items in
`data.json` under `_contentGaps` are Tim's review checklist: the hero photo,
the founder-in-Boise claims, the MSOT testimonial (kept, flagged), pricing
that mirrors `/medtech` ($1,500 and 7 days for the diagnosis; roughly $20,000
to six figures for the rebuild; Erik owns the language), the renamed Design
System items, the all-national logo row, and the fact that enzoshandwash.com
now redirects to a car dealer while the project's website mockup reads
"COMING SOON". Enzo's stays as the case study because it is the only named
Boise client; Tim tells us what happened. Rejected during the copy review: a
false alt on the Bronco image, a "Big-League Branding, Built in Boise"
headline, and a pricing contradiction between the FAQ and the banner.

**What the final review caught that the per-task reviews could not.** The
worst was a runbook trap: `fit-logos.mjs` was listed as a shared tool with no
caveat, but medtech's logos were normalised per asset from a Figma-measured
table, so `--check` on medtech reports 29 failures and a bare run would have
rewritten all of them in place, into a gitignored folder whose only recovery
is re-exporting the board. The script now refuses any city that has its own
`normalize-logos.mjs`. The uid-equals-folder assertion, the branch's headline
safety property, had been verified by hand and never by a test; it lives in
`scripts/industry/lib.mjs` now with one. The three framework icons the
pipeline stages and both data files name are rendered by nothing, because the
TextColumns model dropped its `icon` field when the board replaced icons with
numerals; they are medtech's Figma exports byte for byte, not "the studio's
own" as the Boise stager claimed, and `shared/README.md` now says so. The
`/bew` value cap of 100 characters had no companion cap on the number of
`utm_` keys, and each key becomes a line in the CRM note; twelve is the
ceiling now. And medtech's two image helpers had left 24 `.tmp` files behind,
which is why the `.gitignore` comment measured "~39 MB" against a real 34.3 MB
over 47 files.

One stale comment found in passing: `netlify.toml` still calls the SSR
headers gap open and points at `hooks.server.ts` as the fix, and
`hooks.server.ts` has since done exactly that. The comment is wrong in the
safe direction and is left for a separate change.
