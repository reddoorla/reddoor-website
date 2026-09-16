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

> Superseded in part by 2026-09-14 — The `hide` tag makes a document staging-only (#185, `feat/hide-tag-staging-only`), which sits above this entry because `staging` merged in first.

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

## 2026-09-15 — The `hide` tag reached production (#186, `4503065`)

Tucker published the medtech release (`aqiaQxMAAFcNpGFf`) himself, so the
promotion did not wait on Tim. The promotion PR's required check went red
twice before it went green, for two different reasons, and neither was the
code: the first run built before the release was published and died on the
`404 /portfolio/strategy-advantage-website (linked from /medtech)` link the
#185 entry predicted; the re-run died in the smoke suite's dev server with
`ConnectTimeoutError ... reddoor-la.cdn.prismic.io:443` (the runner could not
reach the Prismic CDN at all, so every Prismic-backed page failed), while the
pull-request-event run of the same commit passed. A third run passed and #186
merged at 03:04 UTC.

Measured on `reddoorla.com` after the build: `/health` reports
`hiddenContent: "hidden"`; `/boise`, `/og/industry/boise.png`,
`/portfolio/hbo-signage`, `/portfolio/strategy-advantage-website` and
`/showcase/cre-branding-design` are 404; `/medtech` still shows the Strategy
Advantage logo but no longer links it; the sitemap lists 49 URLs and none of
the sixteen hidden documents; `/slice-simulator` carries no `X-Frame-Options`
and the widened `frame-ancestors` from #184. One reading in the verification
script looked wrong and was not: it reported "strategy-advantage listed:
true" in the sitemap, because it matched a substring, and the hit is the
unhidden project `strategy-advantage1`, not the hidden
`strategy-advantage-website`. Check the full slug, not a prefix.

A belief corrected on the way: the Boise branch's local `vitest run`, after
`staging` merged into it, reported 19 failures across 15 files this session
never touched (`og/card`, the GHL clients, the report loaders, the schedule
helpers, `security/headers`). The load average was 45 at the time; the four
lightest of those files passed 31 of 31 in isolation once it fell to 15, and
CI on the same commit passed, the eleven `/boise` smoke tests included. The pattern to
recognise is one failure per file, usually the first test, which is the
module import paying for a starved worker rather than a defect.

Housekeeping: the `hide-tag` and `sim-framing` worktrees and their local
branches are gone (GitHub deleted the remote branches on merge). Still owed by
people: Tim's copy review of `/boise` against the eleven `_contentGaps`, a
licensed Boise hero, the A-102-1 chase-link edit in the CRM builder, and the
CRM smart list on the `bew` tag. Taking `/boise` live is now a content act,
not a deploy: remove the `hide` tag and publish, and the Prismic build hook
rebuilds `main`.

The A-102-1 chase link now sends the funnel. The 2026-08 accounting called
the builder's inline email bodies unreachable because no API reads or writes
them; the builder itself does both, and it can be driven from a script over
Chrome's debugging port. Two of the three reminder emails carry the
`{{custom_values.sub_domain_url}}/inquiry?…` link (reminder 2, "Still
interested?", has no link at all, a content gap of its own); both now end in
`&funnel={{contact.funnel}}`, saved as workflow versions 12 and 13 with the
status still published, and read back from the server after a fresh load.
What it took, for the next edit: the list page ignores `parentId` and
`folderId` in the URL, so the workflow id came from the list store's search
action; the workflow JSON sits in no store, so it was captured by hooking the
frame's XHR and bouncing the router; and the email editor is TipTap, which
redraws the DOM from its own state, so an `href` edit on the `<a>` element is
silently undone and cloning the node to force a re-parse reverts too. Only a
ProseMirror transaction against the `Editor` instance TipTap leaves on the
editor element changes the document. `/inquiry` honoured the param already,
so nothing deployed; `{{contact.funnel}}` is the field key the site writes and
has not been verified by a rendered email.

## 2026-09-15 — Boise shipped to production, still hidden (#183, #188, `4788977`)

Tucker asked for #183 to go in after seeing `/boise` on production in Firefox.
Production was not serving it: fetched from here the URL was a 404 with the
`hide` tag still on the document, and the same URL with any
`io.prismic.preview` cookie at all, even `io.prismic.preview=x`, returned the
page. The hide filter lifts on the cookie's presence, which is the approved
"previews show hidden documents" rule, but presence is not a session: a
browser keeps the cookie after a Prismic preview ends, and a forged one works
just as well. Firefox had a leftover preview cookie. The check should require
the repository's own preview entry in the cookie (what Prismic's own
`getPreviewCookie` looks for); not changed yet, recorded here as open.

The promotion (#188) went through on the required check alone. Lighthouse
failed twice without reaching the site: `npx @lhci/cli@0.15` resolved
`@types/node@26.6.0` and npm returned 404 for the tarball, on both runs,
eleven minutes apart. The same routes had passed Lighthouse on #183's own
preview an hour earlier, which is the evidence the merge rested on. After the
build: `/bew` 302s to `/boise?utm_source=bew&utm_medium=event&utm_campaign=bew-2026`,
`/boise` and its OG card 404, `/health` reports hidden content. Taking the
page live is now a content act, not a deploy: remove the tag and publish.

Also in this promotion: #187, the CRM builder runbook under `scripts/crm/`.

## 2026-09-15 — The report carries its own contents in the rail (`feat/report-toc`)

The audit report's only wayfinding was one sentence in the hero ("jump to
what to fix") and the scrollbar, on a document of five bands and up to a dozen
blocks. It now has a sticky "In this report" list in the left rail from `lg`
up and a plain list under the hero below, every entry an anchor, the current
section marked. Spec and plan under `docs/superpowers/*/2026-09-15-report-
table-of-contents*`.

Why the rail became the map rather than a new column: the 240px rail in every
`RailRow` was already taken by the red sub-section labels ("Your scores",
"Does it work"), but below `lg` those labels already stack above their
blocks. Rendering them above at every width (`labelAbove` on `RailRow`)
changes nothing a phone reader sees and empties the column at `lg`+. The
entries come from one pure function, `tocEntries(fixes)` in `narrative.ts`,
fed by the same count that decides whether "What to fix" renders, and the
ids live in a `TOC_TARGETS` table so a rename fails a unit test instead of a
jump. Why an overlaid column rather than one document grid: the sections
alternate full-bleed white and paper bands, and a single grid would be a
rewrite. Instead a `relative` wrapper around the four post-hero sections
holds one absolutely positioned column that copies `ContentWidth`'s geometry
(`left-[4%] w-[92%] max-w-[1220px]`, at `xl` `inset-x-0 mx-auto
max-w-[1440px]`) whose sticky child is the nav; the wrapper closes before the
red band so the list never sits on it, and below `lg` the same element is
simply a block under the hero — one nav, never duplicated. The current
section is one `IntersectionObserver` over the five targets with
`rootMargin: "-96px 0px -60% 0px"` (96 is `top-24`, the fixed header's
clearance, the same number as the anchors' `scroll-mt-24`), which trims the
viewport to a band from the nav line down to 40% of its height: a section is
current while any of it overlaps that band, so it becomes current when its top
crosses the 40% line — as its heading approaches the header, not when it
reaches it — and at a seam the lower one wins; the closing band is current
whenever it is on screen, from the observer the floating CTA already uses.

Three beliefs corrected on contact, in the order they surfaced. First, the
spec and plan both said `/dev/audit-report` — the all-pass fixture — renders
no "What to fix" and therefore a four-entry list, and the smoke test was
written to prove the omission on the real page. The fixture's analyze stage
carries two `recommendation` fixes ("Add a short case study for each of the
three service lines", "Publish the answers to the ten buyer questions as a
single FAQ page"), so the page renders "2 things to fix, in order" and all
five entries; "all pass" means every check passes. The omission is asserted
by the unit test on `tocEntries([])`, and the fixture is pinned there at two
fixes and five entries. Second, each section's `h2` and red rule sat in a
full-width `ContentWidth` outside the `RailRow` grid, which neither document
mentioned. Measured at 1280×800: the list's resting top (`lg:pt-24`) was
677.4px, the first h2's top was 677.4px, and the h2 ran x=51.2 to 1228.8 —
straight through the rail. `elementFromPoint` at the first entry's centre
returned the h2, a later sibling that painted over the link and took its
click; stuck at y=96, every heading passed through the list. The three
headings are now label-less `RailRow`s, so the h2 sits in the content column
(x=311.2, 917.6 wide), the rule spans that column instead of the full width,
and the list rests level with the first heading without touching it; stuck,
"What you control" passes 20px to the right of the list's edge (nav right
291.2, h2 left 311.2). Third, and the one a first-entry-only probe would have
missed: after the move the hit-test returned the header row's empty rail
cell (`div.contents.lg:block`). Every `RailRow` wraps itself in a `relative`
`ContentWidth`, a later sibling with no z-index, so its transparent cell sat
over the list wherever a row was behind it — the plan's design had this
from the start, hidden behind the h2. `lg:z-10` on the nav (under the site
header's `z-20` and the report's fixed buttons' `z-30`) and all five entries
hit-test on their own link; Playwright's click in the "jumps" smoke test
would otherwise have failed on pointer interception.

Smaller things the plan met on the way: `report-copy.test.ts` string-matches
the sources for `id="fixes"` and `id="passes"`, so three assertions now read
the `{TOC_TARGETS.*}` form; `svelte/prefer-svelte-reactivity` rejects a plain
`Set` inside a component, so the observer's bookkeeping is an array; the
plan's `toReportView(ALL_PASS_REPORT, null)` does not type (`overrides:
OverrideMap = {}`); and the spec and plan themselves failed prettier on HEAD
(107 and 14 whitespace lines), so `pnpm lint` was red on the branch before
any code — formatted in the docs commit. `font-normal` does beat
`.type-kicker`'s 700 on the links (computed 400).

Counts: 569 unit tests in 51 files; `report-toc.spec.ts` (5) plus
`industry-page.spec.ts` (20, RailRow's other consumer) passed in 1.1 min at
load 21.9 falling to 17.1. The full smoke suite was not run — the machine sat
at load 26 when the session started, against the plan's threshold of 10. The
hard-case sample on `/dev/audit-report` and edit mode on staging are still
to be checked by hand before the PR leaves draft.

Tucker's review of the built list, same day: the arrow went, so the current
entry is marked by colour alone, and the appendix left the list. As an entry
it was current only for the moment between "What to fix" leaving the
observer's band and the closing band arriving on screen — the appendix is two
closed disclosures and shorter than a viewport — and a line highlighted for
one scroll-tick and then not read as a line to skip. Its anchor stays,
because three in-page links land on it. Four entries at most now, three
without fixes.

## 2026-09-15 — The report opens with what it is (`feat/report-primer`)

> Superseded in part by 2026-09-15 — The primer counts the checks that came back.

Tucker's brief, in the same breath as the contents list: one section at the
top "that describes what this report is and what was done and why", telling
"the whole story as we have it setup", before "What an AI says about you" and
the results. The reason is the reading the report was getting: an assistant's
paragraph about the business, then scores, and nothing before either saying
that most of the document is machinery. Read cold, it was an AI's opinion of
a website — the thing we are least willing to sell — rather than the output
of an instrument that ran seventy-odd named checks before an assistant was
asked anything. The first copy draft made that case and was rejected twice:
once for missing the mechanical checks entirely ("we need to demonstrate the
work that we've done building this tool and how this is different than just
asking an ai to audit the site from a standing start"), then, with them in,
for length — "at least twice as long as I'd want it to be, this is the first
section we want to inform the reader not lose them". The approved version is
three paragraphs, about 190 words: the two routes a buyer takes and that this
is a measurement on a date, not a promise; the machinery in the order it ran
(crawl twice, the battery, the accessibility rules, robots.txt as the
crawlers read it, clicks to contact) and only then the assistant; and how to
read it (receipts, unmeasured is not scored against you, passes in one place,
fixes in order, worth taking again). Title "What this report is", kicker "In
short", on the hero's paper as front matter, first in the contents list.

The prose is composed in `narrative.ts` rather than written in the template,
and the reason is the honesty rule. The copy names four values — the
business, the date, the count of named checks, the count of AI crawlers —
and five clauses that each claim a stage ran. `primer(view, fixes)` reads
every one off the view and drops any clause whose stage did not run rather
than defaulting it: `accessibility.measured`, `crawlerReach.measured &&
checked > 0`, the journey stage's presence, `categoryProbes.length`,
`fixes.length`. A primer saying "we read your robots.txt" over a report whose
checks never ran would be the exact overstatement the report exists to avoid,
and a template with five `{#if}`s inside one sentence is where that mistake
would have hidden. Composed in code, every branch is a unit test, and the
review's probe ran all of them for double spaces and stray punctuation (the
first version spliced ", check…" onto "about {who}"; it is whole sentences
joined by a space now). The fallbacks read: "taken on one day"; "ran its named checks on what came
back." with no examples of rows that did not run; the machinery sentence
dropped whole; "your business" for the name; and the receipts sentence
without the fixes clause. The hard-case sample on `/dev/audit-report`
(apple.com: no business name, no date, no probes, no accuracy stage — but the
full battery, eight crawlers, accessibility over 20 pages, a journey over 15
and two fixes) prints "taken on one day" and "your business" and everything
else live, and it is where the final review caught the one clause the gates
had missed: "Only then did we ask an assistant about your business and check
each statement against your own pages" printed over a report whose accuracy
stage never ran, while SourceCheck two sections down said no assistant answer
had been captured to check against. That sentence is gated now on the
accuracy stage (the same `answersRead` SourceCheck reads), the branded probes
and the category probes, in five shapes, and a report with none of the three
has no assistant sentence at all; a journey that examined no pages counts no
clicks either. Two of the plan's beliefs were wrong on contact: its
null-view fixture forgot `businessName`, so the "your business" assertion
failed against "Example Studio" until the implementer nulled it; and an
empty battery printed "ran 0 named checks", so the gate is on the count, the
way `health.ts` treats null and `[]` alike. `auditedOn(view)` moved into the
same module so the masthead's "Audited September 3, 2026" and the primer's
"taken on September 3, 2026" are one function; the print route uses it too,
which is the one thing this branch touches in the PDF — the PDF has no primer
and still promises "the same story", a gap for a later entry.

Layout. The section carries `pt-12 pb-16 md:pb-24 lg:pt-0` and the contents
list's positioning column lost its `lg:pt-24`: at `lg` the hero's own bottom
padding is the seam, so the section's top, the list's top and the heading's
top all measure 581.375px at 1280×800 (list x=51.19, heading x=311.19), and
the smoke pins the list to the heading within 1px. Below `lg` the list's
`mt-12` and the section's `pt-12` give 688.78 → 876.78 → 924.78 at 390×844.
The defect the first build had is the one the screenshot caught and the
review predicted: with the primer on its own `bg-paper` and the wrapper
transparent, the list sat on a 236px strip of plain white between two paper
bands on a phone (before this branch its white ran into the white first
finding). The wrapper carries the paper now and the two white sections paint
`bg-white` over it; a responsive `lg:bg-none` on the column would not have
worked, since `.bg-paper` is unlayered and beats utilities. The phone smoke
asserts the band behind the list, the primer's heading and the first
finding's heading.

One more thing found on the way, unrelated to the primer: the unit tests
were timezone-dependent. The fixture stamps `generatedAt` at `09:00Z`, and
`TZ=Pacific/Honolulu pnpm vitest run` printed "September 2, 2026" — CI is UTC
and every Pacific machine is fine, so nothing had ever failed, the same shape
as #133. `vitest.config.js` pins `env.TZ` to UTC.

Counts: 581 unit tests in 51 files; `report-primer.spec.ts` (2) and
`report-toc.spec.ts` (5) passed in 15.2s on a fresh vite, with
`.audit-sample.json` moved aside so the fixture renders as in CI; lint and
check clean. Same day, Tucker's review of the contents list removed the
arrow from the current entry and the appendix from the list; those are in
the entry above, and the primer stacks on that branch (PR #190) as its first
entry. Still to check by hand: edit mode on staging, where the primer should
be offered as no target, since none of its text is a payload field.

## 2026-09-15 — The primer counts the checks that came back (`fix/report-check-count`)

Tucker, on reading the shipped primer: bring back the number of checks run
rather than just "named" checks. The primer said "then ran 76 named checks on
what came back", and 76 is the size of the battery, not the work. No site
meets all of it. On the hard-case sample 48 rows passed and 13 failed, while
14 were `not-applicable` — no form to test, no sitemap to read — and one was
`unmeasured`, so 61 checks actually returned a verdict and the sentence
credited us with fifteen we never ran. 61 is also, exactly, the number the
approved copy carried as "{sixty-one}"; the implementation reached for
`siteChecks.length` and the spec table blessed it, and neither review caught
that the placeholder had been a different quantity all along. The count is
now the rows whose status is `pass` or `fail`. The all-pass fixture prints
70, its other six having nothing on that site to apply to.

The numberless fallback went with it. "Then ran its named checks on what came
back" was what printed when the battery was missing, and a count is the whole
point of that clause, so with nothing to report the clause is dropped and the
sentence ends at "in a real browser." A report whose battery never ran should
not imply that it did. Also corrected: the comment justifying digits over
words claimed "the rest of the report already says 'of the 76 checks'".
Nothing in the report says that. "What passes" counts clean items (99 on the
fixture, 52 on the sample) and "Does it work" counts health rows; the primer's
is the only battery count on the page, which is why it had nothing keeping it
honest.

One environment cost worth writing down, because it looks like a catastrophe
and is not: a newly created worktree fails 49 of its 51 unit test files with
"[TSCONFIG_ERROR] Failed to load tsconfig '.svelte-kit/tsconfig.json'". Only
two files pass and 21 tests run. Nothing is broken — `pnpm test:unit` is a
bare `vitest run`, and `.svelte-kit/tsconfig.json` is generated by
`svelte-kit sync`, which of the package scripts only `pnpm check` calls. An
established checkout has one from an earlier build, so this bites only on a
fresh `git worktree add`. `pnpm exec svelte-kit sync` once, and the same
suite goes 51 files and 582 tests green.

## 2026-09-16 — The analytics number was mostly our own test suite (`fix/ga-hostname-gate`)

Tucker, on the September maintenance report: analytics seem way higher than
they have been, what gives. The email said 15,063 Users, up 510% against the
previous thirty days, 2,471 → 15,063. It was not traffic. Broken down by
`hostName` for the thirty days to 2026-09-14, GA4 property "Reddoor Creative
Site" holds 16,072 users: 15,971 on `localhost`, 87 on `reddoorla.com`, 29
across deploy previews and staging. Source and medium agrees — 16,048 of the
16,072 are `(direct) / (none)`, which is what a scripted browser looks like.

The mechanism is this file. `src/app.html` carries one measurement id and
ships to every environment, and the tag defers until the first `pointerdown`,
`keydown`, `scroll` or `touchstart` — exactly what a Playwright test does.
Every test runs in a fresh browser context with no cookies, so every test is a
new GA client id and therefore a new "user". The smoke suite is 176 tests
across 25 spec files, CI ran it 365 times in that window against 149 the month
before, and the audit-report work meant many more runs on this laptop. The
privacy hardening from MED-7 made it worse in one narrow sense: the
interaction gate that spares a zero-interaction human bounce does nothing to
spare a robot that clicks.

Two things worth keeping. First, this is not new — the previous window was
1,807 localhost against 176 real, already 91% noise. The metric has been
junk for months and nobody noticed, because 2,471 is a number a small studio
site could plausibly earn. It only became visible when CI volume more than
doubled and pushed it to six times plausible. A measurement that is wrong by
9x and still believable is more dangerous than one that is wrong by 60x.
Second, the real finding was hidden underneath: production traffic did not
rise 510%, it fell by half, 176 → 87. The noise was not merely padding the
number, it was inverting the sign.

The gate here is an exact hostname match against `MEASURED_HOSTS`, never a
suffix test, because `staging.reddoorla.com` ends with the production domain
and must not be measured — it is in the GA hostname list already. `app.html`
cannot import `$lib/site.ts`, so `analytics-hostname.test.ts` cross-checks the
literal against `SITE_URL` and fails if they drift. Nothing in the app calls
`window.gtag`, so only the script load is gated; the `dataLayer` shim stays,
and a future `gtag("event", …)` will not throw on a laptop.

This repo's gate only cleans future months. The other half is in
reddoor-maintenance: `src/reports/ga/client.ts` asks GA4 for `activeUsers`
with no `dimensionFilter` at all, so the report would keep printing historical
noise. That change rides its own PR there.

Checked across the fleet before assuming it was ours alone: of twelve GA
properties, only this one (99% not real) and Revogen (29%, 246 localhost
users) are affected. Every client property is between 0% and 8%, and
Beachfront Dentistry — whose report went out on 08-20 — is at 0%, so no
client has been mailed an inflated number. One caveat on the arithmetic: the
report measures a rolling window ending when it runs, so the window queried
here is close to but not identical with the email's, which is why these
totals are 16,072 and 1,992 where the email said 15,063 and 2,471. The shape
is the same.

## 2026-09-16 — Staging went red because the reduced-motion emulation started working (#196, `ea9ef95`)

Staging had been failing since late on 09-15, and every PR based on it
inherited the same three failures: `schedule.spec.ts:333` ("the in-flight
button animates without changing its accessible name") and two in
`twenty-video.spec.ts` ("video reveals itself once it actually plays",
"fallback returns when playback stalls mid-stream"). Each burned its full
retry budget on CI — 3 of 3 attempts — so they were deterministic. I described
them as flaky before I had that evidence, which was wrong and sent me looking
in the wrong place first.

The cause is one word of placement. `@reddoorla/maintenance` 0.95.1 arrived via
#193 (`da76aac`), the only commit on staging between the last green run at
16:41 and the first red one at 03:05, and its shared Playwright base sets
`contextOptions: { reducedMotion: "reduce" }` suite-wide.

**The belief this corrects.** `playwright.config.ts` carried a NOTE saying the
config-level value "reaches neither matchMedia nor the CSS cascade", measured
on Playwright 1.62.1. That measurement was real. It was measuring the wrong
placement. `reducedMotion` is a `BrowserContextOptions` member: at the top
level of `use`, Playwright drops it as an unknown key, and `pnpm check` never
catches it because svelte-check does not typecheck `playwright.config.ts`. The
starter carried it there, inert, from 2026-06 to 2026-09-01. Under
`contextOptions` it works and reaches both. So the honest summary is not "the
config doesn't work" but "the option has one legal home and we had it in the
wrong one for three months".

The failures follow directly. `SendingDots` holds its dots still under
`@media (prefers-reduced-motion: reduce)` — deliberately, the label already
says "Sending" — so `animationName` came back `"none"`. The twenty-for-twenty
page renders its Vimeo iframe behind `{#if !prefersReducedMotion}`, and the
`$effect` at line 170 reads `matchMedia` at hydration, so the iframe is
server-rendered and then torn out. The assertion log records that precisely:
`5 x locator resolved to <iframe ...> unexpected value "0"`, then
`element(s) not found`.

**Two specs were green for the wrong reason,** and that is the part worth
keeping. "Vimeo iframe is granted autoplay permission" and "fallback sketch
stays visible when the video cannot play" both passed under the new default —
not because they were unaffected, but because they assert early enough to beat
the hydration teardown. A race they happened to win. Both now opt into motion
explicitly and exercise the path they claim to.

The fix keeps the suite-wide default rather than switching it off: the README
relies on reduced motion for determinism, and per-test `emulateMedia` overrides
the context value in both directions. Opting out per test is already the
pattern here — `industry-page.spec.ts:501` does it, with a comment noting that
`reducedMotion` does reach `matchMedia` on 1.62. Someone met this before me.

Measured: 3 failed of 204 before, reproduced locally on the untouched branch;
after, 204 passed, 7 skipped, 0 failed, 0 flaky, alongside lint clean, check
clean over 4630 files, and 582 unit tests. Six specs still carry comments
asserting the old no-op claim; they emulate `reduce` explicitly so they are
redundant rather than wrong, and that prose sweep does not belong in a change
whose job is getting staging green.

Also open from this session and not yet journaled, since they land on their own
PRs: #195 gates the GA tag on hostname and #841 adds a `hostName` filter to the
maintenance GA query, after the September report counted 15,971 localhost
sessions from our own Playwright runs as client traffic.

## 2026-09-16 — Tim's MarkUp round on the audit report: title, "live", heading, question link (fix/report-tim-markup)

Tim marked up the Reddoor report (`/audit/xZMVU1EaZLC1ZLAJ81Rzxg`) on 09-15
at 14:13–14:35 PT and never sent the link; it surfaced in
`#rd-clients-by-design` on 09-16. The board is "AEO / SEO Report", 8 pins.
Pin screenshots could not be fetched this session (reading the MarkUp key for
the screenshot endpoint was refused by the permission classifier), so each pin
was placed by matching its comment to the page text and its y% to the scroll
order Tim worked in. That is inference, and the pins it rests on most are
named below.

Applied, in renderer copy only — stored audits are untouched, so every existing
token shows the change:

- The eyebrow reads "AEO / SEO Audit Report for: {who}" (pin 1, Tim's wording
  verbatim), on the web page and the print sheet. The print sheet's eyebrow and
  `<title>` said "Prospect audit", our internal word for the reader, printed to
  the reader. The h1 stays: its comment records why "When AI answers for" was
  chosen over a discovery promise, and the pin reads as a label, not a retitle.
- "live" is gone wherever it described the assistant (pin 3: Tim laughed at
  it). Five sites: the What-it-says lede, three primer branches in
  `narrative.ts`, "N live searches" on both surfaces, "The live visibility
  test", and the print sheet's "asked of a live AI assistant". "Findings live"
  in the closing band is about the meeting and stays. Pin 3's real question —
  ask ChatGPT and Grok too — is a pipeline decision and is not addressed here.
- "never by whether it is true" → "not by whether it is true" (pin 4; the
  placement is the least certain of the round — "never" also appears in the
  llms.txt note and in stored fix text, but this is the one on the screen Tim
  had just pinned).
- The section heading "What an AI says about you" → "What AI is saying about
  you" (pin 5), in sentence case to match every other heading rather than
  Tim's title case. Also the TOC label and the passes group title.
- Pins 7 and 8 ("what ten questions?", "do we link to the questions?"): the
  opener said "Of the ten questions buyers ask first" with the list two blocks
  down in a closed disclosure. The opener now ends in "See the questions.",
  which jumps to `#buyer-questions` and opens it (the disclosure's `open` is
  bound), and the root's delegated handler offers the way back like every other
  in-page link. Verified in a browser on `/dev/audit-report`.
- Erik noticed "memorise" in the report. American spelling in the renderer's
  reader-facing strings: memorize, recognize (×2), organization, color,
  judgment. Fixture strings and the maintenance pipeline's stored text
  ("enquiry form", "memorised" in `goals.ts`, "memorise" in
  `measured-fixes.ts`) are not in this change; the pipeline copy lands in new
  audits only, and needs its own PR there.

Left open, deliberately. Pin 2 ("Project goal and what we did to get there")
predates the primer (#191 merged 17:26 PT the same day) and reads as the
request the primer answers. Pin 6 ("seems important, like a summary sentence,
but the visual hierarchy makes it look like a footnote") is almost certainly
"{who} was not among them, in any of the N questions we asked" — and
`Standing.svelte` demotes it on purpose: a zero at the top of that section took
over the meeting, and it is the one number nothing we do reliably moves.
Promoting it reverses a recorded decision, so it goes to Tucker.

Scoped, not built: asking more than one assistant. The pipeline already has a
`VisibilityEngine` interface and a Perplexity adapter behind
`PERPLEXITY_API_KEY`; the renderer is what is not ready — `toReportView` pools
every engine into one count, `{#each}` blocks keyed by `probe.query` would
collide with two engines asking the same question, and `report-copy.test.ts`
requires the copy to say one assistant. The three adapters already mean
different things by "cited" (API Claude = retrieved plus cited, `claude -p` =
retrieved only, Perplexity = used), so a side-by-side count would measure the
plumbing. Rough estimate: 25–40 h for one extra engine on probes only, 75–110 h
for parity across three or four.

Gates: lint clean, check 0 errors over 4631 files, 589 unit tests, the 7
report smoke specs; three new guards in `report-copy.test.ts` for the title,
the "live" wording and the question link.
