import { describe, it, expect } from "vitest";
import { toReportView, findNamesake } from "./model";

const probe = (over: Record<string, unknown> = {}) => ({
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
    const v = toReportView(FULL);
    expect(v.categoryProbes).toHaveLength(2);
    expect(v.brandedProbes).toHaveLength(1);
  });

  // The honest denominator. A bare 0 invites an argument; "0 of 2" invites a
  // question.
  it("counts the visibility denominator from the searches actually run", () => {
    expect(toReportView(FULL).visibility).toEqual({ named: 0, total: 2 });
  });

  it("counts a brand mention as named, not only a citation", () => {
    const v = toReportView({
      ...FULL,
      probes: {
        ok: true,
        data: {
          ...FULL.probes.data,
          answers: [probe({ brandMentioned: true }), probe()],
        },
      },
    });
    expect(v.visibility).toEqual({ named: 1, total: 2 });
  });

  it("tallies the buyer questions", () => {
    expect(toReportView(FULL).questionTally).toEqual({ yes: 2, partial: 1, no: 2 });
  });

  it("carries the fixes and narrative through", () => {
    const v = toReportView(FULL);
    expect(v.fixes).toHaveLength(1);
    expect(v.narrative?.answers).toBe("c");
  });
});

// Every stage may legitimately fail without failing the audit. "Not measured"
// must never render as "zero" — that is the difference between an honest report
// and a wrong one.
describe("toReportView — degraded stages", () => {
  it("survives a failed analyze stage", () => {
    const v = toReportView({ ...FULL, analyze: { ok: false, error: "model refused" } });
    expect(v.fixes).toEqual([]);
    expect(v.buyerQuestions).toEqual([]);
    expect(v.narrative).toBeNull();
  });

  // Null, not {named:0,total:0} — "we did not ask" and "we asked and you were
  // absent" are different claims about the prospect.
  it("reports no visibility measurement when the probe stage failed", () => {
    const v = toReportView({ ...FULL, probes: { ok: false, error: "no engine answered" } });
    expect(v.visibility).toBeNull();
    expect(v.brandedRecognized).toBeNull();
    expect(v.categoryProbes).toEqual([]);
  });

  it("survives stages being absent entirely", () => {
    const v = toReportView({ url: "https://acme.example/", businessName: null });
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
