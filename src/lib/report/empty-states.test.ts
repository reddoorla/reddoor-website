import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render } from "svelte/server";
import type { Component } from "svelte";
import { ssr, renderText } from "./ssr-test-harness";
import {
  sourceCheckHasStatements,
  sourceCheckMeasured,
  type Assertion,
  type ReportView,
} from "./model";

/**
 * The empty states that printed OUR measurement gap as THEIR score.
 *
 * All of them are template structure rather than a function, so this file
 * renders the component instead of asserting on its source text. The compile
 * step lives in `ssr-test-harness.ts`, shared with citation-runs.test.ts, so
 * the property under test here is the rendered HTML — the thing a reader
 * actually saw.
 */
type MeterProps = { yes: number; partial: number; no: number; unknown: number };
type ViewProps = { view: ReportView };

const meter = await ssr<MeterProps>("QuestionMeter");

const html = (props: MeterProps): string => render(meter, { props }).body;

describe("QuestionMeter — the all-unknown report", () => {
  /**
   * A truncated analyze response yields the full question set with no verdict
   * on any of them. The section then rendered a heading, a red rule and a blank
   * gap: "that is a gap in our measurement" was suppressed at exactly the
   * moment it was the only true thing the section had to say.
   */
  it("says the questions could not be judged when none of them were", () => {
    const body = html({ yes: 0, partial: 0, no: 0, unknown: 5 });
    expect(body).toContain("None of the 5 questions we asked could be judged on this audit");
    expect(body).toContain("that is a gap in our measurement, not a finding about your site");
  });

  it("says it in the singular for a one-question set", () => {
    const body = html({ yes: 0, partial: 0, no: 0, unknown: 1 });
    expect(body).toContain("The one question we asked could not be judged on this audit");
    expect(body).toContain("that is a gap in our measurement, not a finding about your site");
  });

  it("does not print a bar or a legend it has nothing to proportion", () => {
    const body = html({ yes: 0, partial: 0, no: 0, unknown: 5 });
    expect(body).not.toContain('role="img"');
    expect(body).not.toContain("Answered clearly");
    expect(body).not.toContain("NaN");
  });

  it("does not claim the unjudged questions are 'not counted above' with nothing above", () => {
    const body = html({ yes: 0, partial: 0, no: 0, unknown: 5 });
    expect(body).not.toContain("not counted above");
  });

  it("renders nothing at all when there were no questions of either kind", () => {
    expect(html({ yes: 0, partial: 0, no: 0, unknown: 0 }).replace(/<!--.*?-->/g, "")).toBe("");
  });

  // POSITIVE CONTROL — passes before and after the fix. A meter that can only
  // ever render the empty state is not a fix, it is a different defect.
  it("still renders the bar, the legend and all three counts on a mixed set", () => {
    const body = html({ yes: 3, partial: 1, no: 2, unknown: 1 });
    expect(body).toContain('role="img"');
    expect(body).toContain(
      "Of 6 questions buyers ask, 3 are answered clearly, 1 partly, and 2 not at all.",
    );
    for (const label of ["Answered clearly", "Partly answered", "Not answered at all"]) {
      expect(body).toContain(label);
    }
    expect(body).toContain("width: 50%");
    expect(body).toContain("One further question could not be judged");
    expect(body).toContain("not counted above");
  });
});

/**
 * One question — "did we have an assistant answer to take apart?" — asked by
 * four surfaces. The lede above `SourceCheck` answered it `true` unconditionally
 * while `SourceCheck` itself answered `false`, so the 53 reports stored before
 * the accuracy stage existed printed "We asked an AI assistant about X and took
 * its answer apart statement by statement" directly above "We could not check
 * this on this audit". Two adjacent paragraphs, one of them a claim about work
 * we did not do.
 *
 * There is a SECOND question under the first, and the lede needs that one:
 * having read an answer is not the same as having found a statement in it. See
 * `sourceCheckHasStatements`.
 *
 * The remedy is the one PR #152 applied to `wasNamed`: one exported predicate,
 * and a test that no surface re-derives it. The source-text assertions follow
 * named-consistency.test.ts — but on their own they are blind to which way
 * round the conditional is, so the states are rendered below as well.
 */
const viewWith = (accuracy: ReportView["accuracy"]): ReportView =>
  ({
    accuracy,
    businessName: "Acme Co",
    namesake: null,
    sitemapUrlCount: null,
  }) as unknown as ReportView;

