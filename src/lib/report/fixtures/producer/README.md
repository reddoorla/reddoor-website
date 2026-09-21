# Producer-shaped report fixtures

Five payloads, one per shape the stored `result_json` actually takes, **written
by the producer** rather than by hand.

## Why they exist

Every other report test builds its input by hand, so no test had ever seen a
payload `reddoor-maintenance` actually emits. That is what let `agentAccess` be
read off the **checks** stage — it lives on **crawl** — and print "all 0 of the
crawlers we checked are allowed in" on every report for a fortnight. A
hand-written fixture agrees with whatever the consumer believes about the shape;
only the producer's own output can disagree with it.

## How they were generated

By `scripts/gen-report-shapes.mts` in **reddoor-maintenance**, which runs the
real `runProspectAudit` with every dependency injected — no network, no
database, no model call — over that repo's own `tests/fixtures/prospect/rich.html`:

```sh
cd ../reddoor-maintenance
pnpm tsx scripts/gen-report-shapes.mts ../reddoor-website/src/lib/report/fixtures/producer
```

The committed bytes are what that generator emits, formatted once with prettier
as of this commit. They are **not** re-formatted afterwards: `.prettierignore`
skips `src/lib/report/fixtures/producer/*.json`, for the same reason it skips
`src/prismicio-types.d.ts` — a prettier version bump would otherwise red
`prettier --check` across nine thousand generated lines on dep-update PRs that
have nothing to do with the report.

Regenerate them that way when the producer changes; do not edit them by hand,
and keep a regeneration in its own commit so the diff is the producer's change
and nothing else. The business is fictional and the URL is on a reserved TLD, so
nothing here can be mistaken for a prospect. `generatedAt` is frozen by the
script so a regeneration diff stays readable.

## The five shapes

The 2026-09-02 morning report (MED-6) enumerates what the live table holds as a
bit-string over `assets·basics·goalFit·accuracy·setId·q.id·fix.addresses·consistency`:

| file            | count in the live table | what it is                                    |
| --------------- | ----------------------- | --------------------------------------------- |
| `11111111.json` | 1                       | what today's producer emits — every stage ran |
| `11100001.json` | 10                      | before the accuracy stage was wired           |
| `11000001.json` | 1                       | before goal fit                               |
| `10000001.json` | 1                       | before the basics stage                       |
| `00000000.json` | 53                      | the oldest era — none of the eight            |

Only the first is a run of today's code. The other four are eras that no longer
exist and cannot be re-run, so the script derives them by **deleting exactly the
keys that era did not carry** — the bit-string is the whole specification. They
are still the producer's output with named fields removed, never a guess at what
the producer used to write.

## Known gaps

What no fixture exercises today, exactly as found. Each is a branch that
`producer-shapes.test.ts` **records rather than covers** — it has a named test
under "known coverage gaps" that asserts the degeneracy, so the corpus says out
loud where an assertion is comparing a constant with itself. Every one of them
needs a sixth, **adverse** fixture from `gen-report-shapes.mts` in
reddoor-maintenance; closing a gap will red its gap test, which is the signal to
delete that test and strengthen its counterpart.

- **No stage has `ok: false`.** Every stage of all five payloads succeeded, so
  `stage()`'s failure branch is never taken. The nulls these fixtures do produce
  come from a stage KEY being absent, which is a different path.
- **`checks.data.crawlerAccessMeasured` is `true` and `crawlerAccess.blockedAi`
  is empty in all five.** Neither an unmeasured robots.txt nor a site that
  actually blocks an AI crawler is covered, and both sides of the `measured`
  assertion normalise a missing field the same way.
- **`crawl.data.sitemap.present` is `false` in all five** (with `urlCount: 0`),
  so `sitemapUrlCount` is `null` on every fixture and its `present: true` branch
  has never run.
- **`probes.data.categoryProbes.attempted` equals `answered` in all five** (both
  3, and the answered-probe array is 3 long too). The test catches `model.ts`
  reading a path with a different value, but **cannot** catch `attempted` being
  swapped for `answered` — which is the defect the field exists to prevent.
