import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toReportView, type Fix, type ReportView } from "./model";
import type { AuditReport } from "./fetch";

/**
 * `toReportView` over payloads the PRODUCER wrote, one per stored shape.
 *
 * Every other test in this directory builds its input by hand, so none of them
 * had ever seen a payload reddoor-maintenance actually emits. That is what let
 * `agentAccess` be read off the CHECKS stage — it lives on CRAWL — and print
 * "all 0 of the crawlers we checked are allowed in" on every report for a
 * fortnight: a hand-written fixture agrees with whatever the consumer believes
 * about the shape, so the two were wrong together and nothing could notice.
 *
 * The fixtures are generated offline by `scripts/gen-report-shapes.mts` in
 * reddoor-maintenance — see `fixtures/producer/README.md` for the command and
 * for what the five shapes are.
 *
 * HOW THESE ASSERTIONS ARE WRITTEN, and why it matters. Nothing below hard-codes
 * a number. Each one reads the value out of the raw payload BY ITS PATH and
 * compares it with what the view exposes, so the test states where a field comes
 * from rather than what it happened to be on the day the fixture was captured.
 * That is the shape of assertion the `agentAccess` defect needed: the count is
 * only correct if it was taken from `crawl.data.agentAccess`, and any other
 * source makes it disagree.
 *
 * THE TRAP IN THAT STYLE, which this file walked into and now guards against.
 * `toReportView` SPREADS several of these structures through unchanged, so
 * `at(raw, "…fixes.0.title")` and `view.fixes[0].title` are the same property
 * read twice. Rename `title` in the producer and both sides become `undefined`
 * and still match. Where the producer's value passes through untouched, the
 * comparison proves the pass-through and nothing else, so every such assertion
 * below is preceded by a check that the raw path EXISTS with the right type —
 * that part is what a rename reds. Where a fixture makes the two sides equal by
 * accident rather than by construction, the degeneracy is recorded as a named
 * test in "known coverage gaps" rather than left to be rediscovered.
 *
 * `AuditReport` stays `Record<string, unknown>` (see fetch.ts — the real type
 * needs a dependency bump this repo has deliberately deferred), so the raw
 * payload is navigated through a small typed accessor rather than a cast per
 * line.
 */
const load = (shape: string): AuditReport =>
  JSON.parse(
    readFileSync(`src/lib/report/fixtures/producer/${shape}.json`, "utf-8"),
  ) as AuditReport;

