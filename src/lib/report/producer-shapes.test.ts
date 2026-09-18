import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { toReportView } from "./model";
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

const SHAPES = ["11111111", "11100001", "11000001", "10000001", "00000000"] as const;

describe.each(SHAPES)("a producer payload of shape %s", (shape) => {
  const raw = load(shape);
  const view = toReportView(raw);

  it("carries the report's own identity through", () => {
    expect(view.url).toBe(at(raw, "url"));
    expect(view.businessName).toBe(at(raw, "businessName"));
    expect(view.generatedAt).toBe(at(raw, "generatedAt"));
  });

  it("takes every score from the producer's own scores block", () => {
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
    const agents = list(raw, "crawl.data.agentAccess");
    expect(agents.length).toBeGreaterThan(0);
    expect(view.crawlerReach?.checked).toBe(agents.length);
  });

  it("reports the crawler verdict from the checks stage that measured it", () => {
    expect(view.crawlerReach?.measured).toBe(at(raw, "checks.data.crawlerAccessMeasured") === true);
    expect(view.crawlerReach?.blocked).toEqual(
      at(raw, "checks.data.crawlerAccess.blockedAi") ?? [],
    );
  });

  it("tallies exactly the buyer questions the analyze stage returned", () => {
    const questions = list(raw, "analyze.data.buyerQuestions");
    const tally = view.questionTally;
    expect(view.buyerQuestions.length).toBe(questions.length);
    expect(tally.yes + tally.partial + tally.no + tally.unknown).toBe(questions.length);
  });

  it("does not invent a sitemap count the crawl did not report", () => {
    const present = at(raw, "crawl.data.sitemap.present") === true;
    const count = at(raw, "crawl.data.sitemap.urlCount");
    expect(view.sitemapUrlCount).toBe(present && typeof count === "number" ? count : null);
  });

  it("renders every fix the producer ordered, in that order", () => {
    const titles = list(raw, "analyze.data.fixes").map((f) => (f as { title: string }).title);
    expect(view.fixes.map((f) => f.title)).toEqual(titles);
  });

  /**
   * A stage the payload does not carry must become null, never an empty
   * measurement. "We did not measure this" and "we measured this and found
   * nothing" are opposite claims and only one of them is ours to make.
   */
  it("says 'not measured' for every stage this era of the payload lacks", () => {
    const stageRan = (key: string) => at(raw, `${key}.ok`) === true;
    expect(view.assets === null).toBe(!stageRan("assets"));
    expect(view.basics === null).toBe(!stageRan("basics"));
    expect(view.goalFit === null).toBe(!stageRan("goalFit"));
    expect(view.accuracy === null).toBe(!stageRan("accuracy"));
    expect(view.consistency === null).toBe(at(raw, "checks.data.consistency") === undefined);
  });
});

/**
 * What the newest shape carries that the older ones cannot. Split out because
 * these are assertions about the CURRENT producer — running them over the
 * derived older shapes would only re-assert the deletions.
 */
describe("the shape today's producer emits", () => {
  const raw = load("11111111");
  const view = toReportView(raw);

  it("reads the accuracy stage the audit stored, answers and all", () => {
    expect(view.accuracy?.answersRead).toBe(at(raw, "accuracy.data.answersRead"));
    expect(view.accuracy?.assertions.length).toBe(list(raw, "accuracy.data.assertions").length);
    expect(view.accuracy?.answersRead).toBeGreaterThan(0);
  });

  it("keeps each buyer question's id, which is what pins it to the fixed set", () => {
    const ids = list(raw, "analyze.data.buyerQuestions").map((q) => (q as { id?: string }).id);
    expect(ids.every((id) => typeof id === "string")).toBe(true);
    expect(view.buyerQuestions.map((q) => q.id)).toEqual(ids);
  });

  it("carries the site-check battery and the accessibility summary", () => {
    expect(view.siteChecks?.length).toBe(list(raw, "siteChecks.data").length);
    expect(view.siteChecks?.length).toBeGreaterThan(0);
    expect(view.accessibility).not.toBeNull();
  });

  it("reads the probe answers the visibility number was derived from", () => {
    const answers = list(raw, "probes.data.answers");
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
  const view = toReportView(load("00000000"));

  it("degrades to 'not measured' rather than to zero", () => {
    expect(view.accuracy).toBeNull();
    expect(view.goalFit).toBeNull();
    expect(view.assets).toBeNull();
    expect(view.basics).toBeNull();
    expect(view.consistency).toBeNull();
  });

  it("still reports what it does have", () => {
    expect(view.url).toBe("https://acme.example/");
    expect(view.crawlerReach?.checked).toBeGreaterThan(0);
    expect(view.buyerQuestions.length).toBeGreaterThan(0);
  });
});
