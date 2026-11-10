import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ssr, renderText } from "./ssr-test-harness";
import {
  failedChecksSentence,
  gapClause,
  stageFailed,
  toReportView,
  type ReportView,
} from "./model";

/**
 * "We ran it and it failed" versus "we never ran it", in every section that
 * can be left empty (#893; the operator chose every section, Tue 11-10).
 *
 * Each payload is a PRODUCER fixture with one stage replaced, never a
 * hand-built report: a failure is `{ok: false, error}` exactly as
 * reddoor-maintenance's `stage()` wraps a throw, and a skip carries one of
 * the producer's exported skip messages. `producer-shapes.test.ts` covers the
 * one failure a real offline run produces (the accuracy stage, in
 * `adverse-unmeasured.json`); this file covers the rest.
 *
 * SiteHealth and Standing import sibling components, which `ssr()` cannot
 * compile, so their copy is asserted through `gapClause`, the function both
 * render. GoalFit and the print sheet are rendered.
 */
type Raw = Record<string, unknown>;

const producer = (shape: string): Raw =>
  JSON.parse(readFileSync(`src/lib/report/fixtures/producer/${shape}.json`, "utf-8")) as Raw;

/** What the producer's `stage()` writes when the stage throws. */
const FAILED = { ok: false, error: "fetch failed" };

const withStages = (shape: string, stages: Record<string, unknown>): Raw => {
  const raw = producer(shape);
  for (const [key, value] of Object.entries(stages)) {
    if (value === undefined) delete raw[key];
    else raw[key] = value;
  }
  return raw;
};

const words = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const goalFit = await ssr<{ view: ReportView }>("src/lib/report/GoalFit.svelte");
const printSheet = await ssr<{ data: { report: unknown; overrides: unknown } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);
const printed = (raw: Raw): string =>
  words(renderText(printSheet, { data: { report: raw, overrides: {} } }));

/** Every stage a health row reads (health.ts): journey, consistency and the
 *  viewport come off `checks`. */
const HEALTH = ["checks", "basics", "assets", "siteChecks"] as const;

describe("which stages count as ran-and-failed", () => {
  it("counts a stage whose error is not one of the producer's skips", () => {
    const view = toReportView(withStages("11111111", { basics: FAILED }));
    expect(view.failedStages).toEqual(["basics"]);
    expect(stageFailed(view, ...HEALTH)).toBe(true);
  });

  it("does not count a stage the producer skipped on purpose", () => {
    const view = toReportView(
      withStages("11111111", {
        probes: { ok: false, error: "skipped (--no-probes)" },
        accuracy: { ok: false, error: "skipped — no branded answers to check" },
        goalFit: { ok: false, error: "no goal supplied and none could be inferred" },
        assets: { ok: false, error: "skipped — the checks stage failed" },
      }),
    );
    expect(view.failedStages).toEqual([]);
  });

  it("does not count a stage this era of the payload lacks", () => {
    expect(toReportView(producer("00000000")).failedStages).toEqual([]);
  });
});

describe("the opening clause of an empty section", () => {
  it("says the site-health checks ran and failed when one of them did", () => {
    const view = toReportView(
      withStages("11111111", { basics: FAILED, assets: undefined, siteChecks: undefined }),
    );
    expect(gapClause(view, [...HEALTH], "These checks", true)).toBe(
      "These checks ran on this audit and failed before they returned a result",
    );
  });

  it("says they did not run when none of them is in the payload", () => {
    const view = toReportView(
      withStages("11111111", { basics: undefined, assets: undefined, siteChecks: undefined }),
    );
    expect(gapClause(view, [...HEALTH], "These checks", true)).toBe(
      "These checks did not run on this audit",
    );
  });

  it("says the visibility test ran and failed, and did not run when it was turned off", () => {
    const failed = toReportView(
      withStages("11111111", {
        probes: { ok: false, error: "no visibility engine returned an answer" },
      }),
    );
    const off = toReportView(
      withStages("11111111", { probes: { ok: false, error: "skipped (--no-probes)" } }),
    );
    expect(gapClause(failed, ["probes"], "The visibility test")).toBe(
      "The visibility test ran on this audit and failed before it returned a result",
    );
    expect(gapClause(off, ["probes"], "The visibility test")).toBe(
      "The visibility test did not run on this audit",
    );
  });
});

describe("GoalFit, rendered", () => {
  it("says the goal check ran and failed", () => {
    const view = toReportView(withStages("11111111", { goalFit: FAILED }));
    const text = words(renderText(goalFit, { view }));
    expect(text).toContain("This check ran on this audit and failed before it returned a result.");
    expect(text).not.toContain("did not run");
  });

  it("says it did not run when the producer could not resolve a goal", () => {
    const view = toReportView(
      withStages("11111111", {
        goalFit: { ok: false, error: "no goal supplied and none could be inferred" },
      }),
    );
    const text = words(renderText(goalFit, { view }));
    expect(text).toContain("This check did not run on this audit.");
    expect(text).not.toContain("failed");
  });
});

describe("the print sheet's 'Does it work'", () => {
  /**
   * With no health row at all, this printed "Every check on whether the site
   * works came back clean", for a run whose checks failed and for an era that
   * never ran them. Both are an all-clear we never measured.
   */
  it("never prints an all-clear when the checks ran and failed", () => {
    const text = printed(
      withStages("11111111", {
        checks: FAILED,
        // What the producer writes for assets once checks has failed.
        assets: { ok: false, error: "skipped — the checks stage failed" },
        basics: FAILED,
        siteChecks: FAILED,
      }),
    );
    expect(text).toContain(
      "These checks ran on this audit and failed before they returned a result.",
    );
    expect(text).not.toContain("came back clean");
  });

  it("never prints an all-clear when the checks never ran", () => {
    const text = printed(
      withStages("11111111", {
        checks: undefined,
        basics: undefined,
        assets: undefined,
        siteChecks: undefined,
      }),
    );
    expect(text).toContain("These checks did not run on this audit.");
    expect(text).not.toContain("came back clean");
  });
});

describe("the method section's list of failed checks", () => {
  it("names every stage that failed, and is absent on a clean run", () => {
    const view = toReportView(withStages("11111111", { probes: FAILED, goalFit: FAILED }));
    expect(failedChecksSentence(view)).toBe(
      "The visibility test and the goal check ran on this audit and failed before returning a result. That is a gap in our measurement, not a finding about your site.",
    );
    expect(failedChecksSentence(toReportView(producer("11111111")))).toBeNull();
    expect(failedChecksSentence(toReportView(producer("00000000")))).toBeNull();
  });

  it("is printed for the producer's own failed run", () => {
    expect(printed(producer("adverse-unmeasured"))).toContain(
      "The check of what the assistant says about you ran on this audit and failed before returning a result.",
    );
  });
});
