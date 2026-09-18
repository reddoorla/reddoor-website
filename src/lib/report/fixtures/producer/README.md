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

Then `pnpm format` here — prettier owns the formatting of every checked-in file,
including these, and the generator writes plain `JSON.stringify` output.

Regenerate them that way when the producer changes; do not edit them by hand.
The business is fictional and the URL is on a reserved TLD, so nothing here can
be mistaken for a prospect. `generatedAt` is frozen by the script so a
regeneration diff stays readable.

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
