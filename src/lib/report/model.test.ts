import { describe, it, expect } from "vitest";
import { toReportView, findNamesake, goalVerdict, type ProbeAnswer } from "./model";
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
    expect(toReportView(asReport(FULL)).questionTally).toEqual({ yes: 2, partial: 1, no: 2 });
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
