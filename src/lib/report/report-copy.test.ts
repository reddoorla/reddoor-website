import { describe, it, expect } from "vitest";
import { ssr, renderText } from "./ssr-test-harness";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";
import type { AuditReport, OverrideMap } from "./fetch";
import {
  GOAL_LABELS,
  openingSummary,
  ownSiteCitations,
  toReportView,
  type Assertion,
  type ReportView,
} from "./model";
import { allFixes, auditedOn, headlineFinding, TOC_TARGETS } from "./narrative";

/**
 * Sentences the report must and must not contain, asserted on what renders.
 *
 * Every one of these is a sentence a reader saw on the live report. The
 * components with no child component compile here through
 * `ssr-test-harness.ts` — the source-check section, its lede, GoalFit and the
 * print sheet. Report.svelte and the sections that nest a component do not
 * compile here, so their copy is asserted nowhere yet (#243).
 *
 * Most assertions are negative, so each surface is rendered from a report that
 * reaches every branch, and a positive control proves it did.
 */
const allPass = ALL_PASS_REPORT as {
  accuracy: { data: Record<string, unknown> & { assertions: Assertion[] } };
  analyze: { data: Record<string, unknown> & { buyerQuestions: { evidence: string }[] } };
  crawl: { data: Record<string, unknown> };
  goalFit: { data: Record<string, unknown> };
};

const row = (over: Partial<Assertion>): Assertion => ({
  claim: "",
  verdict: "absent",
  engineQuote: "",
  siteQuote: null,
  unverifiedReason: null,
  nearbyMention: null,
  sourceDomains: [],
  query: "who is Example Studio",
  engine: "claude",
  ...over,
});

const CONTRADICTED = row({
  claim: "Example Studio was founded in 2009.",
  verdict: "contradicted",
  engineQuote: "founded in 2009",
  siteQuote: "Founded in 2012, in a garage on East Sixth.",
  sourceDomains: ["yelp.com", "clutch.co"],
});
// The engine's wording, our reason and the row's sources are sentinels: none of
// them may reach the page under a statement the site does not make.
const ABSENT = row({
  claim: "Example Studio has an office in Denver.",
  engineQuote: "ENGINE-QUOTE-ABSENT",
  sourceDomains: ["row-source.test"],
});
const UNVERIFIED = row({
  claim: "Example Studio is led by Sam Ortiz.",
  verdict: "unverified",
  engineQuote: "ENGINE-QUOTE-UNVERIFIED",
  unverifiedReason: "UNVERIFIED-REASON",
  sourceDomains: ["row-source.test"],
});
const OTHER_NAME = "Example Studios Ltd";
const ELSEWHERE = "reviews-elsewhere.test";
const SITEMAP = 137;
const MODEL_SUMMARY = "MODEL-WRITTEN-SUMMARY";

// One assistant was tested. "Search engines" is a site check's own label in the
// print sheet's passes, and about Google, not the assistant.
const ENGINES = /(?<!search )\bengines\b/i;
const LIVE = /\blive\s+(AI|searches|visibility)\b|of a live/;

/** The all-pass report with one of every kind of statement, a name collision,
 *  a source the business does not own, and a crawl that read part of the site. */
const RICH: AuditReport = {
  ...ALL_PASS_REPORT,
  crawl: {
    ok: true,
    data: { ...allPass.crawl.data, sitemap: { present: true, urlCount: SITEMAP } },
  },
  analyze: {
    ok: true,
    data: {
      ...allPass.analyze.data,
      narrative: { findability: MODEL_SUMMARY, readability: MODEL_SUMMARY, answers: MODEL_SUMMARY },
    },
  },
  accuracy: {
    ok: true,
    data: {
      ...allPass.accuracy.data,
      assertions: [...allPass.accuracy.data.assertions, CONTRADICTED, ABSENT, UNVERIFIED],
      sources: [
        ...(allPass.accuracy.data.sources as unknown[]),
        { domain: ELSEWHERE, owner: "theirs", because: "a review site" },
      ],
      siteFullyRead: false,
      pagesRead: 3,
      pagesTotal: 5,
      conflation: {
        detected: true,
        otherNames: [OTHER_NAME],
        engineQuote: "There are two studios by that name.",
      },
    },
  },
};
const VIEW = toReportView(RICH);

type ViewProps = { view: ReportView };
const sourceCheck = await ssr<ViewProps>("src/lib/report/SourceCheck.svelte");
const lede = await ssr<ViewProps>("src/lib/report/SourceCheckLede.svelte");
const goalFit = await ssr<ViewProps>("src/lib/report/GoalFit.svelte");
const printSheet = await ssr<{ data: { report: AuditReport; overrides: OverrideMap } }>(
  "src/routes/audit/[token]/print/+page.svelte",
);

const printed = (report: AuditReport): string =>
  renderText(printSheet, { data: { report, overrides: {} } });

/** What a reader sees: the markup and its attributes gone. */
const seen = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const surfaces: Array<[string, string]> = [
  ["the source-check section", renderText(sourceCheck, { view: VIEW })],
  ["the print sheet", printed(RICH)],
];

