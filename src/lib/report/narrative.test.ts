import { describe, it, expect } from "vitest";
import {
  toReportView,
  type Assertion,
  type BuyerQuestion,
  type GoalRequirement,
  type ReportView,
} from "./model";
import type { AuditReport } from "./fetch";
import {
  allFixes,
  collisionFix,
  displayQuote,
  headlineFinding,
  healthFixes,
  passes,
  passCount,
} from "./narrative";
import { healthRows } from "./health";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";

/**
 * The narrative layer: the one sentence the hero leads with, and the one
 * disclosure everything that passed collapses into.
 *
 * Every case starts from the all-pass fixture and breaks exactly one thing, so
 * a test names the finding it expects to outrank everything else — which is
 * the whole contract of `headlineFinding`: a fixed priority, never the model's
 * choice and never the order the stages happened to run in.
 */
const asReport = (o: unknown): AuditReport => o as AuditReport;
type StageData = Record<string, unknown>;
const raw = ALL_PASS_REPORT as Record<string, { ok: boolean; data: StageData }>;

const view = (over: Record<string, unknown> = {}): ReportView =>
  toReportView(asReport({ ...raw, ...over }));

const stage = (name: string, patch: (data: StageData) => StageData) => ({
  [name]: { ok: true, data: patch(structuredClone(raw[name].data)) },
});

describe("the all-pass fixture is actually all pass", () => {
  const v = view();

  it("has every stage present", () => {
    expect(v.goalFit).not.toBeNull();
    expect(v.accuracy).not.toBeNull();
    expect(v.basics).not.toBeNull();
    expect(v.assets).not.toBeNull();
    expect(v.journey).not.toBeNull();
    expect(v.consistency).not.toBeNull();
    expect(v.crawlerReach?.measured).toBe(true);
    expect(v.visibility).not.toBeNull();
  });

  it("raises no finding anywhere", () => {
    expect(healthRows(v).filter((r) => r.alert)).toEqual([]);
    expect(v.goalFit?.requirements.filter((r) => r.status !== "met")).toEqual([]);
    expect(v.accuracy?.assertions.filter((a) => a.verdict !== "confirmed")).toEqual([]);
    expect(v.accuracy?.conflation.detected).toBe(false);
    expect(v.questionTally.partial + v.questionTally.no + v.questionTally.unknown).toBe(0);
    expect(v.crawlerReach?.blocked).toEqual([]);
    expect(v.namesake).toBeNull();
  });

  it("leads with all clear", () => {
    expect(headlineFinding(v).kind).toBe("all-clear");
  });

  it("collects a pass in every group", () => {
    const groups = passes(v);
    expect(groups.map((g) => g.title)).toEqual([
      "What an AI says about you",
      "Does it work",
      "Does your site do its job",
      "What buyers can learn from your site",
    ]);
    for (const g of groups) expect(g.items.length, g.title).toBeGreaterThan(0);
    expect(passCount(v)).toBe(groups.reduce((n, g) => n + g.items.length, 0));
  });
});

describe("healthRows", () => {
  it("lifts the same rows the section used to compute, none alerting on the fixture", () => {
    const rows = healthRows(view());
    // The named rows come first, in this order, and the Tier 0 battery is
    // appended after them. Asserted as a prefix rather than an exact list so
    // adding a check to the battery does not require editing this test — but
    // the battery's own count is pinned below, so a check silently vanishing
    // still fails something.
    expect(rows.slice(0, 12).map((r) => r.key)).toEqual([
      "https",
      "host",
      "notfound",
      "viewport",
      "tappable",
      "broken",
      "mixed",
      "weight",
      "contact",
      "alt",
      "phones",
      "copyright",
    ]);
    expect(rows.every((r) => !r.alert)).toBe(true);
  });

  it("appends every Tier 0 check that reached a verdict, and no others", () => {
    const rows = healthRows(view());
    const battery = ALL_PASS_REPORT.siteChecks as { data: { status: string }[] };
    const withVerdict = battery.data.filter(
      (c) => c.status === "pass" || c.status === "fail",
    ).length;
    expect(rows).toHaveLength(12 + withVerdict);
    // The not-applicable one must not have become a row: a row for it would
    // put a check we never judged in front of the reader as though we had.
    expect(rows.some((r) => r.key === "schema-self-review")).toBe(false);
  });

  it("alerts on a broken link and says the denominator", () => {
    const v = view(
      stage("assets", (d) => ({
        ...d,
        brokenLinks: [
          { url: "https://x.test/a", status: 404, bytes: null, error: null, referencedBy: ["/"] },
        ],
      })),
    );
    const row = healthRows(v).find((r) => r.key === "broken");
    expect(row?.alert).toBe(true);
    expect(row?.value).toBe("1 found");
    expect(row?.detail).toMatch(/We checked \d+ of \d+ links/);
  });

  it("returns nothing when no check ran", () => {
    const v = view({
      checks: { ok: false },
      assets: { ok: false },
      basics: { ok: false },
      siteChecks: { ok: false },
    });
    expect(healthRows(v)).toEqual([]);
  });
});

