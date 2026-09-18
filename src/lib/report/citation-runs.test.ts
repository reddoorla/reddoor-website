import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { citationRuns, type Assertion } from "./model";

/**
 * Whose sources are these?
 *
 * Every claim pulled out of one engine answer carries that answer's citation
 * list, so consecutive rows from the same answer would print the identical list
 * over and over — hence the run. But the run was keyed on the CITATION LIST
 * (`[...d].sort().join("|")`) rather than on which answer the row came from,
 * which made two different things render identically: a row whose citations
 * were collapsed because they matched the row above, and a row whose answer
 * cited nothing at all. The second one inherits the line above it in the
 * reader's eye — a competitor's domain attributed to the wrong claim, inside
 * the section whose whole argument is who the engine read.
 *
 * The correct key is the answer identity, `query + engine`, and `Assertion`
 * already carries both.
 */
const claim = (over: Partial<Assertion> = {}): Assertion => ({
  claim: "They have been in business since 1998",
  verdict: "contradicted",
  engineQuote: "in business since 1998",
  siteQuote: "founded in 2004",
  unverifiedReason: null,
  nearbyMention: null,
  sourceDomains: [],
  query: "who is acme",
  engine: "claude",
  ...over,
});

const kinds = (rows: Assertion[]) => citationRuns(rows).map((r) => r.citations);

describe("citationRuns — a run is one answer, not one citation list", () => {
  it("prints the sources of two different answers that happen to cite the same domains", () => {
    const rows = [
      claim({ claim: "first", query: "who is acme", sourceDomains: ["yelp.com", "bbb.org"] }),
      claim({ claim: "second", query: "is acme any good", sourceDomains: ["bbb.org", "yelp.com"] }),
    ];
    expect(kinds(rows)).toEqual(["show", "show"]);
  });

  it("marks a row whose own answer cited nothing, so it cannot read as a continuation", () => {
    const rows = [
      claim({ claim: "first", query: "who is acme", sourceDomains: ["competitor.example"] }),
      claim({ claim: "second", query: "where is acme", sourceDomains: [] }),
    ];
    expect(kinds(rows)).toEqual(["show", "none"]);
  });

  it("does not let a sourceless row hand its predecessor's list to the row after it", () => {
    const rows = [
      claim({ claim: "first", query: "who is acme", sourceDomains: ["yelp.com"] }),
      claim({ claim: "second", query: "where is acme", sourceDomains: [] }),
      claim({ claim: "third", query: "who is acme", sourceDomains: ["yelp.com"] }),
    ];
    expect(kinds(rows)).toEqual(["show", "none", "show"]);
  });

  it("treats the same query on a different engine as a different answer", () => {
    const rows = [
      claim({ claim: "first", engine: "claude", sourceDomains: ["yelp.com"] }),
      claim({ claim: "second", engine: "perplexity", sourceDomains: ["yelp.com"] }),
    ];
    expect(kinds(rows)).toEqual(["show", "show"]);
  });

  // POSITIVE CONTROL — the behaviour the function exists for, before and after.
  it("still collapses consecutive rows from the same answer to one printed list", () => {
    const rows = [
      claim({ claim: "first", sourceDomains: ["yelp.com", "bbb.org"] }),
      claim({ claim: "second", sourceDomains: ["yelp.com", "bbb.org"] }),
      claim({ claim: "third", sourceDomains: ["yelp.com", "bbb.org"] }),
    ];
    expect(kinds(rows)).toEqual(["show", "carried", "carried"]);
  });

  // POSITIVE CONTROL — order within one answer's list is not a new answer.
  it("collapses the same answer even when its domains arrive in a different order", () => {
    const rows = [
      claim({ claim: "first", sourceDomains: ["yelp.com", "bbb.org"] }),
      claim({ claim: "second", sourceDomains: ["bbb.org", "yelp.com"] }),
    ];
    expect(kinds(rows)).toEqual(["show", "carried"]);
  });

  it("carries the row through untouched", () => {
    const row = claim({ sourceDomains: ["yelp.com"] });
    expect(citationRuns([row])[0].row).toBe(row);
  });

  it("has nothing to say about an empty list", () => {
    expect(citationRuns([])).toEqual([]);
  });
});

/**
 * Both surfaces had their own copy of the run logic, and the issue names the
 * print sheet as the second site of the same bug. One function, asked twice —
 * the pattern `wasNamed` and `sourceCheckMeasured` follow. The source-text
 * assertions follow named-consistency.test.ts.
 */
describe("neither surface keys a run on the citation list", () => {
  const codeOf = (path: string): string =>
    readFileSync(path, "utf-8")
      .replace(/^\s*(\/\/|\*|\/\*).*$/gm, "")
      .replace(/<!--[\s\S]*?-->/g, "");

  /** The old key: the sorted, joined citation list. */
  const BY_LIST = /\[\s*\.\.\.\s*\w+\s*\]\s*\.sort\(\)\s*\.join\(/;

  const surfaces: Array<[string, string]> = [
    ["the source-check section", "src/lib/report/SourceCheck.svelte"],
    ["the print sheet", "src/routes/audit/[token]/print/+page.svelte"],
  ];

  for (const [label, path] of surfaces) {
    it(`${label} asks citationRuns rather than keying on the domains`, () => {
      const code = codeOf(path);
      expect(code).toContain("citationRuns");
      expect(code).not.toMatch(BY_LIST);
    });

    it(`${label} says so when an answer cited nothing`, () => {
      expect(codeOf(path)).toContain("cited no sources");
    });
  }

  it("model.ts keys the run on the answer, not on the list", () => {
    const code = codeOf("src/lib/report/model.ts");
    expect(code).not.toMatch(BY_LIST);
    const fn = code.slice(code.indexOf("export function citationRuns"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("row.query");
    expect(fn.slice(0, fn.indexOf("\n}"))).toContain("row.engine");
  });
});
