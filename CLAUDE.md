# CLAUDE.md

This is [reddoorla.com](https://reddoorla.com) — Reddoor Creative's own site.
It is a portfolio and marketing site, but it also runs the studio's sales
apparatus: an industry landing page at `/medtech`, a two-step inquiry funnel
that syncs to the CRM, a booking flow at `/schedule`, and per-prospect audit
reports at `/audit/[token]`. SvelteKit 2 + Svelte 5 (runes), Prismic via Slice
Machine, Tailwind v4, Netlify; Node 24 + pnpm 11 through corepack.

[README.md](README.md) is the orientation and is current: the scripts table,
the CI gates, and the conventions worth knowing — the Tailwind v4 `@config`
and `@source inline()` safelist, heading level being coupled to visual size by
the global element styles, and the smoke suite's reliance on reduced motion for
determinism. Read it before touching build or style config. `pnpm test` (unit
then smoke) is what CI runs; `pnpm lint` and `pnpm check` are the other gates.

Two things about how work moves here. Renovate and feature work open PRs
against `staging`, which is then promoted into `main`. And several feature
branches are checked out as worktrees under `.worktrees/`, so `git status` in
the main checkout is not the whole picture of what is in flight.

## The work journal

**Every working session appends a dated entry to `docs/workJournal.md`** — what
was done and **why**, newest at the bottom, never corrected in place. Write it
as the last act of the session, not the first act of the next one.

The journal is the history of executing the build. Code says what the system
does now; the journal says what it used to do, what it cost to change, and
which beliefs turned out to be wrong. Nearly everything expensive to rediscover
lives there and nowhere else.

An entry is headed with the date, a short title, and where it landed:

```markdown
## 2026-09-04 — Both runway stages render their final frame without JS (#51, `ce46ae0`)
```

Then prose — not a bullet list of file names, which the diff already tells you.
What to put in, in rough order of value:

- **Why, over what.** The reason a thing was done survives; the diff does not
  need restating.
- **Measured numbers, exactly.** "The comp's open mask is 2696×2352 on an 860px
  band — 2.735× the band's height, so a 390×664 phone needs ~534%" is worth
  keeping. "Fixed the hero on mobile" is not.
- **Defects, named.** What broke, what it looked like, and what made it
  invisible until it wasn't.
- **What was tried and abandoned**, and what it would take to revive it. A dead
  end nobody wrote down gets walked twice.
- **Beliefs corrected on contact.** The design assumption that turned out false
  is usually the most valuable line in the entry.
- **Honest accounting.** If a win came from somewhere other than the change
  that claimed it, say so — that is exactly what someone will otherwise
  over-invest in next.

**History is never edited to be right.** An entry that stops being true is not
rewritten; a later entry corrects it, and says which one it corrects. The
journal is a record of what was believed at the time, and that record is most
useful precisely where it was wrong. Fixing the past in place destroys the only
evidence of how the mistake was made.

The one edit an old entry may take is a **forward pointer**: one line directly
under its heading naming the entry that overturned it — `> Superseded in part by
2026-10-14 — <that entry's title>.` It asserts nothing new and retracts nothing,
so the record of what was believed survives whole; it only stops a reader who
lands on the old paragraph from leaving with the old answer. Without it the rule
above is half a mechanism: the correction exists at the bottom of the file, and
nothing points to it from where a reader actually arrives.

If a session produced nothing worth an entry, that is itself worth one line.
