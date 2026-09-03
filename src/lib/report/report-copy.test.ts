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
const REPORT = "src/lib/report/Report.svelte";
const PRINT = "src/routes/audit/[token]/print/+page.svelte";
const SOURCE = "src/lib/report/SourceCheck.svelte";
const COMPONENTS = [
  REPORT,
  SOURCE,
  "src/lib/report/FixList.svelte",
  "src/lib/report/GoalFit.svelte",
  "src/lib/report/ScoreBars.svelte",
  "src/lib/report/Standing.svelte",
  "src/lib/report/SiteHealth.svelte",
  "src/lib/report/Stack.svelte",
  "src/lib/report/Accessibility.svelte",
  "src/lib/report/QuestionMeter.svelte",
  "src/lib/report/SearchResults.svelte",
  "src/lib/report/CitationChart.svelte",
  "src/lib/report/WhatPasses.svelte",
];

describe("one story, on every surface", () => {
  it("the opener is derived from the verdicts, not written by the model", () => {
    expect(code(REPORT)).toContain("openingSummary(view)");
    expect(code(PRINT)).toContain("openingSummary(view)");
    expect(code(REPORT)).not.toMatch(/narrative\.answers/);
    expect(code(PRINT)).not.toMatch(/narrative\.answers/);
  });

  it("the hero leads with the one deterministic headline finding and points at the fixes", () => {
    expect(code(REPORT)).toContain("headlineFinding(view)");
    expect(code(REPORT)).toMatch(/href="#fixes"/);
    expect(code(REPORT)).toMatch(/id="fixes"/);
    expect(code(PRINT)).toContain("headlineFinding(view)");
  });

  it("the token route renders the same body as the fixture route", () => {
    expect(code(PAGE)).toMatch(/<Report\b/);
    expect(code("src/routes/dev/audit-report/+page.svelte")).toMatch(/<Report\b/);
  });

  it("recommendations are the fix list, labelled as judgement, never as promises", () => {
    const src = code("src/lib/report/FixList.svelte");
    expect(src).not.toMatch(/What we measured/);
    expect(src).toMatch(/Our recommendations/);
    expect(src).toMatch(/None of them is a\s+promise\s+about what an engine will do/);
  });

  it("everything that passed collapses into one disclosure, and nowhere else", () => {
    expect(code(REPORT).match(/<WhatPasses\b/g) ?? []).toHaveLength(1);
    expect(code("src/lib/report/WhatPasses.svelte")).toMatch(/passes\(view\)/);
    // The sections print findings only; the receipt for what passed lives in WhatPasses.
    expect(code("src/lib/report/SiteHealth.svelte")).not.toMatch(/Also checked, nothing wrong/);
    expect(code("src/lib/report/SiteHealth.svelte")).not.toMatch(/What we checked/);
    expect(code(SOURCE)).not.toMatch(/The assistant is reading your own site/);
  });

  it("the name collision names its remedy as a fix in the list, not an inline aside", () => {
    expect(code(SOURCE)).not.toMatch(/What to do about it/);
    expect(code(SOURCE)).toMatch(/href="#fixes"/);
    expect(code(SOURCE)).toMatch(/view\.namesake/);
    expect(code(REPORT)).toContain("allFixes(view)");
    expect(code(PRINT)).toContain("allFixes(view)");
    expect(code(REPORT)).not.toMatch(/Someone else is answering to your name/);
  });

  it("a statement the site does not make is never printed as an accusation; the sources are shown instead", () => {
    for (const p of [SOURCE, PRINT]) {
      expect(code(p), p).not.toMatch(/Your site does not say this/);
      expect(code(p), p).not.toMatch(/does not say this/i);
    }
    // Visible, not behind a disclosure: no title= carries the heading.
    expect(code(SOURCE)).toMatch(/Who else the assistant read/);
    expect(code(SOURCE)).not.toMatch(/title="Who else/);
  });

  it("what the AI says that is not on the site is a list of headlines, nothing under them", () => {
    for (const p of [SOURCE, PRINT]) {
      expect(code(p), p).toMatch(/What the AI says about you that is not on your site/);
      expect(code(p), p).toMatch(/We did not find these on your site/);
      expect(code(p), p).not.toMatch(/Why we could not check/);
      expect(code(p), p).not.toMatch(/could not judge|Not judged/);
    }
    expect(code(SOURCE)).toMatch(/u\.claim/);
    expect(code(SOURCE)).not.toMatch(/u\.engineQuote|u\.unverifiedReason|u\.sourceDomains/);
  });

  it("the page count is the pages we crawled, never a claim about how many pages the site has", () => {
    for (const p of [SOURCE, PRINT]) {
      expect(code(p), p).toMatch(/pages we crawled/);
      expect(code(p), p).not.toMatch(/of your \{acc(uracy)?\.pagesTotal\} pages/);
    }
  });

  it("the methods say what we did and assert nothing about what crawlers do with JavaScript", () => {
    for (const p of [REPORT, PRINT]) {
      const src = code(p).replace(/\s+/g, " ");
      expect(src, p).toMatch(/so we could measure how much of each page depends on JavaScript\./);
      expect(src, p).not.toMatch(/Most AI crawlers/);
      expect(src, p).not.toMatch(/crawlers (run|execute) no/i);
      expect(src, p).not.toMatch(/assumption/);
    }
  });

  it("checked-and-fine and under-the-hood come after the fixes, on both surfaces", () => {
    const report = code(REPORT);
    const fixes = report.indexOf('id="fixes"');
    const passes = report.indexOf("<WhatPasses");
    const hood = report.indexOf("Under the hood");
    expect(fixes).toBeGreaterThan(0);
    expect(passes).toBeGreaterThan(fixes);
    expect(hood).toBeGreaterThan(passes);
    const print = code(PRINT);
    expect(print.indexOf("<h2>What passes</h2>")).toBeGreaterThan(
      print.indexOf("<h2>Our recommendations</h2>"),
    );
    expect(print.indexOf("<h2>How we measured this</h2>")).toBeGreaterThan(
      print.indexOf("<h2>What passes</h2>"),
    );
  });

  it("every mention of a pass links to the checked-and-fine section, and the reader can come back", () => {
    for (const p of ["src/lib/report/SiteHealth.svelte", "src/lib/report/GoalFit.svelte", SOURCE]) {
      expect(code(p), p).toMatch(/href="#passes"/);
    }
    expect(code("src/lib/report/WhatPasses.svelte")).toMatch(/id="passes"[^>]*scroll-mt/);
    expect(code(REPORT)).toMatch(/Back to where you were/);
  });

  it("checked-and-fine and under-the-hood share one paper band, and a failed check points at the fixes", () => {
    const report = code(REPORT);
    const passes = report.indexOf("<WhatPasses");
    const hood = report.indexOf("Under the hood");
    // No section boundary between them: one band, two rails.
    expect(report.slice(passes, hood)).not.toMatch(/<\/section>|<section\b/);
    const open = report.lastIndexOf("<section", passes);
    expect(report.slice(open, passes)).toMatch(/bg-paper/);
    // A finding under "Does it work" always has a matching fix, and says so.
    expect(code("src/lib/report/SiteHealth.svelte")).toMatch(/href="#fixes"/);
  });

  it("the report uses the whole content column: no measure caps outside the hero headline", () => {
    for (const p of COMPONENTS) {
      const hits = code(p).match(/max-w-\[\d+ch\]/g) ?? [];
      expect(hits.length, p).toBeLessThanOrEqual(p === REPORT ? 1 : 0);
    }
    const rows = code(REPORT).match(/<RailRow\b[^>]*>/gs) ?? [];
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) expect(row, row).toMatch(/\bfill\b/);
  });

  it("small copy uses the site's type roles, not ad-hoc sizes", () => {
    for (const p of COMPONENTS) expect(code(p), p).not.toMatch(/\btext-(xs|sm)\b/);
  });

  it("the accuracy section says how often the site itself was cited, and never 'cited on that answer'", () => {
    const src = code(SOURCE);
    expect(src).toContain("ownSiteCitations(view)");
    expect(src).not.toMatch(/Cited on that answer/);
    expect(src).toMatch(/Also read for that answer/);
    expect(src).not.toMatch(/instead of you/);
    expect(src).not.toMatch(/previous owner/);
  });

  it("each unjudged statement is named, never a joined string of reasons", () => {
    const src = code(SOURCE);
    expect(src).toMatch(/u\.claim/);
    expect(src).not.toMatch(/\.join\("; "\)/);
  });

  it("a name collision is a finding, not a truncated quote", () => {
    expect(code(SOURCE)).toMatch(/conflation\.detected/);
    expect(code(PRINT)).toMatch(/conflation\.detected/);
  });

  it("one assistant was tested, and the copy says so in the singular", () => {
    for (const p of [REPORT, PRINT, SOURCE, "src/lib/report/Standing.svelte"]) {
      expect(code(p), p).not.toMatch(/\bengines\b/);
    }
    expect(code(REPORT)).not.toMatch(/visibility score above/);
    expect(code(REPORT)).not.toMatch(/Every finding here is one you can reproduce/);
  });

  it("the robots.txt explanation appears once", () => {
    const src = code("src/lib/report/ScoreBars.svelte");
    expect(src.match(/pass\/fail, not a score/g) ?? []).toHaveLength(1);
  });

  it("the goal is shown as a choice when an operator made it", () => {
    expect(code("src/lib/report/GoalFit.svelte")).toMatch(/fit\.source === "operator"/);
  });

  it("the question table shows the passage, not only the verdict", () => {
    expect(code(REPORT)).toMatch(/q\.evidence/);
    expect(code(PRINT)).toMatch(/q\.evidence/);
  });

  it("the print sheet carries the visibility caveat beside the count, a receipt, and a next step", () => {
    const src = code(PRINT);
    expect(src).toMatch(/nothing we can do to your website reliably moves it/);
    expect(src).toMatch(/Half an hour/);
    expect(src).toMatch(/row\.siteQuote/);
  });
});