describe.each(surfaces)("%s", (_label, html) => {
  it("reaches every branch on the rich report, so the negatives below test something", () => {
    for (const shown of [
      CONTRADICTED.claim,
      CONTRADICTED.siteQuote!,
      ABSENT.claim,
      UNVERIFIED.claim,
      OTHER_NAME,
      ELSEWHERE,
      String(SITEMAP),
    ]) {
      expect(seen(html)).toContain(shown);
    }
  });

  it("never accuses the site of not saying something, and shows who the assistant read instead", () => {
    expect(html).not.toMatch(/does not say this/i);
    expect(seen(html)).toContain(ELSEWHERE);
  });

  it("prints each unsourced claim alone, with nothing of ours under it", () => {
    expect(html).not.toMatch(/not on your site/i);
    expect(html).not.toMatch(/did not find these on your site|What we could not check/i);
    expect(html).not.toContain(`${ABSENT.claim}; ${UNVERIFIED.claim}`);
    for (const sentinel of [
      ABSENT.engineQuote,
      UNVERIFIED.engineQuote,
      UNVERIFIED.unverifiedReason!,
      "row-source.test",
    ]) {
      expect(html).not.toContain(sentinel);
    }
  });

  it("counts the pages we crawled, never the pages the site has", () => {
    expect(html).not.toMatch(/of your \d+ pages/);
  });

  it("never says what was 'cited on that answer', or who it was cited 'instead of'", () => {
    expect(html).not.toMatch(/Cited on that answer/i);
    expect(html).not.toMatch(/instead of you/);
    expect(html).not.toMatch(/previous owner/);
  });

  it("speaks of one assistant, and never calls it live", () => {
    expect(html).not.toMatch(ENGINES);
    expect(html).not.toMatch(LIVE);
  });
});

describe("the source-check section's links", () => {
  it("points a name collision at its remedy in the fix list", () => {
    const html = renderText(sourceCheck, {
      view: { ...VIEW, namesake: { domain: "examplestudios.com", count: 4 } },
    });
    expect(seen(html)).toContain("examplestudios.com");
    expect(html).toContain(`href="#${TOC_TARGETS.fixes}"`);
  });

  it("points the statements the site confirms at the section that lists them", () => {
    expect(renderText(sourceCheck, { view: VIEW })).toContain(`href="#${TOC_TARGETS.passes}"`);
  });
});

describe("the source-check section's own-site count", () => {
  it("says how often the assistant cited the site itself", () => {
    const view = {
      ...VIEW,
      brandedProbes: VIEW.brandedProbes.map((p) => ({
        ...p,
        citedDomains: [
          ...p.citedDomains,
          "www.example-studio.test",
          "blog.example-studio.test",
          "example-studio.test",
          "example-studio.test",
          "example-studio.test",
        ],
      })),
    };
    expect(seen(renderText(sourceCheck, { view }))).toContain(`${ownSiteCitations(view)} times`);
  });
});

describe("the accuracy lede", () => {
  it("never calls the assistant live", () => {
    const html = renderText(lede, { view: VIEW });
    expect(seen(html)).toContain("Example Studio");
    expect(html).not.toMatch(LIVE);
    expect(html).not.toMatch(ENGINES);
  });
});

describe("GoalFit", () => {
  const withSource = (source: string): string =>
    seen(
      renderText(goalFit, {
        view: toReportView({
          ...ALL_PASS_REPORT,
          goalFit: { ok: true, data: { ...allPass.goalFit.data, source } },
        }),
      }),
    );

  it("states an operator's goal as their choice, not as our inference", () => {
    const operator = withSource("operator");
    const inferred = withSource("inferred");
    const framing = (s: string): string => s.slice(0, s.indexOf(GOAL_LABELS.enquire));
    expect(operator).toContain(GOAL_LABELS.enquire);
    expect(inferred).toContain(GOAL_LABELS.enquire);
    expect(inferred).toContain("rather than asking you");
    expect(operator).not.toContain("rather than asking you");
    expect(framing(operator)).not.toBe(framing(inferred));
  });

  it("points a clean checklist at the section that lists the passes", () => {
    expect(renderText(goalFit, { view: toReportView(ALL_PASS_REPORT) })).toContain(
      `href="#${TOC_TARGETS.passes}"`,
    );
  });
});

describe("the print sheet tells the screen report's story", () => {
  const text = seen(printed(RICH));

  it("leads with the deterministic headline and opener, never the model's own summary", () => {
    expect(text).toContain(headlineFinding(VIEW).text);
    expect(text).toContain(openingSummary(VIEW)!);
    expect(text).toContain(auditedOn(VIEW)!);
    expect(text).not.toContain(MODEL_SUMMARY);
  });

  it("lists every fix, in the order allFixes ranks them", () => {
    const at = allFixes(VIEW).map((fix) => text.indexOf(fix.title));
    expect(at.length).toBeGreaterThan(1);
    for (const i of at) expect(i).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows the passage behind every question, and the site's words behind a contradiction", () => {
    for (const q of allPass.analyze.data.buyerQuestions) expect(text).toContain(q.evidence);
    expect(text).toContain(CONTRADICTED.siteQuote!);
  });

  it("asserts nothing about what crawlers do with JavaScript", () => {
    expect(text).not.toMatch(/Most AI crawlers/);
    expect(text).not.toMatch(/crawlers (run|execute) no/i);
    expect(text).not.toMatch(/assumption/);
  });
});
