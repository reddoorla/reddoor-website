import { describe, it, expect } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";
import type { Component } from "svelte";
import { sourceCheckMeasured, type ReportView } from "./model";

/**
 * The two empty states that printed OUR measurement gap as THEIR score.
 *
 * Both are template structure rather than a function, so this file renders the
 * component instead of asserting on its source text. `svelte/compiler` compiles
 * a `lang="ts"` component to a server module directly (Svelte 5 strips the type
 * annotations itself), so the property under test is the rendered HTML — the
 * thing a reader actually saw — with no plugin added to the unit-test config.
 *
 * The compiled module is written under `node_modules/` so that its own
 * `svelte/internal/server` import resolves the same way the component's would.
 */
type MeterProps = { yes: number; partial: number; no: number; unknown: number };

const ssr = async (name: string): Promise<Component<MeterProps>> => {
  const out = compile(readFileSync(`src/lib/report/${name}.svelte`, "utf-8"), {
    generate: "server",
    filename: `${name}.svelte`,
  });
  const dir = "node_modules/.cache/report-ssr";
  mkdirSync(dir, { recursive: true });
  const file = `${process.cwd()}/${dir}/${name}.js`;
  writeFileSync(file, out.js.code);
  const mod = (await import(pathToFileURL(file).href)) as { default: Component<MeterProps> };
  return mod.default;
};

const meter = await ssr("QuestionMeter");

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
 * The remedy is the one PR #152 applied to `wasNamed`: one exported predicate,
 * and a test that no surface re-derives it. The source-text assertions follow
 * named-consistency.test.ts — a Svelte template has no seam to import, and the
 * property that broke is which conditional the paragraph sits inside.
 */
const viewWith = (accuracy: ReportView["accuracy"]): ReportView =>
  ({ accuracy }) as unknown as ReportView;

const accuracyWith = (answersRead: number): ReportView["accuracy"] =>
  ({
    assertions: [],
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

describe("nothing claims the check ran on its own authority", () => {
  const codeOf = (path: string): string =>
    readFileSync(path, "utf-8")
      .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
      .replace(/<!--[\s\S]*?-->/g, "");

  const REPORT = "src/lib/report/Report.svelte";
  const LEDE = "We asked an AI assistant about";
  const RAW = /answersRead\s*(===|>|!==)\s*0/;

  it("the report's accuracy lede is printed only inside the shared predicate", () => {
    const code = codeOf(REPORT);
    const at = code.indexOf(LEDE);
    expect(at).toBeGreaterThan(-1);

    const before = code.slice(0, at);
    const opened = before.lastIndexOf("{#if ");
    // The lede must sit inside an open conditional at all: before the fix the
    // nearest `{#if}` above it was already closed.
    expect(opened).toBeGreaterThan(before.lastIndexOf("{/if}"));
    expect(code.slice(opened, at)).toContain("sourceCheckMeasured(view)");
  });

  const surfaces: Array<[string, string]> = [
    ["the report page", REPORT],
    ["the source-check section", "src/lib/report/SourceCheck.svelte"],
    ["the print sheet", "src/routes/audit/[token]/print/+page.svelte"],
    ["the narrative primer", "src/lib/report/narrative.ts"],
  ];

  for (const [label, path] of surfaces) {
    it(`${label} asks sourceCheckMeasured rather than re-deriving it`, () => {
      const code = codeOf(path);
      expect(code).toContain("sourceCheckMeasured");
      expect(code).not.toMatch(RAW);
    });
  }

  it("model.ts derives it exactly once, inside sourceCheckMeasured", () => {
    const code = codeOf("src/lib/report/model.ts");
    expect(code.match(new RegExp(RAW.source, "g")) ?? []).toHaveLength(1);
    const fn = code.slice(code.indexOf("export function sourceCheckMeasured"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(RAW);
  });
});
