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
import { allFixes, auditedOn, collisionBlock, headlineFinding, TOC_TARGETS } from "./narrative";
import { editableTargets } from "./editable";

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
// Our paraphrase, our reason and the row's sources are sentinels: none of them
// may reach the page under a statement the site does not make. The engine's
// own words are what the row prints (W2).
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
        settled: false,
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
      CONTRADICTED.engineQuote,
      CONTRADICTED.siteQuote!,
      ABSENT.engineQuote,
      // UNVERIFIED names a person, so it is withheld and counted (W2).
      "named people",
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

  it("prints each unsourced statement in the assistant's words, with nothing of ours under it", () => {
    expect(html).not.toMatch(/not on your site/i);
    expect(html).not.toMatch(/did not find these on your site|What we could not check/i);
    // W2: never our paraphrase of a statement the site does not make, and a
    // withheld statement in neither form.
    for (const sentinel of [
      ABSENT.claim,
      CONTRADICTED.claim,
      UNVERIFIED.claim,
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

  // W2 (BR-09): listed in the section itself with both quotes, so the reader
  // can judge them, rather than pointed at a count in the passes.
  it("lists the statements the site confirms, with both quotes", () => {
    const html = seen(renderText(sourceCheck, { view: VIEW }));
    expect(html).toContain("What your site backs up");
    expect(html).toContain("based in Austin, Texas");
    expect(html).toContain("Example Studio, Austin, Texas");
  });
});

/** The all-pass report as another business, whose category answers cited
 *  exactly these domains, one list per answer, and whose branded answer
 *  described only itself. */
const citing = (businessName: string, url: string, perAnswer: string[][]): AuditReport => {
  const probes = (ALL_PASS_REPORT as { probes: { data: Record<string, unknown> } }).probes;
  return {
    ...ALL_PASS_REPORT,
    url,
    businessName,
    probes: {
      ok: true,
      data: {
        ...probes.data,
        answers: perAnswer.map((citedDomains, i) => ({
          engine: "claude",
          query: `category question ${i}`,
          kind: "category",
          domainCited: false,
          brandMentioned: false,
          countedAsVisible: false,
          citedDomains,
          snippet: "",
          truncated: false,
          askedAt: "2026-10-19T20:00:00.000Z",
        })),
      },
    },
    accuracy: {
      ok: true,
      data: {
        ...allPass.accuracy.data,
        conflation: { detected: false, otherNames: [], engineQuote: null },
      },
    },
  } as AuditReport;
};

const COLLISION_HEADING = "Someone else is answering to your name";
const MORE_THAN_ANY = "more than any other source";

// P1-77. A live report said someone else was answering to its
// name because "ca.linkedin.com" was read as "ca", and made "Say which ABCA
// Screening you are" its first fix. The most-cited sources had 4 citations
// each; the "namesake" had 1 and was printed as "more than any other source".
describe("a name collision is claimed only when there is one", () => {
  const abca = citing("ABCA Screening", "https://abcascreening.example/", [
    ["ca.linkedin.com", "shrm.org", "backgroundchecks.com"],
    ["shrm.org", "backgroundchecks.com"],
    ["shrm.org", "backgroundchecks.com"],
    ["shrm.org", "backgroundchecks.com"],
  ]);
  // The positive control: Reddoor's own situation, the one the block was
  // written for. A Virginia agency on the same name, cited most of all.
  const reddoor = citing("Reddoor Creative", "https://reddoorla.com/", [
    ["reddoorcreative.com", "clutch.co"],
    ["reddoorcreative.com", "linkedin.com"],
    ["reddoorcreative.com"],
  ]);
  // A real namesake that is NOT the most-cited source.
  const outcited = citing("Reddoor Creative", "https://reddoorla.com/", [
    ["reddoorcreative.com", "clutch.co"],
    ["clutch.co"],
    ["clutch.co"],
  ]);
  // A real namesake that out-cites every other source but the prospect's own
  // site, which the field leaves out.
  const ownMore = citing("Reddoor Creative", "https://reddoorla.com/", [
    ["reddoorcreative.com", "reddoorla.com"],
    ["reddoorla.com"],
    ["reddoorla.com"],
  ]);
  // Round 5's input: the namesake split across two hosts, and the host the
  // sentence prints (blog., 3) cited less than clutch.co (4).
  const split = citing("Reddoor Creative", "https://reddoorla.com/", [
    ["reddoorcreative.com", "blog.reddoorcreative.com", "clutch.co"],
    ["reddoorcreative.com", "blog.reddoorcreative.com", "clutch.co"],
    ["blog.reddoorcreative.com", "clutch.co"],
    ["clutch.co"],
  ]);
  // A tie with the prospect's own site is not "more than any other" either.
  const ownTie = citing("Reddoor Creative", "https://reddoorla.com/", [
    ["reddoorcreative.com", "reddoorla.com"],
  ]);

  it.each([
    [
      "the source-check section",
      (r: AuditReport) => renderText(sourceCheck, { view: toReportView(r) }),
    ],
    ["the print sheet", printed],
  ])("%s: says nothing about a namesake on ABCA's report", (_label, render) => {
    expect(seen(render(abca))).not.toContain(COLLISION_HEADING);
    expect(seen(render(abca))).not.toContain("ca.linkedin.com was cited");
  });

  it.each([
    [
      "the source-check section",
      (r: AuditReport) => renderText(sourceCheck, { view: toReportView(r) }),
    ],
    ["the print sheet", printed],
  ])("%s: still names Reddoor's namesake, and says it leads", (_label, render) => {
    const text = seen(render(reddoor));
    expect(text).toContain(COLLISION_HEADING);
    expect(text).toContain("reddoorcreative.com");
    expect(text).toContain(MORE_THAN_ANY);
  });

  it.each([
    [
      "the source-check section",
      (r: AuditReport) => renderText(sourceCheck, { view: toReportView(r) }),
    ],
    ["the print sheet", printed],
  ])("%s: never says a namesake leads when another source was cited more", (_label, render) => {
    for (const report of [outcited, ownMore, ownTie, split]) {
      const text = seen(render(report));
      expect(text).toContain("reddoorcreative.com");
      expect(text).not.toContain(MORE_THAN_ANY);
    }
  });

  it("makes the collision the first fix only where there is one", () => {
    expect(allFixes(toReportView(abca)).map((f) => f.title)).not.toContainEqual(
      expect.stringContaining("Say which"),
    );
    expect(allFixes(toReportView(reddoor))[0]?.title).toContain("Say which Reddoor Creative");
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

/**
 * The "not sure which you are" finding is the branded answer's to make, not
 * ours. It was written around our own audit, where the answer could not tell
 * which of several same-named studios was meant, and it fired on a report
 * whose answer named the business first — city, work, site — and then said a
 * cancer biomarker and a billing credential share its initials. The lead
 * finding called those two "businesses".
 */
describe("the name-collision finding follows the branded answer's own verdict", () => {
  const WHO = "Example Studio";
  const HEADING = `The assistant is not sure which ${WHO} you are`;
  const withConflation = (conflation: Record<string, unknown>): AuditReport => ({
    ...ALL_PASS_REPORT,
    businessName: WHO,
    accuracy: {
      ok: true,
      data: { ...allPass.accuracy.data, conflation },
    },
  });
  const surfaces: Array<[string, (r: AuditReport) => string]> = [
    ["the source-check section", (r) => seen(renderText(sourceCheck, { view: toReportView(r) }))],
    ["the print sheet", (r) => seen(printed(r))],
  ];
  const fixTitles = (r: AuditReport) => allFixes(toReportView(r)).map((f) => f.title);

  // An answer that described only the business itself.
  const onlyItself = withConflation({
    detected: false,
    settled: true,
    otherNames: [],
    engineQuote: null,
  });
  // An answer that named the business and set an unrelated namesake apart.
  const setApart = withConflation({
    detected: true,
    settled: true,
    otherNames: ["EXST-1 (a protein marker)"],
    engineQuote: "It is unrelated to EXST-1, a protein marker that shares the initials.",
  });
  // Stored before the audit asked whether the answer settled it.
  const legacy = withConflation({
    detected: true,
    otherNames: ["EXST-1 (a protein marker)"],
    engineQuote: "It is unrelated to EXST-1, a protein marker that shares the initials.",
  });
  // An answer that could not tell, whose one other is a credential.
  const CREDENTIAL = "Example Studio Certified (a design credential offered by a trade body)";
  const unsureCredential = withConflation({
    detected: true,
    settled: false,
    otherNames: [CREDENTIAL],
    engineQuote: "I can't tell which Example Studio you mean.",
  });

  it.each(surfaces)(
    "%s: shows no collision block when the answer described only itself",
    (_l, render) => {
      expect(render(onlyItself)).not.toContain(HEADING);
      expect(render(onlyItself)).not.toContain(COLLISION_HEADING);
    },
  );

  it.each(surfaces)(
    "%s: shows no collision block when the answer settled which one",
    (_l, render) => {
      for (const r of [setApart, legacy]) {
        expect(render(r)).not.toContain(HEADING);
        expect(render(r)).not.toContain("EXST-1");
      }
    },
  );

  it("neither leads on it nor makes it Fix 1 unless the answer was unsure", () => {
    for (const r of [onlyItself, setApart, legacy]) {
      expect(headlineFinding(toReportView(r)).kind).not.toBe("name-collision");
      expect(fixTitles(r)).not.toContainEqual(expect.stringContaining("Say which"));
    }
    expect(headlineFinding(toReportView(unsureCredential)).kind).toBe("name-collision");
    expect(fixTitles(unsureCredential)[0]).toContain(`Say which ${WHO}`);
  });

  it.each(surfaces)(
    "%s: names a credential as the answer did, and never calls it a business",
    (_l, render) => {
      const text = render(unsureCredential);
      // The block alone: the rest of the page has its own uses of the word
      // ("your business details in structured data").
      const block = text.slice(text.indexOf(HEADING), text.indexOf("The remedy is"));
      expect(block).toContain(HEADING);
      expect(block).toContain(CREDENTIAL);
      expect(block).not.toMatch(/\bbusiness(es)?\b/i);
    },
  );

  it("never calls the others businesses in the lead finding", () => {
    const h = headlineFinding(toReportView(unsureCredential)).text;
    expect(h).toContain(`not sure which ${WHO} you are`);
    expect(h).not.toMatch(/\bbusiness(es)?\b/i);
  });

  it("lists the block's two lines for the editor, and honours both on screen and in print", () => {
    const view = toReportView(unsureCredential);
    const targets = editableTargets(view, unsureCredential);
    const heading = targets.find((t) => t.key === "composed:collision.heading");
    const detail = targets.find((t) => t.key === "composed:collision.detail");
    expect(heading?.text).toBe(HEADING);
    expect(detail?.text).toContain(CREDENTIAL);
    const overrides = {
      "composed:collision.heading": { original: HEADING, text: "EDITED-HEADING" },
      "composed:collision.detail": { original: detail!.text, text: "EDITED-DETAIL" },
    };
    const screen = seen(renderText(sourceCheck, { view: { ...view, overrides } }));
    const print = seen(renderText(printSheet, { data: { report: unsureCredential, overrides } }));
    for (const text of [screen, print]) {
      expect(text).toContain("EDITED-HEADING");
      expect(text).toContain("EDITED-DETAIL");
      expect(text).not.toContain(CREDENTIAL);
    }
    // An override recorded against other generated words is withheld.
    const stale = {
      "composed:collision.heading": { original: "SOMETHING ELSE", text: "STALE-EDIT" },
    };
    expect(seen(renderText(sourceCheck, { view: { ...view, overrides: stale } }))).not.toContain(
      "STALE-EDIT",
    );
  });

  it("does not put 'business' in the block when the report has no name on record", () => {
    const anon = { ...unsureCredential, businessName: null } as AuditReport;
    const b = collisionBlock(toReportView(anon))!;
    expect(b.heading).toBe("The assistant is not sure which one you are");
    expect(`${b.heading} ${b.detail}`).not.toMatch(/\bbusiness(es)?\b/i);
  });

  it("lets the report's editor reword the block, per report", () => {
    const view = toReportView(unsureCredential);
    const generated = renderText(sourceCheck, { view });
    expect(seen(generated)).toContain(HEADING);
    const edited = {
      ...view,
      overrides: {
        "composed:collision.heading": { original: HEADING, text: "EDITED-HEADING" },
      },
    };
    expect(seen(renderText(sourceCheck, { view: edited }))).toContain("EDITED-HEADING");
  });
});
