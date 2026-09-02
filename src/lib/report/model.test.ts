import { describe, it, expect } from "vitest";
import {
  toReportView,
  findNamesake,
  goalVerdict,
  fieldShape,
  isListingSite,
  citationsFrom,
  type ProbeAnswer,
} from "./model";
import type { AuditReport } from "./fetch";

/**
 * The fixtures here supply only the stages `toReportView` actually reads —
 * scores, analyze, probes. Requiring `crawl`, `checks` and `lighthouse`, which
 * it never touches, would make these tests brittle to schema changes they do
 * not cover, and would bury what each case is actually about.
 *
 * The cast is the seam between what the contract promises and what this
 * function is written to survive. The payload arrives over a network, and the
 * whole point of the function is that a missing or failed piece degrades to
 * null rather than throwing — which is precisely what a strictly-typed fixture
 * cannot express.
 */
const asReport = (o: unknown): AuditReport => o as AuditReport;

const probe = (over: Partial<ProbeAnswer> = {}): ProbeAnswer => ({
  engine: "claude",
  query: "branding agency Los Angeles",
  kind: "category",
  domainCited: false,
  brandMentioned: false,
  citedDomains: ["clutch.co"],
  snippet: "…",
  truncated: false,
  askedAt: "2026-08-25T20:00:00.000Z",
  ...over,
});

const question = (answered: "yes" | "partial" | "no") => ({
  question: "q",
  answered,
  quotable: false,
  page: null,
  evidence: null,
});

const FULL = {
  url: "https://reddoorla.com/",
  businessName: "Reddoor Creative",
  generatedAt: "2026-08-25T20:52:00.000Z",
  scores: { findability: 91, readability: 83, answers: 65, aiVisibility: 0 },
  // `agentAccess` sits on CRAWL, where the pipeline actually writes it. These
  // fixtures had it on `checks`, which is where the renderer was reading it
  // from — so the test agreed with the bug instead of with the payload.
  crawl: { ok: true, data: { agentAccess: [{ agent: "GPTBot" }, { agent: "ClaudeBot" }] } },
  checks: {
    ok: true,
    data: {
      crawlerAccessMeasured: true,
      crawlerAccess: { blockedAi: [], blockedClassical: [] },
    },
  },
  analyze: {
    ok: true,
    data: {
      buyerQuestions: [
        question("yes"),
        question("yes"),
        question("partial"),
        question("no"),
        question("no"),
      ],
      fixes: [
        { title: "Say what you do", why: "…", impact: "high", effort: "low", tier: "content" },
      ],
      narrative: { findability: "a", readability: "b", answers: "c" },
    },
  },
  probes: {
    ok: true,
    data: {
      answers: [
        probe(),
        probe({ query: "packaging design agency San Antonio Texas" }),
        probe({ kind: "branded", query: "who is Reddoor Creative", brandMentioned: true }),
      ],
      visibilityScore: 0,
      brandedRecognized: true,
      competitorsSeen: [
        { domain: "reddoorcreative.com", count: 13 },
        { domain: "linkedin.com", count: 11 },
      ],
    },
  },
};