/** `a.b.c` out of the raw payload, or undefined at the first missing step. */
const at = (raw: AuditReport, path: string): unknown =>
  path.split(".").reduce<unknown>((node, key) => {
    if (!node || typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[key];
  }, raw);

const list = (raw: AuditReport, path: string): unknown[] => {
  const value = at(raw, path);
  return Array.isArray(value) ? value : [];
};

/** The same, one level down: every element of a raw list as a bag of fields. */
const rows = (raw: AuditReport, path: string): Record<string, unknown>[] =>
  list(raw, path) as Record<string, unknown>[];

/**
 * A field the view carries through `toReportView`'s spread but that the `Fix`
 * type does not declare. `addresses` is the only one today: the producer writes
 * it, the spread passes it on, and nothing renders it yet.
 */
const carried = (fix: Fix, key: string): unknown => (fix as Record<string, unknown>)[key];

const nonEmptyString = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const SHAPES = ["11111111", "11100001", "11000001", "10000001", "00000000"] as const;

/**
 * The bit-string is the specification — see the README's table. Bit 7 (index 6)
 * is `fix.addresses`, so it is the shape string itself that says whether a fix
 * in this era should carry that field, not an observation of the fixture.
 */
const carriesFixAddresses = (shape: string): boolean => shape[6] === "1";

/**
 * NOTHING IS BUILT IN A `describe` BODY.
 *
 * `toReportView` used to be called where these two memos are declared, which
 * made a throw from it a COLLECTION error: vitest reports the file as failing
 * to load, no test is named, and the run says nothing about which shape did it.
 * "An old payload renders as a report with gaps rather than throwing" is one of
 * the claims this file exists to make, and a claim whose failure has no name is
 * not being tested. Everything below is built inside a test.
 */
const rawCache = new Map<string, AuditReport>();
const rawFor = (shape: string): AuditReport => {
  const cached = rawCache.get(shape);
  if (cached) return cached;
  const built = load(shape);
  rawCache.set(shape, built);
  return built;
};

const viewCache = new Map<string, ReportView>();
const viewFor = (shape: string): ReportView => {
  const cached = viewCache.get(shape);
  if (cached) return cached;
  const built = toReportView(rawFor(shape));
  viewCache.set(shape, built);
  return built;
};

describe.each(SHAPES)("a producer payload of shape %s", (shape) => {
  it("renders as a report rather than throwing", () => {
    expect(() => toReportView(rawFor(shape))).not.toThrow();
  });

  it("carries the report's own identity through", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    expect(view.url).toBe(at(raw, "url"));
    expect(view.businessName).toBe(at(raw, "businessName"));
    expect(view.generatedAt).toBe(at(raw, "generatedAt"));
  });

  it("takes every score from the producer's own scores block", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    expect(view.scores.findability).toBe(at(raw, "scores.findability"));
    expect(view.scores.readability).toBe(at(raw, "scores.readability"));
    expect(view.scores.answers).toBe(at(raw, "scores.answers"));
    expect(view.scores.aiVisibility).toBe(at(raw, "scores.aiVisibility"));
  });

  /**
   * THE HIGH-1 CLASS. `agentAccess` is one entry per agent in crawl.ts's
   * ALL_AGENTS and lives on the CRAWL stage. Read off `checks` — where the
   * optional field was invented, so the compiler had nothing to object to —
   * this count is 0 on every report ever stored.
   */
  it("counts the crawlers from crawl.data.agentAccess, not from checks", () => {
    const agents = list(rawFor(shape), "crawl.data.agentAccess");
    expect(agents.length).toBeGreaterThan(0);
    expect(viewFor(shape).crawlerReach?.checked).toBe(agents.length);
  });

  it("reports the crawler verdict from the checks stage that measured it", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    // Both of the comparisons below normalise a missing value: `=== true`
    // turns undefined into false, `?? []` turns it into an empty array — and
    // `toReportView` normalises it the same way, so a renamed producer field
    // agrees with itself. Require the raw paths to exist first; that is the
    // half of this test a rename can fail.
    expect(typeof at(raw, "checks.data.crawlerAccessMeasured")).toBe("boolean");
    expect(Array.isArray(at(raw, "checks.data.crawlerAccess.blockedAi"))).toBe(true);
    expect(view.crawlerReach?.measured).toBe(at(raw, "checks.data.crawlerAccessMeasured") === true);
    expect(view.crawlerReach?.blocked).toEqual(
      at(raw, "checks.data.crawlerAccess.blockedAi") ?? [],
    );
  });

  it("tallies exactly the buyer questions the analyze stage returned", () => {
    const questions = rows(rawFor(shape), "analyze.data.buyerQuestions");
    const tally = viewFor(shape).questionTally;
    expect(questions.length).toBeGreaterThan(0);
    expect(viewFor(shape).buyerQuestions.length).toBe(questions.length);
    // Each bucket against a count of ITS OWN verdict, derived from the raw
    // payload. Asserting only that the four sum to the question count proves
    // they partition the list — which a `yes`/`no` swap in model.ts also does,
    // so that assertion stayed green through exactly the defect it looks like
    // it is watching for.
    const countOf = (verdict: string) => questions.filter((q) => q.answered === verdict).length;
    expect(tally.yes).toBe(countOf("yes"));
    expect(tally.partial).toBe(countOf("partial"));
    expect(tally.no).toBe(countOf("no"));
    expect(tally.unknown).toBe(countOf("unknown"));
  });

  it("has a question distribution in which a swapped bucket would be visible", () => {
    // The per-bucket assertions above only catch a swap when the two buckets
    // hold different numbers. Today's fixtures are yes 2, partial 1, no 3,
    // unknown 4 — non-zero and pairwise distinct, so any swap of any two
    // filters changes a number. This test says so out loud, and reds if a
    // future fixture flattens the distribution and quietly makes the tally
    // test vacuous.
    const questions = rows(rawFor(shape), "analyze.data.buyerQuestions");
    const counts = (["yes", "partial", "no", "unknown"] as const).map((verdict) => ({
      verdict,
      n: questions.filter((q) => q.answered === verdict).length,
    }));
    for (const { verdict, n } of counts) {
      expect(n, `bucket "${verdict}" is empty, so a swap into it is invisible`).toBeGreaterThan(0);
    }
    expect(
      new Set(counts.map((c) => c.n)).size,
      `two buckets hold the same count (${counts.map((c) => `${c.verdict}=${c.n}`).join(", ")}), so swapping them is invisible`,
    ).toBe(counts.length);
  });

  it("carries each buyer question's rendered fields, typed, not just its count", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    const questions = rows(raw, "analyze.data.buyerQuestions");
    expect(questions.length).toBeGreaterThan(0);
    for (const [i, q] of questions.entries()) {
      expect(nonEmptyString(q.question), `buyerQuestions[${i}].question`).toBe(true);
      expect(["yes", "partial", "no", "unknown"], `buyerQuestions[${i}].answered`).toContain(
        q.answered,
      );
      expect(typeof q.quotable, `buyerQuestions[${i}].quotable`).toBe("boolean");
      // `page` and `evidence` are string-or-null BY DESIGN — null is "we have
      // no quote for this", which the table renders as its own line — so the
      // type check has to admit null, and the two counts below keep that from
      // being satisfied by ten nulls.
      expect(q.page === null || typeof q.page === "string", `buyerQuestions[${i}].page`).toBe(true);
      expect(
        q.evidence === null || typeof q.evidence === "string",
        `buyerQuestions[${i}].evidence`,
      ).toBe(true);
    }
    expect(questions.filter((q) => typeof q.page === "string").length).toBeGreaterThan(0);
    expect(questions.filter((q) => typeof q.evidence === "string").length).toBeGreaterThan(0);

    // Only now is equality through the view worth anything.
    expect(view.buyerQuestions.map((q) => q.question)).toEqual(questions.map((q) => q.question));
    expect(view.buyerQuestions.map((q) => q.answered)).toEqual(questions.map((q) => q.answered));
    expect(view.buyerQuestions.map((q) => q.evidence)).toEqual(questions.map((q) => q.evidence));
    expect(view.buyerQuestions.map((q) => q.page)).toEqual(questions.map((q) => q.page));
    expect(view.buyerQuestions.map((q) => q.quotable)).toEqual(questions.map((q) => q.quotable));
  });

  it("does not invent a sitemap count the crawl did not report", () => {
    const raw = rawFor(shape);
    // `present` is what decides the branch, so it is the field a rename would
    // silence: missing, it is falsy, `sitemapUrlCount` is null, and the
    // expression on the right computes null too. Require the path to exist
    // with the right type before trusting the comparison.
    const present = at(raw, "crawl.data.sitemap.present");
    const count = at(raw, "crawl.data.sitemap.urlCount");
    expect(typeof present, "crawl.data.sitemap.present").toBe("boolean");
    expect(typeof count, "crawl.data.sitemap.urlCount").toBe("number");
    expect(viewFor(shape).sitemapUrlCount).toBe(
      present === true && typeof count === "number" ? count : null,
    );
  });

  it("renders every fix the producer ordered, in that order", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    const fixes = rows(raw, "analyze.data.fixes");
    // Every shape's analyze stage carries fixes; an empty list would make
    // every `toEqual` below compare [] with [] and pass on nothing.
    expect(fixes.length).toBeGreaterThan(0);
    for (const [i, fix] of fixes.entries()) {
      expect(nonEmptyString(fix.title), `fixes[${i}].title`).toBe(true);
      expect(nonEmptyString(fix.why), `fixes[${i}].why`).toBe(true);
      expect(["high", "medium", "low"], `fixes[${i}].impact`).toContain(fix.impact);
      expect(["low", "medium", "high"], `fixes[${i}].effort`).toContain(fix.effort);
      expect(["crawl", "content", "technical"], `fixes[${i}].tier`).toContain(fix.tier);
      expect(["measured", "recommendation"], `fixes[${i}].origin`).toContain(fix.origin);
      // `addresses` is bit 7 of the shape string. Assert its ABSENCE in the
      // eras that predate it too, so a generator that started back-filling it
      // into derived shapes would be caught rather than silently widening
      // what these fixtures claim to be.
      if (carriesFixAddresses(shape)) {
        expect(nonEmptyString(fix.addresses), `fixes[${i}].addresses`).toBe(true);
      } else {
        expect(fix.addresses, `fixes[${i}].addresses`).toBeUndefined();
      }
    }
    expect(view.fixes.map((f) => f.title)).toEqual(fixes.map((f) => f.title));
    expect(view.fixes.map((f) => f.why)).toEqual(fixes.map((f) => f.why));
    expect(view.fixes.map((f) => f.impact)).toEqual(fixes.map((f) => f.impact));
    expect(view.fixes.map((f) => f.effort)).toEqual(fixes.map((f) => f.effort));
    expect(view.fixes.map((f) => f.origin)).toEqual(fixes.map((f) => f.origin));
    // `tier` is on the `Fix` type and the producer writes it; nothing renders
    // it yet. It is asserted because the contract carries it, not because a
    // page would break today.
    expect(view.fixes.map((f) => f.tier)).toEqual(fixes.map((f) => f.tier));
    expect(view.fixes.map((f) => carried(f, "addresses"))).toEqual(fixes.map((f) => f.addresses));
  });

  /**
   * The honest denominator behind AI Visibility. `model.ts` reads
   * `probes.data.categoryProbes.attempted` and falls back to the length of the
   * answered-probe array; the comment there records that fallback as a defect
   * that shipped — three dead probes out of five turned "named in 1 of 5" into
   * "named in 1 of 2", and a flakier run read better. Nothing in this file used
   * to read `view.visibility` at all.
   *
   * WHAT THIS CATCHES AND WHAT IT DOES NOT. `attempted` is 3 in every fixture,
   * and so are `answered` and the answered-probe array's length. So this reds
   * on a producer rename (the type check) and on a consumer that derives the
   * total from somewhere with a different value — but it CANNOT tell
   * `attempted` from `answered`, which is the swap the field exists to prevent.
   * That needs a sixth, adverse fixture in which a probe errored; it is in the
   * README's "Known gaps", and recorded as a test below.
   */
  it("takes the visibility denominator from what the run attempted", () => {
    const raw = rawFor(shape);
    const attempted = at(raw, "probes.data.categoryProbes.attempted");
    expect(typeof attempted, "probes.data.categoryProbes.attempted").toBe("number");
    expect(viewFor(shape).visibility?.total).toBe(attempted);
  });

  /**
   * A stage the payload does not carry must become null, never an empty
   * measurement. "We did not measure this" and "we measured this and found
   * nothing" are opposite claims and only one of them is ours to make.
   */
  it("says 'not measured' for every stage this era of the payload lacks", () => {
    const raw = rawFor(shape);
    const view = viewFor(shape);
    const stageRan = (key: string) => at(raw, `${key}.ok`) === true;
    expect(view.assets === null).toBe(!stageRan("assets"));
    expect(view.basics === null).toBe(!stageRan("basics"));
    expect(view.goalFit === null).toBe(!stageRan("goalFit"));
    expect(view.accuracy === null).toBe(!stageRan("accuracy"));
    expect(view.consistency === null).toBe(at(raw, "checks.data.consistency") === undefined);
  });
});

