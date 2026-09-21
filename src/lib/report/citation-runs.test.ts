import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import { citationRuns, type Assertion, type ReportView } from "./model";

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
 * RENDERED, not grepped.
 *
 * The three states are template structure, and a source-text assertion is blind
 * to which branch a reader lands in: swap `{:else if citations === "none"}` for
 * `"carried"` and every `toContain` below the fold still passes while the sheet
 * prints "no sources" on rows whose sources are printed directly above it. The
 * harness is the one empty-states.test.ts uses — `svelte/compiler` plus
 * `svelte/server`, no plugin added to the unit-test config. The print sheet is a
 * route page and renders under it too: its only relative import is the
 * type-only `./$types`, which Svelte strips.
 */
const ALSO_READ = "Also read for that answer:";

/**
 * What a row with an empty `sourceDomains` is allowed to say.
 *
 * NOT "the assistant cited no sources": the producer strips the prospect's own
 * domain from this list before storing it, so an empty list means "nothing
 * outside your own site", and an answer grounded entirely on their site would
 * have been called sourceless forty lines above the same section saying the
 * assistant cited their site. It is also what an unattributable quote looks
 * like, which is our measurement gap rather than the assistant's behaviour.
 */
const NO_SOURCES = "We recorded no other sources for that answer.";

/** The sentence that claimed to know what the assistant cited. */
const OVERCLAIM = /cited no sources/;

const RUN_ROWS: Assertion[] = [
  claim({
    claim: "ROWONE has been trading since 1998",
    query: "who is acme",
    engine: "claude",
    sourceDomains: ["yelp.com", "bbb.org"],
  }),
  claim({
    claim: "ROWTWO is based in Dallas",
    query: "who is acme",
    engine: "claude",
    sourceDomains: ["yelp.com", "bbb.org"],
  }),
  claim({
    claim: "ROWTHREE closes on Sundays",
    query: "when is acme open",
    engine: "claude",
    sourceDomains: [],
  }),
  // An `absent` row, so "What the AI says about you" follows the contradicted
  // list on both surfaces and the last row has a bound to measure against.
  claim({
    claim: "ROWFOUR has won awards",
    verdict: "absent",
    siteQuote: null,
    query: "who is acme",
    engine: "claude",
    sourceDomains: ["yelp.com"],
  }),
];

/**
 * The contradicted list alone, bounded by the headings either side of it. The
 * section heading is not unique on the print sheet — it is in the contents
 * list too — so the region starts at the LAST one before the heading that ends
 * it. Bounding matters: the sheet repeats a contradicted claim under "Our
 * recommendations", and the section's own summary names domains.
 */
const region = (body: string, sectionStart: string): string => {
  const end = body.indexOf("What the AI says about you");
  expect(end, "the unsourced-claims heading did not render").toBeGreaterThan(-1);
  const head = body.lastIndexOf(sectionStart, end);
  expect(head, `section heading did not render: ${sectionStart}`).toBeGreaterThan(-1);
  return body.slice(head, end);
};

/** One row, from its own claim to the next. A marker that is not unique inside
 *  the region makes the slice meaningless, so that is asserted, not assumed. */
const between = (text: string, from: string, to: string | null): string => {
  expect(text.split(from), `marker not unique: ${from}`).toHaveLength(2);
  const a = text.indexOf(from);
  if (to === null) return text.slice(a);
  expect(text.split(to), `marker not unique: ${to}`).toHaveLength(2);
  return text.slice(a, text.indexOf(to, a));
};

const rowsOf = (body: string, sectionStart: string) => {
  const r = region(body, sectionStart);
  return {
    one: between(r, "ROWONE", "ROWTWO"),
    two: between(r, "ROWTWO", "ROWTHREE"),
    three: between(r, "ROWTHREE", null),
  };
};

const view = {
  url: "https://acme.test/",
  businessName: "Acme Co",
  namesake: null,
  sitemapUrlCount: null,
  brandedProbes: [],
  accuracy: {
    assertions: RUN_ROWS,
    sources: [],
    siteFullyRead: true,
    pagesRead: 1,
    pagesTotal: 1,
    answersRead: 2,
    conflation: { detected: false, otherNames: [], engineQuote: null },
  },
} as unknown as ReportView;

const sourceCheck = await ssr<{ view: ReportView }>("src/lib/report/SourceCheck.svelte");
const printSheet = await ssr<{ data: { report: unknown; overrides: unknown } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

const printReport = structuredClone(ALL_PASS_REPORT) as typeof ALL_PASS_REPORT & {
  accuracy: { data: { assertions: Assertion[] } };
};
printReport.accuracy.data.assertions = RUN_ROWS;

const surfaces: Array<[string, () => string, string]> = [
  [
    "the source-check section",
    () => renderText(sourceCheck, { view }),
    "Your site says something different",
  ],
  [
    "the print sheet",
    () => renderText(printSheet, { data: { report: printReport, overrides: {} } }),
    "What AI is saying about you",
  ],
];

for (const [label, body, sectionStart] of surfaces) {
  describe(`${label} — three rows, two answers, one of them sourceless`, () => {
    it("prints the first row's list under the run", () => {
      const { one } = rowsOf(body(), sectionStart);
      expect(one).toContain(ALSO_READ);
      expect(one).toContain("yelp.com");
      expect(one).toContain("bbb.org");
    });

    it("says nothing at all on the second row of the same answer", () => {
      const { two } = rowsOf(body(), sectionStart);
      expect(two).not.toContain(ALSO_READ);
      expect(two).not.toContain(NO_SOURCES);
      expect(two).not.toContain("yelp.com");
    });

    it("says what it recorded, not what the assistant cited, on the sourceless row", () => {
      const { three } = rowsOf(body(), sectionStart);
      expect(three).toContain(NO_SOURCES);
      expect(three).not.toContain(ALSO_READ);
      expect(three).not.toContain("yelp.com");
    });

    it("never claims to know what the assistant cited", () => {
      expect(body()).not.toMatch(OVERCLAIM);
    });
  });
}

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

    // Belt and braces under the rendered tests above: the exact sentence, and
    // the exact branch it hangs off, so a swapped condition is caught twice.
    it(`${label} says what it recorded, on the "none" branch and no other`, () => {
      const code = codeOf(path);
      expect(code).toContain(NO_SOURCES);
      expect(code).not.toMatch(OVERCLAIM);
      const at = code.indexOf(NO_SOURCES);
      const opened = code.lastIndexOf("{:else if citations ===", at);
      expect(opened).toBeGreaterThan(code.lastIndexOf("{#if citations ===", at));
      expect(code.slice(opened, at)).toContain('{:else if citations === "none"}');
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