describe("toReportView — a complete report", () => {
  it("splits probes by kind", () => {
    const v = toReportView(asReport(FULL));
    expect(v.categoryProbes).toHaveLength(2);
    expect(v.brandedProbes).toHaveLength(1);
  });

  // The honest denominator. A bare 0 invites an argument; "0 of 2" invites a
  // question.
  it("counts the visibility denominator from the searches actually run", () => {
    expect(toReportView(asReport(FULL)).visibility).toEqual({ named: 0, total: 2 });
  });

  it("counts a brand mention as named, not only a citation", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        probes: {
          ok: true,
          data: {
            ...FULL.probes.data,
            answers: [probe({ brandMentioned: true }), probe()],
          },
        },
      }),
    );
    expect(v.visibility).toEqual({ named: 1, total: 2 });
  });

  // The regression: `total` was the number of probes that ANSWERED, so probes
  // the engine errored on vanished from the denominator and a flakier run
  // reported better. Five asked, two answered, one named → "1 of 5", not "1 of 2".
  it("takes the denominator from what was attempted, not from what came back", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        probes: {
          ok: true,
          data: {
            ...FULL.probes.data,
            answers: [probe({ brandMentioned: true, countedAsVisible: true }), probe()],
            categoryProbes: { attempted: 5, answered: 2 },
          },
        },
      }),
    );
    expect(v.visibility).toEqual({ named: 1, total: 5 });
  });

  // Reports written before the audit recorded attempts have nothing better to
  // offer, so they keep the old behaviour rather than losing the section.
  it("falls back to the answered count for a report stored before attempts were recorded", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        probes: {
          ok: true,
          data: { ...FULL.probes.data, answers: [probe({ brandMentioned: true }), probe()] },
        },
      }),
    );
    expect(v.visibility).toEqual({ named: 1, total: 2 });
  });

  // The receipt line must not be able to contradict the score beside it: the
  // audit only counts an unprompted mention when the name cannot be a
  // coincidence, and this file used to ignore that gate entirely.
  it("defers to the scorer's verdict rather than re-deriving it more loosely", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        probes: {
          ok: true,
          data: {
            ...FULL.probes.data,
            // Mentioned in prose, but the scorer judged the name too generic for
            // the mention to mean anything. It must not be reported as named.
            answers: [probe({ brandMentioned: true, countedAsVisible: false }), probe()],
            categoryProbes: { attempted: 2, answered: 2 },
          },
        },
      }),
    );
    expect(v.visibility).toEqual({ named: 0, total: 2 });
  });

  it("tallies the buyer questions", () => {
    expect(toReportView(asReport(FULL)).questionTally).toEqual({
      yes: 2,
      partial: 1,
      no: 2,
      unknown: 0,
    });
  });

  it("counts a question we could not get an answer for apart from the rest", () => {
    // "unknown" is our own gap — the model skipped a question we asked. It has
    // to be visible (the reader should see what we asked) and it has to stay
    // out of yes/partial/no, because every one of those is a claim about their
    // site and this is a claim about our measurement.
    const v = toReportView(
      asReport({
        ...FULL,
        analyze: {
          ...FULL.analyze,
          data: {
            ...FULL.analyze.data,
            buyerQuestions: [
              { question: "a", answered: "yes", quotable: true, page: null, evidence: "x" },
              { question: "b", answered: "unknown", quotable: false, page: null, evidence: null },
            ],
          },
        },
      }),
    );
    expect(v.questionTally).toEqual({ yes: 1, partial: 0, no: 0, unknown: 1 });
  });

  it("reports crawler reach as a fact, not a score", () => {
    // Findability saturates — 26 of the 29 sites audited so far score 88 or
    // above — so as a bar it is decoration that makes the two bars beside it
    // look like the same kind of claim. What it actually establishes is one
    // yes/no: can the crawlers get in.
    const v = toReportView(asReport(FULL));
    expect(v.crawlerReach).toEqual({ measured: true, blocked: [], checked: 2 });
  });

  it("names the crawlers that are blocked", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        checks: {
          ...FULL.checks,
          data: {
            ...FULL.checks.data,
            crawlerAccessMeasured: true,
            crawlerAccess: { blockedAi: ["GPTBot"], blockedClassical: [] },
          },
        },
      }),
    );
    expect(v.crawlerReach).toEqual({ measured: true, blocked: ["GPTBot"], checked: 2 });
  });

  it("says so when the robots fetch failed, rather than reporting open access", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        checks: {
          ...FULL.checks,
          data: { ...FULL.checks.data, crawlerAccessMeasured: false },
        },
      }),
    );
    expect(v.crawlerReach?.measured).toBe(false);
  });

  it("carries the accuracy stage through", () => {
    const v = toReportView(
      asReport({
        ...FULL,
        accuracy: {
          ok: true,
          data: {
            assertions: [
              {
                claim: "Open on Saturdays",
                verdict: "absent",
                engineQuote: "open on Saturdays",
                siteQuote: null,
                unverifiedReason: null,
                nearbyMention: null,
                sourceDomains: ["yelp.com"],
                query: "who is Reddoor Creative",
                engine: "claude",
              },
            ],
            sources: [{ domain: "yelp.com", owner: "platform", because: "A listing site." }],
            siteFullyRead: true,
            pagesRead: 9,
            pagesTotal: 9,
            answersRead: 2,
          },
        },
      }),
    );
    expect(v.accuracy?.assertions).toHaveLength(1);
    expect(v.accuracy?.sources[0]?.owner).toBe("platform");
  });

  it("reads a failed accuracy stage as not measured, not as nothing found", () => {
    // The distinction the section lives or dies on: "we had no engine answer to
    // read" and "the engine said nothing wrong about you" are opposite claims.
    const v = toReportView(asReport({ ...FULL, accuracy: { ok: false, error: "skipped" } }));
    expect(v.accuracy).toBeNull();
  });

  it("carries the fixes and narrative through", () => {
    const v = toReportView(asReport(FULL));
    expect(v.fixes).toHaveLength(1);
    expect(v.narrative?.answers).toBe("c");
  });
});