/**
 * WHAT NO FIXTURE EXERCISES.
 *
 * Each test here asserts a degeneracy rather than a behaviour: it records that
 * a branch of `model.ts` is never reached by this corpus, so the assertion that
 * looks like it covers the branch is really comparing a constant with itself.
 * They are written to RED when the gap closes — a sixth, adverse fixture from
 * `gen-report-shapes.mts` in reddoor-maintenance will fail them, and the right
 * response is to delete the test that failed and strengthen its counterpart
 * above. See `fixtures/producer/README.md`, "Known gaps".
 */
describe.each(SHAPES)("known coverage gaps in shape %s", (shape) => {
  it("has no stage that failed, so stage()'s ok:false branch is never taken", () => {
    const raw = rawFor(shape) as Record<string, unknown>;
    const staged = Object.entries(raw).filter(
      ([, value]) => !!value && typeof value === "object" && "ok" in (value as object),
    );
    expect(staged.length).toBeGreaterThan(0);
    // The nulls these fixtures do produce come from a stage KEY being absent,
    // which is a different path through `stage()` than `ok: false`.
    expect(
      staged.filter(([, value]) => (value as { ok?: unknown }).ok !== true).map(([k]) => k),
    ).toEqual([]);
  });

  it("measured crawler access and blocked nothing, so neither adverse branch runs", () => {
    const raw = rawFor(shape);
    expect(at(raw, "checks.data.crawlerAccessMeasured")).toBe(true);
    expect(at(raw, "checks.data.crawlerAccess.blockedAi")).toEqual([]);
  });

  it("carries no sitemap, so sitemapUrlCount's present:true branch never runs", () => {
    // All five carry `{present: false, urlCount: 0}`, so `sitemapUrlCount` is
    // null on every fixture and the assertion that guards it compares null
    // with null five times.
    expect(at(rawFor(shape), "crawl.data.sitemap.present")).toBe(false);
  });

  it("attempted exactly as many category probes as it answered, hiding a swap", () => {
    const raw = rawFor(shape);
    const attempted = at(raw, "probes.data.categoryProbes.attempted");
    expect(at(raw, "probes.data.categoryProbes.answered")).toBe(attempted);
    expect(
      list(raw, "probes.data.answers").filter((a) => (a as { kind?: string }).kind === "category")
        .length,
    ).toBe(attempted);
  });
});