describe("headlineFinding — priority", () => {
  it("blocked crawlers outrank everything", () => {
    const v = view({
      ...stage("checks", (d) => ({
        ...d,
        crawlerAccess: { blockedAi: ["GPTBot"], blockedClassical: [] },
      })),
      ...stage("accuracy", (d) => ({
        ...d,
        conflation: { detected: true, otherNames: ["Other Co"], engineQuote: null },
      })),
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("crawlers-blocked");
    expect(h.text).toMatch(/turns away GPTBot/);
  });

  it("a name collision outranks a missing goal requirement", () => {
    const v = view({
      ...stage("accuracy", (d) => ({
        ...d,
        conflation: { detected: true, otherNames: ["Other Co", "Another Co"], engineQuote: null },
      })),
      ...stage("goalFit", (d) => ({
        ...d,
        requirements: (d.requirements as GoalRequirement[]).map((r, i) =>
          i === 0 ? { ...r, status: "missing" } : r,
        ),
      })),
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("name-collision");
    expect(h.text).toMatch(/not sure which Example Studio you are/);
    expect(h.text).toMatch(/two other businesses/);
  });

  it("an unidentifiable goal outranks a missing requirement", () => {
    const v = view(stage("goalFit", (d) => ({ ...d, goal: "unknown", requirements: [] })));
    expect(headlineFinding(v).kind).toBe("goal-unknown");
  });

  it("a missing goal requirement names it, in the reader's terms", () => {
    const v = view(
      stage("goalFit", (d) => ({
        ...d,
        requirements: (d.requirements as GoalRequirement[]).map((r, i) =>
          i === 1 ? { ...r, status: "missing" } : r,
        ),
      })),
    );
    const h = headlineFinding(v);
    expect(h.kind).toBe("goal-missing");
    expect(h.text).toMatch(/built to get a visitor to start a project or ask for a quote/);
    expect(h.text).toMatch(/one of the four things that needs is not in place/);
    expect(h.text).toMatch(/a route to you/i);
  });

  it("a contradicted statement outranks unanswered questions", () => {
    const v = view({
      ...stage("accuracy", (d) => ({
        ...d,
        assertions: (d.assertions as Assertion[]).map((a, i) =>
          i === 0 ? { ...a, verdict: "contradicted", siteQuote: "Based in Austin" } : a,
        ),
      })),
      ...stage("analyze", (d) => ({
        ...d,
        buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
          i === 0 ? { ...q, answered: "no" } : q,
        ),
      })),
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("contradicted");
    expect(h.text).toMatch(/your own site says otherwise/);
  });

  it("unanswered buyer questions name the questions", () => {
    const v = view(
      stage("analyze", (d) => ({
        ...d,
        buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
          i < 2 ? { ...q, answered: "no" } : q,
        ),
      })),
    );
    const h = headlineFinding(v);
    expect(h.kind).toBe("unanswered");
    expect(h.text).toMatch(/does not answer two of the ten questions buyers ask first/);
    expect(h.text).toMatch(/what does this cost/i);
  });

  it("a failing site check is the headline when nothing above it fired", () => {
    const v = view(stage("checks", (d) => ({ ...d, viewportOk: false })));
    const h = headlineFinding(v);
    expect(h.kind).toBe("site-check");
    expect(h.text).toMatch(/built for phone screens/i);
  });

  it("says so when almost nothing was measured", () => {
    const v = view({
      checks: { ok: false },
      assets: { ok: false },
      basics: { ok: false },
      goalFit: { ok: false },
      accuracy: { ok: false },
      analyze: { ok: false },
      siteChecks: { ok: false },
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("unmeasured");
    expect(h.text).toMatch(/gap in our measurement/);
  });

  it("a statement the site does not make is not a finding, and does not block all clear", () => {
    // The engine may be right about something the site never mentions — a
    // Texas registration, a revenue figure — and telling a client "your site
    // does not say this" about a true fact reads as an accusation. So absent
    // is neither a finding nor a headline; the page shows who was read instead.
    const v = view(
      stage("accuracy", (d) => ({
        ...d,
        assertions: (d.assertions as Assertion[]).map((a, i) =>
          i === 0 ? { ...a, verdict: "absent" } : a,
        ),
      })),
    );
    expect(headlineFinding(v).kind).toBe("all-clear");
  });
});

describe("passes", () => {
  it("drops a group with nothing in it, and never lists a failure", () => {
    const v = view({
      ...stage("checks", (d) => ({ ...d, viewportOk: false })),
      ...stage("goalFit", (d) => ({
        ...d,
        requirements: (d.requirements as GoalRequirement[]).map((r) => ({
          ...r,
          status: "missing",
        })),
      })),
    });
    const groups = passes(v);
    expect(groups.find((g) => g.title === "Does your site do its job")).toBeUndefined();
    const health = groups.find((g) => g.title === "Does it work");
    expect(health?.items.some((i) => /phone screens/i.test(i))).toBe(false);
  });

  it("counts confirmed statements as one line, not one line each", () => {
    const ai = passes(view()).find((g) => g.title === "What an AI says about you");
    expect(ai?.items.some((i) => /statements? the assistant made match/.test(i))).toBe(true);
  });

  it("does not credit the assistant for knowing you when it confused you with someone else", () => {
    const v = view(
      stage("accuracy", (d) => ({
        ...d,
        conflation: { detected: true, otherNames: ["Other Co"], engineQuote: null },
      })),
    );
    const ai = passes(v).find((g) => g.title === "What an AI says about you");
    expect(ai?.items.some((i) => /knew who you are/.test(i))).toBe(false);
  });
});

describe("displayQuote", () => {
  it("drops markdown emphasis markers from an engine quote without changing the words", () => {
    expect(displayQuote('there are **multiple, unrelated companies** that go by "Reddoor"')).toBe(
      'there are multiple, unrelated companies that go by "Reddoor"',
    );
    expect(displayQuote("__led__ by *Tim* Holmes")).toBe("led by Tim Holmes");
    expect(displayQuote("2 * 3 = 6")).toBe("2 * 3 = 6");
  });

  it("drops one pair of wrapping quote marks, since the page supplies its own", () => {
    expect(displayQuote('"with $2 million in revenue and 5 employees"')).toBe(
      "with $2 million in revenue and 5 employees",
    );
    expect(displayQuote("“Tim and Reddoor have unsurpassed taste.”")).toBe(
      "Tim and Reddoor have unsurpassed taste.",
    );
    // An inner quote is content, not wrapping.
    expect(displayQuote('go by "Reddoor Creative" or "Red Door"')).toBe(
      'go by "Reddoor Creative" or "Red Door"',
    );
  });
});

describe("collisionFix / allFixes", () => {
  it("adds no fix when nobody is confused about the name", () => {
    expect(collisionFix(view())).toBeNull();
    expect(allFixes(view())).toHaveLength(view().fixes.length);
  });

  it("turns a name collision into the first fix in the list, marked measured", () => {
    const v = view(
      stage("accuracy", (d) => ({
        ...d,
        conflation: { detected: true, otherNames: ["Other Co"], engineQuote: null },
      })),
    );
    const fix = collisionFix(v);
    expect(fix?.origin).toBe("measured");
    expect(fix?.title).toMatch(/which Example Studio you are/);
    expect(fix?.why).toMatch(/home page/);
    expect(fix?.why).toMatch(/schema\.org/);
    const all = allFixes(v);
    expect(all[0]).toEqual(fix);
    expect(all).toHaveLength(v.fixes.length + 1);
  });

  it("orders measured fixes ahead of recommendations, keeping the audit's order within each", () => {
    const v = view(
      stage("analyze", (d) => ({
        ...d,
        fixes: [
          {
            title: "r1",
            why: "",
            impact: "low",
            effort: "low",
            tier: "content",
            origin: "recommendation",
          },
          {
            title: "m1",
            why: "",
            impact: "low",
            effort: "low",
            tier: "content",
            origin: "measured",
          },
          {
            title: "r2",
            why: "",
            impact: "low",
            effort: "low",
            tier: "content",
            origin: "recommendation",
          },
        ],
      })),
    );
    expect(allFixes(v).map((f) => f.title)).toEqual(["m1", "r1", "r2"]);
  });
});

describe("healthFixes — every failed check becomes a fix", () => {
  const URL = "https://example-studio.test/";
  const plainPhone = stage("checks", (d) => ({
    ...d,
    consistency: {
      ...(d.consistency as Record<string, unknown>),
      phones: [
        { normalized: "+15125550142", seenAs: ["(512) 555-0142"], pages: [URL], linked: true },
        { normalized: "+15125550199", seenAs: ["(512) 555-0199"], pages: [URL], linked: false },
      ],
    },
  }));
  const fix = (title: string, origin: "measured" | "recommendation") => ({
    title,
    why: "",
    impact: "low",
    effort: "low",
    tier: "technical",
    origin,
  });

  it("adds nothing on the fixture, where every check passes", () => {
    expect(healthFixes(view())).toEqual([]);
  });

  it("puts a plain-text phone number in the fix list even when the goal checklist judged the phone", () => {
    // The audit suppresses its own phone fix whenever the goal checklist has a
    // tappable-phone row, and that row reads "met" when ANY number is tappable
    // — so a second, plain-text number alerted under "Does it work" and
    // reached no fix. That is the reddoorla report, verbatim.
    const v = view(plainPhone);
    expect(healthRows(v).find((r) => r.key === "tappable")?.alert).toBe(true);
    const f = healthFixes(v).find((x) => /phone number/i.test(x.title));
    expect(f?.origin).toBe("measured");
    expect(f?.title).toMatch(/tappable/i);
    expect(f?.why).toMatch(/one tap/);
    expect(allFixes(v)).toContainEqual(f);
  });

  it("does not say the same finding twice when the audit already wrote the fix", () => {
    const v = view({
      ...plainPhone,
      ...stage("analyze", (d) => ({
        ...d,
        fixes: [fix("Make your phone number tappable", "measured")],
      })),
    });
    const titles = allFixes(v).map((f) => f.title);
    expect(titles.filter((t) => /phone number/i.test(t))).toHaveLength(1);
  });

  it("orders health fixes after the audit's measured fixes and before its recommendations", () => {
    const v = view({
      ...plainPhone,
      ...stage("analyze", (d) => ({
        ...d,
        fixes: [fix("r1", "recommendation"), fix("m1", "measured")],
      })),
    });
    expect(allFixes(v).map((f) => f.title)).toEqual([
      "m1",
      "Make your phone number tappable",
      "r1",
    ]);
  });

  const failing: [string, Record<string, unknown>, RegExp][] = [
    [
      "https",
      stage("basics", (d) => ({
        ...d,
        insecureEntry: { ...(d.insecureEntry as object), ok: false },
      })),
      /plain http/i,
    ],
    [
      "host",
      stage("basics", (d) => ({
        ...d,
        hostVariant: { ...(d.hostVariant as object), ok: false },
      })),
      /www\.example-studio\.test/,
    ],
    [
      "notfound",
      stage("basics", (d) => ({
        ...d,
        notFound: { ...(d.notFound as object), ok: false, status: 200, landedOn: null },
      })),
      /missing page/i,
    ],
    ["viewport", stage("checks", (d) => ({ ...d, viewportOk: false })), /phone/i],
    [
      "broken",
      stage("assets", (d) => ({
        ...d,
        brokenLinks: [
          { url: `${URL}a`, status: 404, bytes: null, error: null, referencedBy: [URL] },
        ],
      })),
      /Repair 1 broken link/,
    ],
    [
      "mixed",
      stage("basics", (d) => ({
        ...d,
        mixedContent: { measured: true, imageUrls: ["http://cdn.test/a.jpg"], imagesSeen: 18 },
      })),
      /image.*https/i,
    ],
    [
      "weight",
      stage("assets", (d) => ({
        ...d,
        heaviestImages: [{ url: `${URL}hero.jpg`, bytes: 2_400_000 }],
      })),
      /heaviest image/i,
    ],
    [
      "contact",
      stage("checks", (d) => ({
        ...d,
        journey: { ...(d.journey as object), deadEnds: [`${URL}about`] },
      })),
      /every page a way to reach you/i,
    ],
    [
      "alt",
      stage("basics", (d) => ({
        ...d,
        altText: { imagesTotal: 18, imagesWithAlt: 4, pagesExamined: 5 },
      })),
      /describe your images/i,
    ],
    [
      "titles",
      stage("basics", (d) => ({
        ...d,
        duplicateTitles: [{ title: "Home", pages: [URL, `${URL}about`] }],
      })),
      /its own title/i,
    ],
    [
      "copyright",
      stage("checks", (d) => ({
        ...d,
        consistency: { ...(d.consistency as object), newestCopyrightYear: 2023 },
      })),
      /copyright year/i,
    ],
    [
      "template",
      stage("checks", (d) => ({
        ...d,
        consistency: { ...(d.consistency as object), pagesOffTemplate: [`${URL}old`] },
      })),
      /back into your site.s template/i,
    ],
  ];

  it.each(failing)("writes one measured fix for a failed %s check", (key, over, title) => {
    const v = view(over);
    const row = healthRows(v).find((r) => r.key === key);
    expect(row?.alert, `${key} should alert`).toBe(true);
    const fixes = healthFixes(v);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]?.title).toMatch(title);
    expect(fixes[0]?.origin).toBe("measured");
    // The reasoning is the row's own detail, so the fix and the finding cannot drift apart.
    expect(fixes[0]?.why).toContain(row?.detail.slice(0, 40));
  });
});