// Every stage may legitimately fail without failing the audit. "Not measured"
// must never render as "zero" — that is the difference between an honest report
// and a wrong one.
describe("toReportView — degraded stages", () => {
  it("survives a failed analyze stage", () => {
    const v = toReportView(asReport({ ...FULL, analyze: { ok: false, error: "model refused" } }));
    expect(v.fixes).toEqual([]);
    expect(v.buyerQuestions).toEqual([]);
    expect(v.narrative).toBeNull();
  });

  // Null, not {named:0,total:0} — "we did not ask" and "we asked and you were
  // absent" are different claims about the prospect.
  it("reports no visibility measurement when the probe stage failed", () => {
    const v = toReportView(
      asReport({ ...FULL, probes: { ok: false, error: "no engine answered" } }),
    );
    expect(v.visibility).toBeNull();
    expect(v.brandedRecognized).toBeNull();
    expect(v.categoryProbes).toEqual([]);
  });

  // The audit began recording the answer space long after these reports
  // started being stored, so most of what exists in the database lacks it. The
  // page must say "not measured" for those rather than reconstructing the
  // arithmetic here — there is one implementation of it and it has tests.
  it("reports no answer space for a report stored before it was measured", () => {
    const v = toReportView(asReport(FULL));
    expect(v.answerSpace).toBeNull();
  });

  it("passes the answer space through when the run recorded one", () => {
    const answerSpace = {
      answersWithCitations: 4,
      queriesAsked: 5,
      citationsTotal: 30,
      distinctDomains: 22,
      topSources: [{ domain: "rival.example", count: 3, share: 0.1 }],
      domainsToHalf: 9,
      medianWidthPerAnswer: 7,
      ownDomainRank: null,
      ownDomainCount: 0,
      topRival: { domain: "rival.example", count: 3, share: 0.1 },
    };
    const probes = FULL.probes as { ok: true; data: Record<string, unknown> };
    const v = toReportView(
      asReport({ ...FULL, probes: { ok: true, data: { ...probes.data, answerSpace } } }),
    );
    expect(v.answerSpace).toEqual(answerSpace);
  });

  // Opposite claims: "we did not measure" and "nothing is broken". Only one of
  // them is ours to make, and a report stored before these checks existed has
  // to produce the first.
  it("reports the site checks as not measured when the run predates them", () => {
    const v = toReportView(asReport(FULL));
    expect(v.journey).toBeNull();
    expect(v.consistency).toBeNull();
    expect(v.assets).toBeNull();
  });

  it("passes the site checks through when the run recorded them", () => {
    const journey = {
      affordances: [{ kind: "tel" as const, page: "https://acme.example/", detail: "5550100" }],
      pages: [{ url: "https://acme.example/", clicksToContact: 0, internalLinks: 3 }],
      deadEnds: [],
      worstClicksToContact: 0,
      pagesExamined: 1,
    };
    const consistency = {
      phones: [{ normalized: "5550100", seenAs: ["555-0100"], pages: ["https://acme.example/"] }],
      emails: [],
      copyrightYears: [2026],
      newestCopyrightYear: 2026,
      pagesOffTemplate: [],
      sharedNavLinks: 5,
      pagesExamined: 1,
    };
    const assets = {
      brokenLinks: [],
      brokenImages: [],
      heaviestImages: [],
      imageBytesMeasured: 1_000_000,
      imagesWithKnownSize: 4,
      linksFound: 20,
      linksChecked: 20,
      imagesFound: 4,
      imagesChecked: 4,
    };
    // FULL carries no `checks` stage — this function never read one before, so
    // the fixture never supplied it. Added here rather than to FULL so the
    // other cases keep proving the absent-stage path.
    const v = toReportView(
      asReport({
        ...FULL,
        checks: { ok: true, data: { journey, consistency } },
        assets: { ok: true, data: assets },
      }),
    );
    expect(v.journey).toEqual(journey);
    expect(v.consistency).toEqual(consistency);
    expect(v.assets).toEqual(assets);
  });

  it("reports no assets when that stage failed", () => {
    const v = toReportView(asReport({ ...FULL, assets: { ok: false, error: "skipped" } }));
    expect(v.assets).toBeNull();
  });

  it("survives stages being absent entirely", () => {
    const v = toReportView(asReport({ url: "https://acme.example/", businessName: null }));
    expect(v.scores).toEqual({
      findability: null,
      readability: null,
      answers: null,
      aiVisibility: null,
    });
    expect(v.visibility).toBeNull();
    expect(v.namesake).toBeNull();
  });
});

