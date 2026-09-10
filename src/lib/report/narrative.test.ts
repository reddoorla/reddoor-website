import { describe, it, expect } from "vitest";
import {
  openingSummary,
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

/**
 * The other half of the override layer.
 *
 * `applyOverrides` can only reach strings that exist in the stored payload.
 * Every sentence below is composed here, from data, and is in no payload at
 * all — so each one consults the map itself, at the point it is written.
 */
describe("composed sentences honour operator overrides", () => {
  const base = view();
  const edit = (overrides: ReportView["overrides"]): ReportView => ({ ...base, overrides });

  it("overrides the headline finding", () => {
    const generated = headlineFinding(base);
    const edited = headlineFinding(
      edit({ "composed:headlineFinding": { original: generated.text, text: "Reworded." } }),
    );
    expect(edited.text).toBe("Reworded.");
    // The kind is not overridable: it chooses which branch of the report
    // renders, and a reworded sentence must not move the reader elsewhere.
    expect(edited.kind).toBe(generated.kind);
  });

  it("withholds a headline override whose original is stale", () => {
    const generated = headlineFinding(base);
    const edited = headlineFinding(
      edit({ "composed:headlineFinding": { original: "not what we say", text: "Reworded." } }),
    );
    expect(edited.text).toBe(generated.text);
  });

  it("overrides a pass-group title by index", () => {
    const groups = passes(base);
    // Asserted, not guarded: a fixture with no groups would make the rest of
    // this test pass without checking anything.
    expect(groups.length).toBeGreaterThan(0);
    const edited = passes(
      edit({
        "composed:passes[0].title": { original: groups[0]!.title, text: "Reworded group" },
      }),
    );
    expect(edited[0]!.title).toBe("Reworded group");
    expect(edited.map((g) => g.items)).toEqual(groups.map((g) => g.items));
  });

  it("overrides a health row by its own key", () => {
    const rows = healthRows(base);
    expect(rows.length).toBeGreaterThan(0);
    const row = rows[0]!;
    const edited = healthRows(
      edit({
        [`composed:health[${row.key}].label`]: { original: row.label, text: "Reworded row" },
      }),
    );
    expect(edited[0]!.label).toBe("Reworded row");
    expect(edited[0]!.value).toBe(row.value);
  });

  /**
   * Health fixes, which are keyed by the ROW's key and not by their position.
   *
   * One check broken, so exactly one row alerts and exactly one fix is
   * written — and the row sits well down the list while the fix is first,
   * which is the compaction the key exists to survive.
   */
  const oneFinding = view(stage("checks", (d) => ({ ...d, viewportOk: false })));
  const editOn = (v: ReportView, overrides: ReportView["overrides"]): ReportView => ({
    ...v,
    overrides,
  });
  const viewportRow = (v: ReportView) => healthRows(v).find((r) => r.key === "viewport")!;

  it("writes health fixes at an index that is not the row's, so position is not a usable key", () => {
    const rowIndex = healthRows(oneFinding).findIndex((r) => r.key === "viewport");
    const fixes = healthFixes(oneFinding);
    expect(rowIndex).toBeGreaterThan(0);
    expect(fixes).toHaveLength(1);
    // `healthFix[0]` and `health[0]` name different checks. Non-alerting rows
    // and rows the audit already covered are skipped, so the offset between
    // the two lists is a property of this report's content, not a constant an
    // editing UI could apply.
    expect(rowIndex).not.toBe(0);
  });

  it("overrides a health fix by the row's key", () => {
    const fix = healthFixes(oneFinding)[0]!;
    const edited = healthFixes(
      editOn(oneFinding, {
        "composed:healthFix[viewport].title": { original: fix.title, text: "Reworded fix" },
        "composed:healthFix[viewport].why": { original: fix.why, text: "Reworded why" },
      }),
    );
    expect(edited[0]!.title).toBe("Reworded fix");
    expect(edited[0]!.why).toBe("Reworded why");
  });

  it("withholds a health-fix override whose original is stale", () => {
    const fix = healthFixes(oneFinding)[0]!;
    const edited = healthFixes(
      editOn(oneFinding, {
        "composed:healthFix[viewport].title": { original: "not what we say", text: "Reworded fix" },
      }),
    );
    expect(edited[0]!.title).toBe(fix.title);
  });

  it("keeps the health-row and health-fix key spaces apart", () => {
    // Both are keyed by `viewport`, so the `health` / `healthFix` prefix is
    // the only thing separating them. An edit written against one must not be
    // honoured by the other, in either direction — otherwise an operator
    // rewording a row would silently rewrite its fix, and the two key spaces
    // would collapse into one.
    const row = viewportRow(oneFinding);
    const fix = healthFixes(oneFinding)[0]!;

    // A row-space key carrying the FIX's text does not reach the fix.
    const crossed = editOn(oneFinding, {
      "composed:health[viewport].title": { original: fix.title, text: "Crossed over" },
      "composed:health[viewport].why": { original: fix.why, text: "Crossed over" },
    });
    expect(healthFixes(crossed)[0]!.title).toBe(fix.title);
    expect(healthFixes(crossed)[0]!.why).toBe(fix.why);

    // And a fix-space key carrying the ROW's text does not reach the row.
    const crossedBack = editOn(oneFinding, {
      "composed:healthFix[viewport].label": { original: row.label, text: "Crossed back" },
      "composed:healthFix[viewport].detail": { original: row.detail, text: "Crossed back" },
    });
    expect(viewportRow(crossedBack).label).toBe(row.label);
    expect(viewportRow(crossedBack).detail).toBe(row.detail);

    // An edit that IS in the right space still lands, so the assertions above
    // are about the key space rather than about nothing happening at all.
    const proper = editOn(oneFinding, {
      "composed:healthFix[viewport].title": { original: fix.title, text: "Reworded fix" },
      "composed:health[viewport].label": { original: row.label, text: "Reworded row" },
    });
    expect(healthFixes(proper)[0]!.title).toBe("Reworded fix");
    expect(viewportRow(proper).label).toBe("Reworded row");
  });

  it("overrides a pass line by its position in its group", () => {
    const groups = passes(base);
    expect(groups[0]!.items.length).toBeGreaterThan(1);
    const items = groups[0]!.items;
    const edited = passes(
      edit({
        "composed:passes[0].items[0]": { original: items[0]!, text: "Reworded line" },
      }),
    );
    expect(edited[0]!.items[0]).toBe("Reworded line");
    // The lines are the more numerous half of this list and the likelier edit,
    // so an edit to one must leave its neighbours and its heading alone.
    expect(edited[0]!.items.slice(1)).toEqual(items.slice(1));
    expect(edited[0]!.title).toBe(groups[0]!.title);
  });

  it("withholds a pass-line override whose original is stale", () => {
    const items = passes(base)[0]!.items;
    const edited = passes(
      edit({
        "composed:passes[0].items[0]": { original: "not what we say", text: "Reworded line" },
      }),
    );
    expect(edited[0]!.items).toEqual(items);
  });

  it("overrides a health row's value and detail, by the same key as its label", () => {
    const row = healthRows(base)[0]!;
    const edited = healthRows(
      edit({
        [`composed:health[${row.key}].value`]: { original: row.value, text: "Reworded value" },
        [`composed:health[${row.key}].detail`]: { original: row.detail, text: "Reworded detail" },
      }),
    )[0]!;
    expect(edited.value).toBe("Reworded value");
    expect(edited.detail).toBe("Reworded detail");
    expect(edited.label).toBe(row.label);
    // `alert` is a verdict, not copy: it decides whether the row renders as a
    // finding or joins the passes, and is not offered to the operator at all.
    expect(edited.alert).toBe(row.alert);
  });

  it("withholds a health-row value override whose original is stale", () => {
    const row = healthRows(base)[0]!;
    const edited = healthRows(
      edit({
        [`composed:health[${row.key}].value`]: { original: "not what we say", text: "Reworded" },
      }),
    )[0]!;
    expect(edited.value).toBe(row.value);
  });

  /**
   * The collision fix, which is written here rather than by the audit and so
   * exists in no payload for `applyOverrides` to reach.
   */
  const conflated = view(
    stage("accuracy", (d) => ({
      ...d,
      conflation: { detected: true, otherNames: ["Other Co"], engineQuote: null },
    })),
  );

  it("overrides the collision fix's title and its reasoning", () => {
    const fix = collisionFix(conflated)!;
    expect(fix).not.toBeNull();
    const edited = collisionFix(
      editOn(conflated, {
        "composed:collisionFix.title": { original: fix.title, text: "Reworded title" },
        "composed:collisionFix.why": { original: fix.why, text: "Reworded why" },
      }),
    )!;
    expect(edited.title).toBe("Reworded title");
    expect(edited.why).toBe("Reworded why");
    // Impact, effort and tier order the fix list; they are not copy and are
    // not editable, so the reworded fix keeps its place in the list.
    expect(edited.impact).toBe(fix.impact);
    expect(edited.effort).toBe(fix.effort);
    expect(edited.tier).toBe(fix.tier);
    // And the edit reaches the reader through the list, not only through
    // `collisionFix` — the collision fix is printed first in `allFixes`.
    expect(
      allFixes(
        editOn(conflated, {
          "composed:collisionFix.title": { original: fix.title, text: "Reworded title" },
        }),
      )[0]!.title,
    ).toBe("Reworded title");
  });

  it("withholds a collision-fix override whose original is stale", () => {
    const fix = collisionFix(conflated)!;
    const edited = collisionFix(
      editOn(conflated, {
        "composed:collisionFix.title": { original: "not what we say", text: "Reworded title" },
        "composed:collisionFix.why": { original: "not what we say", text: "Reworded why" },
      }),
    )!;
    expect(edited.title).toBe(fix.title);
    expect(edited.why).toBe(fix.why);
  });

  /**
   * THE CASCADE, which is the most interesting thing this layer does.
   *
   * A health row is upstream of three other composed sentences: `passes`
   * prints `${label}: ${value}`, `healthFixes` builds its reasoning as
   * `${what} ${detail}`, and the headline's `site-check` branch lists the
   * labels. So an operator who edits a row AND a sentence derived from it, in
   * the same map, invalidates the second override's stored `original` with the
   * first edit — and `composed` withholds it.
   *
   * The question this pins is what it degrades TO. It degrades to the sentence
   * REGENERATED around the operator's upstream edit, not to the stale
   * pre-edit text, so the report reads as consistently edited rather than
   * half-edited. Half of that is `composed`'s doing and half is the fact that
   * `healthFixes` reads the OVERRIDDEN rows; neither half is obvious, and
   * until now neither was asserted.
   */
  it("degrades a derived override to the regenerated sentence, not to the stale one", () => {
    const row = viewportRow(oneFinding);
    const fix = healthFixes(oneFinding)[0]!;
    const newDetail = "Phones are served the desktop layout and have to pinch to read it.";

    const cascaded = editOn(oneFinding, {
      "composed:health[viewport].detail": { original: row.detail, text: newDetail },
      // Written against the fix as it read BEFORE the row above was edited —
      // which is exactly what an editing UI capturing originals out of
      // dependency order would save.
      "composed:healthFix[viewport].why": { original: fix.why, text: "Reworded why" },
    });

    // The row edit lands.
    expect(viewportRow(cascaded).detail).toBe(newDetail);

    const edited = healthFixes(cascaded)[0]!;
    // The derived override is withheld: its stored original no longer matches.
    expect(edited.why).not.toBe("Reworded why");
    // And what the reader gets carries the operator's upstream edit rather
    // than the text that edit replaced.
    expect(edited.why).toContain(newDetail);
    expect(edited.why).not.toContain(row.detail);
    // Pinned exactly: it is the sentence `healthFixes` would write today, from
    // the row as the operator left it.
    const regenerated = healthFixes(
      editOn(oneFinding, {
        "composed:health[viewport].detail": { original: row.detail, text: newDetail },
      }),
    )[0]!.why;
    expect(edited.why).toBe(regenerated);
    expect(regenerated).not.toBe(fix.why);
  });
});

/**
 * What `inline()` does to text it did not write.
 *
 * The health-row labels this repo generates are curated to survive being
 * lowercased into the middle of a sentence. An operator's rewording is not,
 * and arbitrary operator wording is the entire point of the override layer.
 * Reachable through the cascade below: an operator rewords a row, the headline
 * override that was written against the old wording is withheld, and the
 * headline regenerates around the operator's label.
 */
describe("operator wording embedded mid-sentence", () => {
  const insecure = view(
    stage("basics", (d) => ({
      ...d,
      insecureEntry: { ...(d.insecureEntry as object), ok: false },
    })),
  );
  const httpsRow = healthRows(insecure).find((r) => r.key === "https")!;
  const relabelled = (label: string): ReportView => ({
    ...insecure,
    overrides: {
      [`composed:health[https].label`]: { original: httpsRow.label, text: label },
    },
  });

  it("leads with the site check, so the label really is embedded", () => {
    expect(headlineFinding(insecure).kind).toBe("site-check");
  });

  it("keeps an operator's acronym whole", () => {
    const h = headlineFinding(relabelled("HTTPS is not enforced"));
    expect(h.text).toContain("HTTPS is not enforced");
    expect(h.text).not.toContain("hTTPS");
  });

  it("keeps a two-letter acronym whole too", () => {
    const h = headlineFinding(relabelled("SSL certificate expired"));
    expect(h.text).toContain("SSL certificate expired");
  });

  it("still lowercases an ordinary sentence-initial word", () => {
    const h = headlineFinding(relabelled("Redirects are not configured"));
    expect(h.text).toContain("redirects are not configured");
  });
});

/**
 * The argument for shipping this layer before anything can write to it: an
 * override map that overrides nothing changes nothing.
 *
 * That has been true key by key — each `it` above pairs a landed edit with a
 * withheld one — but never across the whole rendered report at once, which is
 * the form the claim is actually made in. Here every string these modules
 * produce goes into one dump, and the dump is compared under no map, under an
 * empty map, and under a map of entries whose originals are all stale.
 */
describe("a map that overrides nothing changes nothing", () => {
  // A report with findings rather than the all-pass one, so each list has
  // something in it: a name collision writes the collision fix, and a failed
  // viewport check writes a health fix.
  const findings = {
    ...raw,
    ...stage("accuracy", (d) => ({
      ...d,
      conflation: { detected: true, otherNames: ["Other Co"], engineQuote: null },
    })),
    ...stage("checks", (d) => ({ ...d, viewportOk: false })),
  };

  /**
   * Every string these modules render, in one comparable blob. Deliberately a
   * test-local helper: nothing in `src/` needs a serialiser that only a test
   * wants, and a shipped one would drift from what the page actually prints.
   *
   * `composed:goalVerdict` is the one override key missing from it. That wrap
   * lives inside GoalFit.svelte, and this repo's vitest config loads no Svelte
   * plugin, so the component cannot be imported here at all.
   */
  const dump = (v: ReportView): string => {
    const headline = headlineFinding(v);
    return JSON.stringify(
      {
        openingSummary: openingSummary(v),
        headline: { kind: headline.kind, text: headline.text },
        passes: passes(v),
        passCount: passCount(v),
        healthRows: healthRows(v),
        healthFixes: healthFixes(v),
        collisionFix: collisionFix(v),
        allFixes: allFixes(v),
      },
      null,
      2,
    );
  };

  const v = toReportView(asReport(findings));
  const baseline = dump(v);
  const NEVER = "OPERATOR TEXT THAT MUST NOT APPEAR";

  /** Every composed key this report has, plus two payload paths. */
  const everyKey = [
    "composed:openingSummary",
    "composed:headlineFinding",
    "composed:collisionFix.title",
    "composed:collisionFix.why",
    ...passes(v).flatMap((g, i) => [
      `composed:passes[${i}].title`,
      ...g.items.map((_, j) => `composed:passes[${i}].items[${j}]`),
    ]),
    ...healthRows(v).flatMap((r) => [
      `composed:health[${r.key}].label`,
      `composed:health[${r.key}].value`,
      `composed:health[${r.key}].detail`,
    ]),
    ...healthRows(v)
      .filter((r) => r.alert)
      .flatMap((r) => [`composed:healthFix[${r.key}].title`, `composed:healthFix[${r.key}].why`]),
    // Payload paths as well as composed keys, so `applyOverrides` is under the
    // same claim as `composed`.
    "siteChecks.data[0].why",
    "analyze.data.fixes[0].why",
  ];

  it("has something in every section, so the dumps are not comparing nothing", () => {
    expect(openingSummary(v)).not.toBeNull();
    expect(headlineFinding(v).text.length).toBeGreaterThan(0);
    expect(passes(v).length).toBeGreaterThan(0);
    expect(passCount(v)).toBeGreaterThan(0);
    expect(healthRows(v).length).toBeGreaterThan(0);
    expect(healthFixes(v).length).toBeGreaterThan(0);
    expect(collisionFix(v)).not.toBeNull();
    expect(allFixes(v).length).toBeGreaterThan(0);
    expect(everyKey.length).toBeGreaterThan(20);
  });

  it("renders identically with no map and with an empty map", () => {
    expect(dump(toReportView(asReport(findings), {}))).toBe(baseline);
  });

  it("renders identically under a map whose originals are all stale", () => {
    const stale: ReportView["overrides"] = Object.fromEntries(
      everyKey.map((k) => [k, { original: "not what we say", text: NEVER }]),
    );
    const out = dump(toReportView(asReport(findings), stale));
    expect(out).not.toContain(NEVER);
    expect(out).toBe(baseline);
  });

  it("is not vacuous: the same keys with matching originals do change the dump", () => {
    // Without this, the two assertions above would pass just as happily on a
    // dump that no override could ever reach.
    const row = healthRows(v)[0]!;
    const landed = toReportView(asReport(findings), {
      "composed:headlineFinding": { original: headlineFinding(v).text, text: NEVER },
      [`composed:health[${row.key}].label`]: { original: row.label, text: NEVER },
      "siteChecks.data[0].why": { original: v.siteChecks![0]!.why, text: NEVER },
    });
    const out = dump(landed);
    expect(out).toContain(NEVER);
    expect(out).not.toBe(baseline);
  });
});