const assertion = (verdict: Assertion["verdict"] = "confirmed"): Assertion =>
  ({
    claim: "Acme Co is registered in Texas",
    verdict,
    engineQuote: "Acme Co is registered in Texas.",
    siteQuote: null,
    unverifiedReason: null,
    nearbyMention: null,
    sourceDomains: [],
    query: "who is Acme Co",
    engine: "test",
  }) as Assertion;

const accuracyWith = (answersRead: number, assertions: Assertion[] = []): ReportView["accuracy"] =>
  ({
    assertions,
    sources: [],
    siteFullyRead: true,
    pagesRead: 1,
    pagesTotal: 1,
    answersRead,
    conflation: { detected: false, otherNames: [], engineQuote: null },
  }) as unknown as ReportView["accuracy"];

describe("sourceCheckMeasured — the single verdict on whether the check ran", () => {
  it("is false when the stored report predates the accuracy stage", () => {
    expect(sourceCheckMeasured(viewWith(null))).toBe(false);
  });

  it("is false when the stage ran but read no answer", () => {
    expect(sourceCheckMeasured(viewWith(accuracyWith(0)))).toBe(false);
  });

  // POSITIVE CONTROL — the ordinary report, true before and after.
  it("is true when at least one answer was read", () => {
    expect(sourceCheckMeasured(viewWith(accuracyWith(1)))).toBe(true);
  });
});

/**
 * The stricter question, exhaustively. `answersRead` and `assertions.length`
 * are independent, so all four corners are stated rather than the two that
 * happen to occur most.
 */
describe("sourceCheckHasStatements — whether the check came back holding a statement", () => {
  it("is false when the stored report predates the accuracy stage", () => {
    expect(sourceCheckHasStatements(viewWith(null))).toBe(false);
  });

  it("is false when the stage ran, read no answer and has no statement", () => {
    expect(sourceCheckHasStatements(viewWith(accuracyWith(0)))).toBe(false);
  });

  it("is false when nothing was read, whatever a stored statement claims", () => {
    expect(sourceCheckHasStatements(viewWith(accuracyWith(0, [assertion()])))).toBe(false);
  });

  // The state this predicate exists for: answers were read, and nothing
  // checkable came out of them.
  it("is false when answers were read but no statement came out of them", () => {
    expect(sourceCheckHasStatements(viewWith(accuracyWith(3)))).toBe(false);
  });

  // POSITIVE CONTROLS — the ordinary report. A predicate that can only ever
  // return false is not a fix.
  it("is true when an answer was read and a statement came out of it", () => {
    expect(sourceCheckHasStatements(viewWith(accuracyWith(1, [assertion()])))).toBe(true);
  });

  it("is true across several answers and several statements", () => {
    const acc = accuracyWith(3, [assertion(), assertion("contradicted")]);
    expect(sourceCheckHasStatements(viewWith(acc))).toBe(true);
  });
});

/**
 * RENDERED, not grepped. Every source-text assertion in this file passes
 * unchanged if the conditional guarding the lede is inverted; these do not.
 */
const lede = await ssr<ViewProps>("SourceCheckLede");
const sourceCheck = await ssr<ViewProps>("SourceCheck");

const text = (component: Component<ViewProps>, view: ReportView): string =>
  renderText(component, { view });

const LEDE_SENTENCE = "We asked an AI assistant about Acme Co and took its answer apart";
const NO_CHECK = "We could not check this on this audit";
const NO_STATEMENT = "could not pull a checkable statement out of";

describe("SourceCheck — what the section says when it has nothing", () => {
  it("says the check did not happen when the report predates the stage", () => {
    expect(text(sourceCheck, viewWith(null))).toContain(NO_CHECK);
  });

  it("says the check did not happen when the stage read no answer", () => {
    expect(text(sourceCheck, viewWith(accuracyWith(0)))).toContain(NO_CHECK);
  });

  it("says the answers held no checkable statement when they did not", () => {
    const body = text(sourceCheck, viewWith(accuracyWith(3)));
    expect(body).toContain("We read 3 answers about Acme Co");
    expect(body).toContain(NO_STATEMENT);
    // Never the measurement-gap line: we DID read the answers.
    expect(body).not.toContain(NO_CHECK);
  });

  it("says it in the singular for a single answer", () => {
    const body = text(sourceCheck, viewWith(accuracyWith(1)));
    expect(body).toContain("We read one answer about Acme Co");
    expect(body).toContain(NO_STATEMENT);
  });

  // POSITIVE CONTROL — the ordinary report reaches neither empty state.
  it("prints neither empty state once a statement exists", () => {
    const body = text(sourceCheck, viewWith(accuracyWith(2, [assertion()])));
    expect(body).not.toContain(NO_CHECK);
    expect(body).not.toContain(NO_STATEMENT);
  });
});

