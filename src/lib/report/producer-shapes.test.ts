import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toReportView, type Fix, type ReportView } from "./model";
import type { AuditReport } from "./fetch";
import type { Component } from "svelte";
import { ssr, renderText } from "./ssr-test-harness";

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
 * that part is what a rename reds. Where the five make the two sides equal by
 * accident rather than by construction, the two adverse fixtures break the tie;
 * their own blocks below say which value each one carries.
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
 * Two more runs of TODAY's producer, over stubbed dependencies chosen so the
 * values that pick a branch take the branch the five never reach (#893): a
 * stage that ran and failed, an unmeasured robots.txt, one that turns GPTBot
 * away, a sitemap with a real count, and a category probe that died. See the
 * README's "The adverse shapes". Two files because one run cannot carry both
 * robots cases: the producer fills `blockedAi` only after a successful fetch.
 */
const ADVERSE = ["adverse-unmeasured", "adverse-blocked"] as const;
const ALL = [...SHAPES, ...ADVERSE] as const;

/**
 * The bit-string is the specification — see the README's table. Bit 7 (index 6)
 * is `fix.addresses`, so it is the shape string itself that says whether a fix
 * in this era should carry that field, not an observation of the fixture. The
 * adverse files are today's era, all eight bits set.
 */
const bitsOf = (shape: string): string => (shape.startsWith("adverse-") ? "11111111" : shape);
const carriesFixAddresses = (shape: string): boolean => bitsOf(shape)[6] === "1";

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

describe.each(ALL)("a producer payload of shape %s", (shape) => {
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
      // The producer's type is `addresses?: string | null`: a measured fix
      // that answers no checklist row (measured-fixes.ts, e.g. "Let GPTBot read
      // your site") writes null. The five carry none of those; adverse-blocked
      // does. At least one string per payload, below, still proves the bit.
      if (carriesFixAddresses(shape)) {
        expect(
          fix.addresses === null || nonEmptyString(fix.addresses),
          `fixes[${i}].addresses`,
        ).toBe(true);
      } else {
        expect(fix.addresses, `fixes[${i}].addresses`).toBeUndefined();
      }
    }
    if (carriesFixAddresses(shape)) {
      expect(fixes.filter((f) => nonEmptyString(f.addresses)).length).toBeGreaterThan(0);
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
   * In the five shapes `attempted`, `answered` and the answered-probe array's
   * length are all 3, so there this reds only on a rename or a source with a
   * different value. In the adverse shapes a probe died (3 attempted, 2
   * answered), which is what tells `attempted` from `answered` and from the
   * array-length fallback; "a category probe that died" below asserts the
   * sentence a reader sees.
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
 * WHAT THE ADVERSE SHAPES PROVE, as a reader of the report sees it.
 *
 * Each `describe` below first checks that the fixture really carries the value
 * it is named for (the precondition: a regeneration that lost it would make the
 * rest compare a constant with itself, which is what the gap tests these replace
 * used to record). Then it renders the component a prospect reads and
 * asserts the sentence. Every expected number is read out of the raw payload by
 * its path, never typed.
 */
const sourceCheck = await ssr<{ view: ReportView }>("src/lib/report/SourceCheck.svelte");
const scoreBars = await ssr<{ view: ReportView }>("src/lib/report/ScoreBars.svelte");
const printSheet = await ssr<{ data: { report: unknown; overrides: unknown } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

/** Rendered HTML down to the words a reader sees. */
const words = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&rsquo;/g, "’")
    .replace(/\s+/g, " ")
    .trim();
const read = (component: Component<{ view: ReportView }>, shape: string): string =>
  words(renderText(component, { view: viewFor(shape) }));
const printed = (shape: string): string =>
  words(renderText(printSheet, { data: { report: rawFor(shape), overrides: {} } }));

describe("a stage that ran and failed", () => {
  it("is in the adverse fixture as the producer writes it: ok false, with the error", () => {
    const raw = rawFor("adverse-unmeasured");
    expect(at(raw, "accuracy.ok")).toBe(false);
    expect(nonEmptyString(at(raw, "accuracy.error"))).toBe(true);
    // The check had its input: branded answers were captured, whole. So "no
    // answer was captured" would be a false reason, not a cautious one.
    const branded = rows(raw, "probes.data.answers").filter((a) => a.kind === "branded");
    expect(branded.filter((a) => nonEmptyString(a.fullAnswer)).length).toBeGreaterThan(0);
  });

  it("is told apart from a stage this era never ran", () => {
    expect(viewFor("adverse-unmeasured").failedStages).toContain("accuracy");
    // The oldest shape carries no accuracy key at all: never ran, not failed.
    expect(at(rawFor("00000000"), "accuracy")).toBeUndefined();
    expect(viewFor("00000000").failedStages).not.toContain("accuracy");
    // And a run where every stage succeeded fails nothing.
    expect(viewFor("11111111").failedStages).toEqual([]);
  });

  it("still never reads as a measurement", () => {
    expect(viewFor("adverse-unmeasured").accuracy).toBeNull();
  });

  it("says the check ran and failed, and never that no answer was captured", () => {
    const text = read(sourceCheck, "adverse-unmeasured");
    expect(text).toContain("ran and failed");
    expect(text).not.toContain("was captured to check against");
    expect(text).toContain("That is a gap in the measurement, not a finding about your site.");
  });

  it("keeps 'no answer was captured' for the era that never ran the check", () => {
    const text = read(sourceCheck, "00000000");
    expect(text).toContain("was captured to check against");
    expect(text).not.toContain("ran and failed");
  });

  it("is named in the print sheet's method section, and nowhere for a clean run", () => {
    expect(printed("adverse-unmeasured")).toMatch(/ran on this audit and failed/);
    expect(printed("11111111")).not.toMatch(/ran on this audit and failed/);
    expect(printed("00000000")).not.toMatch(/ran on this audit and failed/);
  });
});

describe("a robots.txt we could not read", () => {
  it("is in the adverse fixture: the fetch failed, so nothing was measured", () => {
    const raw = rawFor("adverse-unmeasured");
    expect(at(raw, "checks.data.crawlerAccessMeasured")).toBe(false);
    expect(nonEmptyString(at(raw, "crawl.data.sidecarErrors.robots"))).toBe(true);
  });

  it("is reported as unmeasured, never as an all-clear", () => {
    expect(viewFor("adverse-unmeasured").crawlerReach?.measured).toBe(false);
    const text = read(scoreBars, "adverse-unmeasured");
    expect(text).toContain("We could not check.");
    expect(text).toContain("The robots.txt fetch itself failed");
    expect(text).not.toContain("turns away none");
  });

  /**
   * A payload whose checks stage predates the field. Derived from the producer
   * fixture by deleting exactly that key, the way the five shapes are derived.
   * `=== true` is what makes the missing field read as `false`, not
   * `undefined`; anything looser lets an unknown pass as measured.
   */
  it("reads as unmeasured when the field is missing altogether", () => {
    const raw = structuredClone(rawFor("adverse-unmeasured")) as Record<string, unknown>;
    delete (at(raw, "checks.data") as Record<string, unknown>).crawlerAccessMeasured;
    const view = toReportView(raw);
    expect(view.crawlerReach?.measured).toBe(false);
    expect(words(renderText(scoreBars, { view }))).toContain("We could not check.");
  });
});

describe("a robots.txt that turns an AI crawler away", () => {
  it("is in the adverse fixture: measured, with GPTBot blocked", () => {
    const raw = rawFor("adverse-blocked");
    expect(at(raw, "checks.data.crawlerAccessMeasured")).toBe(true);
    expect(list(raw, "checks.data.crawlerAccess.blockedAi").length).toBeGreaterThan(0);
  });

  it("names every blocked crawler the checks stage measured", () => {
    const blocked = list(rawFor("adverse-blocked"), "checks.data.crawlerAccess.blockedAi");
    expect(viewFor("adverse-blocked").crawlerReach?.blocked).toEqual(blocked);
    const text = read(scoreBars, "adverse-blocked");
    expect(text).toContain(`It turns away ${blocked.join(", ")}.`);
    expect(text).not.toContain("We could not check.");
  });
});

describe("a sitemap the crawl found", () => {
  it("is in the adverse fixture: present, listing more URLs than the crawl read", () => {
    const raw = rawFor("adverse-blocked");
    expect(at(raw, "crawl.data.sitemap.present")).toBe(true);
    const count = at(raw, "crawl.data.sitemap.urlCount");
    expect(typeof count).toBe("number");
    expect(count as number).toBeGreaterThan(at(raw, "accuracy.data.pagesTotal") as number);
  });

  it("is reported as the sitemap's count, beside, not instead of, the pages we crawled", () => {
    const raw = rawFor("adverse-blocked");
    const count = at(raw, "crawl.data.sitemap.urlCount") as number;
    const crawled = at(raw, "accuracy.data.pagesTotal") as number;
    const read_ = at(raw, "accuracy.data.pagesRead") as number;
    expect(viewFor("adverse-blocked").sitemapUrlCount).toBe(count);
    const sentence = `We read ${read_} of the ${crawled} pages we crawled for this check; your sitemap lists ${count}.`;
    expect(read(sourceCheck, "adverse-blocked")).toContain(sentence);
    expect(printed("adverse-blocked")).toContain(sentence);
  });

  it("prints no sitemap count for a payload whose sitemap was absent", () => {
    for (const shape of SHAPES) {
      expect(at(rawFor(shape), "crawl.data.sitemap.present"), shape).toBe(false);
      expect(read(sourceCheck, shape), shape).not.toContain("your sitemap lists");
    }
  });
});

describe("a category probe that died", () => {
  it("is in both adverse fixtures: attempted is more than answered", () => {
    for (const shape of ADVERSE) {
      const raw = rawFor(shape);
      const attempted = at(raw, "probes.data.categoryProbes.attempted") as number;
      const answered = at(raw, "probes.data.categoryProbes.answered") as number;
      const answers = list(raw, "probes.data.answers").filter(
        (a) => (a as { kind?: string }).kind === "category",
      ).length;
      expect(typeof attempted, shape).toBe("number");
      expect(attempted, shape).toBeGreaterThan(answered);
      expect(answers, shape).toBe(answered);
    }
  });

  it("counts against what was asked, in the view and in print", () => {
    for (const shape of ADVERSE) {
      const raw = rawFor(shape);
      const attempted = at(raw, "probes.data.categoryProbes.attempted") as number;
      const answered = at(raw, "probes.data.categoryProbes.answered") as number;
      const named = viewFor(shape).visibility?.named;
      expect(viewFor(shape).visibility?.total, shape).toBe(attempted);
      // The print sheet is the surface the harness can render: Standing.svelte
      // imports a sibling component, which `ssr()` does not compile.
      expect(printed(shape), shape).toContain(`Named in ${named} of ${attempted} buyer searches.`);
      expect(printed(shape), shape).not.toContain(`of ${answered} buyer searches`);
    }
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
