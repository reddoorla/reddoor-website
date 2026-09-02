import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Sentences the report must and must not contain.
 *
 * Svelte templates have no seam to import, and every one of these is a
 * sentence a reader actually saw on the live report — the pattern is
 * token-privacy.test.ts. Comment lines are stripped so an explanation of the
 * old wording stays writable.
 */
const code = (p: string): string =>
  readFileSync(p, "utf-8")
    .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");
const PAGE = "src/routes/audit/[token]/+page.svelte";
const PRINT = "src/routes/audit/[token]/print/+page.svelte";
const SOURCE = "src/lib/report/SourceCheck.svelte";

describe("one story, on every surface", () => {
  it("the opener is derived from the verdicts, not written by the model", () => {
    expect(code(PAGE)).toContain("openingSummary(view)");
    expect(code(PRINT)).toContain("openingSummary(view)");
    expect(code(PAGE)).not.toMatch(/narrative\.answers/);
    expect(code(PRINT)).not.toMatch(/narrative\.answers/);
  });

  it("recommendations are labelled as judgement, never as promises", () => {
    const src = code("src/lib/report/FixList.svelte");
    expect(src).toMatch(/What we measured/);
    expect(src).toMatch(/Our recommendations/);
    expect(src).toMatch(/None of them is a\s+promise\s+about what an engine will do/);
  });

  it("the accuracy section says how often the site itself was cited, and never 'cited on that answer'", () => {
    const src = code(SOURCE);
    expect(src).toContain("ownSiteCitations(view)");
    expect(src).not.toMatch(/Cited on that answer/);
    expect(src).toMatch(/Also read for that answer/);
    expect(src).not.toMatch(/instead of you/);
    expect(src).not.toMatch(/previous owner/);
  });

  it("'not judged' names the statements it did not judge", () => {
    const src = code(SOURCE);
    expect(src).toMatch(/u\.claim/);
    expect(src).not.toMatch(/\.join\("; "\)/);
  });

  it("a name collision is a finding, not a truncated quote", () => {
    expect(code(SOURCE)).toMatch(/conflation\.detected/);
    expect(code(PRINT)).toMatch(/conflation\.detected/);
  });

  it("one assistant was tested, and the copy says so in the singular", () => {
    for (const p of [PAGE, PRINT, SOURCE, "src/lib/report/Standing.svelte"]) {
      expect(code(p), p).not.toMatch(/\bengines\b/);
    }
    expect(code(PAGE)).not.toMatch(/visibility score above/);
    expect(code(PAGE)).not.toMatch(/Every finding here is one you can reproduce/);
  });

  it("the robots.txt explanation appears once", () => {
    const src = code("src/lib/report/ScoreBars.svelte");
    expect(src.match(/pass\/fail, not a score/g) ?? []).toHaveLength(1);
  });

  it("the goal is shown as a choice when an operator made it", () => {
    expect(code("src/lib/report/GoalFit.svelte")).toMatch(/fit\.source === "operator"/);
  });

  it("the question table shows the passage, not only the verdict", () => {
    expect(code(PAGE)).toMatch(/q\.evidence/);
    expect(code(PRINT)).toMatch(/q\.evidence/);
  });

  it("the print sheet carries the visibility caveat beside the count, a receipt, and a next step", () => {
    const src = code(PRINT);
    expect(src).toMatch(/nothing we can do to your website reliably moves it/);
    expect(src).toMatch(/Half an hour/);
    expect(src).toMatch(/row\.siteQuote/);
  });
});
