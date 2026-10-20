import { describe, it, expect } from "vitest";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import { wasNamed, type ProbeAnswer } from "./model";

/**
 * One question — "did the engine name this business?" — answered in three
 * places, and they did not agree.
 *
 * `toReportView` counts it with the scorer's own verdict (`countedAsVisible`),
 * which only counts an unprompted brand mention when the name could not be a
 * coincidence. `SearchResults.svelte` and the print sheet each re-derived it as
 * the looser `domainCited || brandMentioned`. For a business whose name is not
 * distinctive — the docstring's own example, "Creative Studio" — Standing prints
 * "was not among them, in any of the 5 questions we asked" while the disclosure
 * directly below prints "Creative Studio appeared in this answer." The print
 * sheet does both on one page.
 *
 * A document that contradicts itself about the client's own visibility invites
 * the reader to discount all of it, which is what Standing.svelte spends forty
 * lines of comments guarding against.
 *
 * Both surfaces are rendered, so what is tested is the sentence the reader got,
 * not whether the template's source names `wasNamed`.
 */
const probe = (over: Partial<ProbeAnswer> = {}): ProbeAnswer => ({
  engine: "claude",
  query: "who does branding in los angeles",
  kind: "category",
  domainCited: false,
  brandMentioned: false,
  citedDomains: [],
  snippet: "",
  truncated: false,
  askedAt: "2026-09-02T00:00:00.000Z",
  ...over,
});

describe("wasNamed — the single verdict on whether the engine named them", () => {
  it("does not count a brand mention the scorer rejected as coincidental", () => {
    expect(wasNamed(probe({ brandMentioned: true, countedAsVisible: false }))).toBe(false);
  });

  it("counts a mention the scorer accepted", () => {
    expect(wasNamed(probe({ brandMentioned: true, countedAsVisible: true }))).toBe(true);
  });

  it("counts a cited domain", () => {
    expect(wasNamed(probe({ domainCited: true, countedAsVisible: true }))).toBe(true);
  });

  it("says no when the engine cited nobody", () => {
    expect(wasNamed(probe({ countedAsVisible: false }))).toBe(false);
  });

  // Reports stored before the scorer recorded its verdict have no better
  // answer available, so the loose rule stays their fallback — but ONLY theirs.
  it("falls back to the loose rule when the stored report predates the verdict", () => {
    expect(wasNamed(probe({ brandMentioned: true }))).toBe(true);
    expect(wasNamed(probe())).toBe(false);
  });
});

/**
 * Four answers that differ ONLY in what decides whether the business was named:
 * same query, same engine, same cited domains. So a surface that asks
 * `wasNamed` renders two of them identically to each other and differently from
 * the other two — whatever its sentences say, and however they are styled.
 */
const CITED = ["clutch.co", "designrush.com"];
const ACCEPTED = probe({ brandMentioned: true, countedAsVisible: true, citedDomains: CITED });
const NOBODY = probe({ countedAsVisible: false, citedDomains: CITED });
/** The case that broke: named in the answer, but not distinctively enough to count. */
const COINCIDENCE = probe({ brandMentioned: true, countedAsVisible: false, citedDomains: CITED });
/** Stored before the scorer recorded a verdict. */
const LEGACY = probe({ brandMentioned: true, citedDomains: CITED });

const searchResults = await ssr<{ probes: ProbeAnswer[]; businessName: string | null }>(
  "src/lib/report/SearchResults.svelte",
);
const printSheet = await ssr<{ data: { report: unknown; overrides: unknown } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

const sheetWith = (answer: ProbeAnswer): string => {
  const report = structuredClone(ALL_PASS_REPORT) as typeof ALL_PASS_REPORT & {
    probes: { data: { answers: ProbeAnswer[] } };
  };
  report.probes.data.answers = [answer];
  return renderText(printSheet, { data: { report, overrides: {} } });
};

const surfaces: Array<[string, (answer: ProbeAnswer) => string]> = [
  [
    "the web report",
    (answer) => renderText(searchResults, { probes: [answer], businessName: "Creative Studio" }),
  ],
  ["the print sheet", sheetWith],
];

for (const [label, render] of surfaces) {
  describe(`${label} prints the verdict wasNamed gives`, () => {
    it("reads a mention the scorer rejected exactly as it reads no mention at all", () => {
      expect(wasNamed(COINCIDENCE)).toBe(false);
      expect(render(COINCIDENCE)).toBe(render(NOBODY));
    });

    // POSITIVE CONTROL — a surface that printed the same thing for every answer
    // would pass the case above.
    it("says something different when the scorer counted them", () => {
      expect(render(ACCEPTED)).not.toBe(render(NOBODY));
    });

    it("falls back to the loose rule for a report that predates the verdict", () => {
      expect(render(LEGACY)).toBe(render(ACCEPTED));
    });
  });
}