describe("findNamesake", () => {
  const cited = [
    { domain: "reddoorcreative.com", count: 13 },
    { domain: "linkedin.com", count: 11 },
  ];

  // The real finding from the first production audit: a Virginia agency cited
  // more often than the prospect, on the prospect's own name.
  it("finds a cited domain trading on the business's name", () => {
    expect(findNamesake("Reddoor Creative", "https://reddoorla.com/", cited)).toEqual({
      domain: "reddoorcreative.com",
      count: 13,
    });
  });

  it("ignores the prospect's own domain", () => {
    expect(
      findNamesake("Reddoor LA", "https://reddoorla.com/", [{ domain: "reddoorla.com", count: 4 }]),
    ).toBeNull();
  });

  it("ignores the prospect's own domain on www", () => {
    expect(
      findNamesake("Reddoor LA", "https://reddoorla.com/", [
        { domain: "www.reddoorla.com", count: 4 },
      ]),
    ).toBeNull();
  });

  it("does not match an unrelated directory", () => {
    expect(
      findNamesake("Reddoor Creative", "https://reddoorla.com/", [
        { domain: "clutch.co", count: 8 },
      ]),
    ).toBeNull();
  });

  // A short name matches far too much, and asserting a collision to a prospect
  // who then checks is worse than staying quiet.
  it("refuses to guess from a short business name", () => {
    expect(
      findNamesake("Ace", "https://ace.example/", [{ domain: "acetate.com", count: 2 }]),
    ).toBeNull();
  });

  it("returns null with no business name", () => {
    expect(findNamesake(null, "https://acme.example/", cited)).toBeNull();
  });

  it("survives an unparseable url", () => {
    expect(findNamesake("Reddoor Creative", "not a url", cited)).toEqual({
      domain: "reddoorcreative.com",
      count: 13,
    });
  });
});

describe("goalVerdict", () => {
  // The first full sentence the client reads about their own business. The
  // template this replaced rendered "1 of the 6 things it needs are not".
  it("agrees in number", () => {
    expect(goalVerdict(1, 6)).toBe("One of the six things it needs is not in place.");
    expect(goalVerdict(2, 6)).toBe("Two of the six things it needs are not in place.");
  });

  it("does not count a site as failing everything when it fails everything measured", () => {
    expect(goalVerdict(4, 4)).toBe("None of what it needs to do that is in place.");
  });

  it("says so plainly when nothing is missing", () => {
    expect(goalVerdict(0, 5)).toBe("Everything it needs to do that is in place.");
  });

  it("never claims a verdict it could not measure", () => {
    // Every requirement unmeasured. Reporting "everything is in place" here
    // would turn a total absence of measurement into a clean bill of health.
    expect(goalVerdict(0, 0)).toBe("We could not judge any of what it needs to do that.");
  });

  it("falls back to digits past the number words", () => {
    expect(goalVerdict(12, 20)).toBe("12 of the 20 things it needs are not in place.");
  });
});