/**
 * What the newest shape carries that the older ones cannot. Split out because
 * these are assertions about the CURRENT producer — running them over the
 * derived older shapes would only re-assert the deletions.
 */
describe("the shape today's producer emits", () => {
  it("reads the accuracy stage the audit stored, answers and all", () => {
    const raw = rawFor("11111111");
    const view = viewFor("11111111");
    expect(view.accuracy?.answersRead).toBe(at(raw, "accuracy.data.answersRead"));
    expect(view.accuracy?.assertions.length).toBe(list(raw, "accuracy.data.assertions").length);
    expect(view.accuracy?.answersRead).toBeGreaterThan(0);
  });

  it("keeps each buyer question's id, which is what pins it to the fixed set", () => {
    const raw = rawFor("11111111");
    const ids = rows(raw, "analyze.data.buyerQuestions").map((q) => q.id);
    expect(ids.every((id) => typeof id === "string")).toBe(true);
    expect(viewFor("11111111").buyerQuestions.map((q) => q.id)).toEqual(ids);
  });

  it("carries the site-check battery and the accessibility summary", () => {
    const view = viewFor("11111111");
    expect(view.siteChecks?.length).toBe(list(rawFor("11111111"), "siteChecks.data").length);
    expect(view.siteChecks?.length).toBeGreaterThan(0);
    expect(view.accessibility).not.toBeNull();
  });

  it("reads the probe answers the visibility number was derived from", () => {
    const view = viewFor("11111111");
    const answers = list(rawFor("11111111"), "probes.data.answers");
    expect(view.categoryProbes.length + view.brandedProbes.length).toBeLessThanOrEqual(
      answers.length,
    );
    expect(answers.length).toBeGreaterThan(0);
  });
});

/**
 * The oldest shape is 53 of the 66 stored reports — the one a prospect is most
 * likely to open — and it predates eight things the page now reads. It must
 * render as a report with gaps, not throw and not fabricate.
 */
describe("the oldest stored shape", () => {
  it("degrades to 'not measured' rather than to zero", () => {
    const view = viewFor("00000000");
    expect(view.accuracy).toBeNull();
    expect(view.goalFit).toBeNull();
    expect(view.assets).toBeNull();
    expect(view.basics).toBeNull();
    expect(view.consistency).toBeNull();
  });

  it("still reports what it does have", () => {
    const view = viewFor("00000000");
    expect(view.url).toBe("https://acme.example/");
    expect(view.crawlerReach?.checked).toBeGreaterThan(0);
    expect(view.buyerQuestions.length).toBeGreaterThan(0);
  });
});
