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