describe("fieldShape", () => {
  // Replaced the AI Visibility score. The score said "0" and stopped; a reader
  // could do nothing with it but feel it. The same citations answer a useful
  // question instead — is this a room of directories, or a room of businesses
  // like yours? — because that is what decides whether being in it is
  // reachable at all.
  it("tells a directory from a business's own site", () => {
    expect(isListingSite("yelp.com")).toBe(true);
    expect(isListingSite("reviews.birdeye.com")).toBe(true);
    expect(isListingSite("www.zocdoc.com")).toBe(true);
    expect(isListingSite("hermosasmilesdentistry.com")).toBe(false);
  });

  it("does not mistake a suffix for a listing site", () => {
    expect(isListingSite("notyelp.com")).toBe(false);
    expect(isListingSite("myg2.com")).toBe(false);
  });

  it("splits citations by what kind of source they went to", () => {
    // Beachfront's real field, trimmed.
    const shape = fieldShape([
      { domain: "yelp.com", count: 16 },
      { domain: "patientconnect365.com", count: 9 },
      { domain: "hermosasmilesdentistry.com", count: 8 },
      { domain: "drpalani.com", count: 8 },
      { domain: "reviews.birdeye.com", count: 4 },
    ]);
    expect(shape).toEqual({ listings: 29, other: 16, total: 45 });
  });

  it("counts two buckets and claims nothing about what the other one is", () => {
    // An earlier version reported "the websites of N businesses" and real data
    // killed it immediately: Reddoor's non-directory citations included
    // rocketreach.co and the US Patent Office. Whatever image-ppubs.uspto.gov
    // is, it is not a design agency, and a report that calls it one has lost
    // the reader.
    const shape = fieldShape([
      { domain: "yelp.com", count: 3 },
      { domain: "image-ppubs.uspto.gov", count: 4 },
      { domain: "rocketreach.co", count: 5 },
    ]);
    expect(shape).toEqual({ listings: 3, other: 9, total: 12 });
  });

  it("survives an empty field", () => {
    expect(fieldShape([])).toEqual({ listings: 0, other: 0, total: 0 });
  });
});

describe("citationsFrom", () => {
  const probe = (
    query: string,
    kind: ProbeAnswer["kind"],
    citedDomains: string[],
  ): ProbeAnswer => ({
    engine: "claude",
    query,
    kind,
    domainCited: false,
    brandMentioned: false,
    citedDomains,
    snippet: "",
    truncated: false,
    askedAt: "2026-08-27T00:00:00.000Z",
  });

  it("counts only the category answers the chart's caption promises", () => {
    // The real defect. Beachfront's chart led with yelp.com at 16 and showed
    // dochopkins.com at 7 — every one of those seven came from asking about
    // Beachfront BY NAME, none from a category search. The caption above it
    // reads "the questions a buyer types before they have heard of you".
    const category = [
      probe("dentist redondo beach", "category", ["hermosasmiles.com", "yelp.com"]),
      probe("cosmetic dentist south bay", "category", ["hermosasmiles.com"]),
    ];
    const out = citationsFrom(category, "https://beachfrontdentistry.com/", []);
    expect(out).toEqual([
      { domain: "hermosasmiles.com", count: 2 },
      { domain: "yelp.com", count: 1 },
    ]);
  });

  it("leaves the prospect's own domain out — it is charted as its own row", () => {
    const out = citationsFrom(
      [
        probe("q", "category", [
          "beachfrontdentistry.com",
          "www.beachfrontdentistry.com",
          "yelp.com",
        ]),
      ],
      "https://beachfrontdentistry.com/",
      [],
    );
    expect(out.map((d) => d.domain)).toEqual(["yelp.com"]);
  });

  it("normalises www and case so one source is not charted twice", () => {
    const out = citationsFrom(
      [probe("q", "category", ["Yelp.com", "www.yelp.com"])],
      "https://x.com/",
      [],
    );
    expect(out).toEqual([{ domain: "yelp.com", count: 2 }]);
  });

  it("falls back to the stored list when no category answers were kept", () => {
    // An empty chart would read as "nobody was cited", which is a different
    // and false claim from "we no longer have the per-answer detail".
    const stored = [{ domain: "yelp.com", count: 3 }];
    expect(citationsFrom([], "https://x.com/", stored)).toBe(stored);
  });

  it("survives an unparseable url without dropping every citation", () => {
    const out = citationsFrom([probe("q", "category", ["yelp.com"])], "not a url", []);
    expect(out).toEqual([{ domain: "yelp.com", count: 1 }]);
  });
});
