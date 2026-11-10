# Producer-shaped report fixtures

Five payloads, one per shape the stored `result_json` actually takes, plus two
**adverse** runs of today's producer, all **written by the producer** rather than
by hand.

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
`prismicio-types.d.ts` — a prettier version bump would otherwise red
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

## The adverse shapes

The five vary which **keys** exist, never the **values** that pick a branch:
every stage succeeded, robots.txt was read and blocked nothing, there was no
sitemap, and every category probe answered. So four branches of `toReportView`
had never run on a producer-shaped input, and this section used to list them as
"known gaps", each with a test asserting the gap
([reddoor-maintenance#893](https://github.com/reddoorla/reddoor-maintenance/issues/893)).
The generator now also writes two runs of today's producer whose stubbed
dependencies take the other branch:

| file                      | what it carries                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adverse-unmeasured.json` | robots.txt timed out, so `crawlerAccessMeasured` is `false`; the accuracy stage **ran and failed** (`{ok: false, error}`) after its answers were captured                           |
| `adverse-blocked.json`    | robots.txt turns GPTBot away, so `blockedAi` is `["GPTBot"]`; accuracy succeeds, which is what renders the sitemap count                                                            |
| both                      | `sitemap.present` is `true` with `urlCount` 12, against the 3 pages the crawl reads; one of three category probes timed out, so `categoryProbes.attempted` is 3 and `answered` is 2 |

Two files because one run cannot carry both robots cases: the producer fills
`blockedAi` only after a successful fetch. `producer-shapes.test.ts` runs every
per-shape assertion over all seven, then asserts what a reader sees on each
adverse branch. `failed-stages.test.ts` covers "ran and failed" against "never
ran" in every other section, from these fixtures with one stage swapped.

The adverse files are the generator's raw bytes, not prettier-formatted like
the five: `.prettierignore` already skips them.