describe("the accuracy lede — the three states it can be read in", () => {
  it("is absent when the check did not run at all", () => {
    expect(text(lede, viewWith(null))).not.toContain(LEDE_SENTENCE);
    expect(text(lede, viewWith(accuracyWith(0)))).not.toContain(LEDE_SENTENCE);
  });

  /**
   * THE state this pair of findings is about. The lede promises statements
   * taken apart and sorted; SourceCheck directly beneath it says no statement
   * could be pulled out of the answers. Both paragraphs on the same screen.
   */
  it("is absent when answers were read but held no statement", () => {
    expect(text(lede, viewWith(accuracyWith(3)))).not.toContain(LEDE_SENTENCE);
  });

  // POSITIVE CONTROL — a lede that never prints is not a fix.
  it("is present on the ordinary report", () => {
    expect(text(lede, viewWith(accuracyWith(3, [assertion()])))).toContain(LEDE_SENTENCE);
  });

  it("prints the lede and no empty state together on the ordinary report", () => {
    const view = viewWith(accuracyWith(3, [assertion()]));
    expect(text(lede, view)).toContain(LEDE_SENTENCE);
    expect(text(sourceCheck, view)).not.toContain(NO_STATEMENT);
  });

  // The pairing that started this, stated as one assertion: whenever the lede
  // makes its promise, the section beneath it is not printing an empty state.
  it("never appears above either of SourceCheck's empty states", () => {
    for (const accuracy of [null, accuracyWith(0), accuracyWith(3)]) {
      const view = viewWith(accuracy);
      const beneath = text(sourceCheck, view);
      const emptyState = beneath.includes(NO_CHECK) || beneath.includes(NO_STATEMENT);
      expect(emptyState).toBe(true);
      expect(text(lede, view)).not.toContain(LEDE_SENTENCE);
    }
  });
});

describe("nothing claims the check ran on its own authority", () => {
  const codeOf = (path: string): string =>
    readFileSync(path, "utf-8")
      .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
      .replace(/<!--[\s\S]*?-->/g, "");

  const REPORT = "src/lib/report/Report.svelte";
  const LEDE_FILE = "src/lib/report/SourceCheckLede.svelte";
  const PRINT = "src/routes/audit/[token]/print/+page.svelte";
  const LEDE = "We asked an AI assistant about";
  const RAW = /answersRead\s*(===|>|!==)\s*0/;
  const PREDICATE = /sourceCheck(Measured|HasStatements)\(/;

  it("the accuracy lede is printed only inside the stricter shared predicate", () => {
    const code = codeOf(LEDE_FILE);
    const at = code.indexOf(LEDE);
    expect(at).toBeGreaterThan(-1);

    const before = code.slice(0, at);
    const opened = before.lastIndexOf("{#if ");
    // The lede must sit inside an open conditional at all: before the fix the
    // nearest `{#if}` above it was already closed.
    expect(opened).toBeGreaterThan(before.lastIndexOf("{/if}"));
    expect(code.slice(opened, at)).toContain("sourceCheckHasStatements(view)");
  });

  const surfaces: Array<[string, string]> = [
    ["the accuracy lede", LEDE_FILE],
    ["the source-check section", "src/lib/report/SourceCheck.svelte"],
    ["the print sheet", PRINT],
    ["the narrative primer", "src/lib/report/narrative.ts"],
  ];

  for (const [label, path] of surfaces) {
    it(`${label} asks a shared predicate rather than re-deriving it`, () => {
      const code = codeOf(path);
      expect(code).toMatch(PREDICATE);
      expect(code).not.toMatch(RAW);
    });
  }

  // The report page no longer answers the question at all — it delegates the
  // whole paragraph — but it must never start answering it again inline.
  it("the report page re-derives nothing", () => {
    expect(codeOf(REPORT)).not.toMatch(RAW);
  });

  it("the print sheet asks the predicate instead of counting statements itself", () => {
    expect(codeOf(PRINT)).not.toMatch(/assertions\.length\s*(===|>|!==)\s*0/);
  });

  it("model.ts derives it exactly once, inside sourceCheckMeasured", () => {
    const code = codeOf("src/lib/report/model.ts");
    expect(code.match(new RegExp(RAW.source, "g")) ?? []).toHaveLength(1);
    const fn = code.slice(code.indexOf("export function sourceCheckMeasured"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(RAW);
  });

  it("model.ts builds the stricter predicate on top of the looser one", () => {
    const code = codeOf("src/lib/report/model.ts");
    const fn = code.slice(code.indexOf("export function sourceCheckHasStatements"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("sourceCheckMeasured(view)");
  });
});
