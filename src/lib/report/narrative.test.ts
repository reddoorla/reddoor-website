import { describe, it, expect } from "vitest";
import {
  openingSummary,
  toReportView,
  type Assertion,
  type BuyerQuestion,
  type Fix,
  type GoalRequirement,
  type ReportView,
} from "./model";
import type { AuditReport } from "./fetch";
import {
  allFixes,
  answerLabel,
  auditedOn,
  collisionFix,
  displayQuote,
  headlineFinding,
  healthFixes,
  inPagesRead,
  inSourceCheckPages,
  goalInferenceLead,
  pagesReadPhrase,
  passes,
  passCount,
  primer,
  questionReceipt,
  sourceCheckFootnote,
  tocEntries,
  TOC_TARGETS,
  unsourcedLead,
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
      "What AI is saying about you",
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
        conflation: { detected: true, settled: false, otherNames: ["Other Co"], engineQuote: null },
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
        conflation: {
          detected: true,
          settled: false,
          otherNames: ["Other Co", "Another Co"],
          engineQuote: null,
        },
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
    expect(h.text).toMatch(/two others with a similar name/);
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
    const ai = passes(view()).find((g) => g.title === "What AI is saying about you");
    expect(ai?.items.some((i) => /statements? the assistant made match/.test(i))).toBe(true);
  });

  it("does not credit the assistant for knowing you when it confused you with someone else", () => {
    const v = view(
      stage("accuracy", (d) => ({
        ...d,
        conflation: { detected: true, settled: false, otherNames: ["Other Co"], engineQuote: null },
      })),
    );
    const ai = passes(v).find((g) => g.title === "What AI is saying about you");
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
        conflation: { detected: true, settled: false, otherNames: ["Other Co"], engineQuote: null },
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
      conflation: { detected: true, settled: false, otherNames: ["Other Co"], engineQuote: null },
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
      conflation: { detected: true, settled: false, otherNames: ["Other Co"], engineQuote: null },
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
   * plugin, so the component cannot be imported here; ssr-test-harness.ts
   * renders it instead.
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

describe("tocEntries", () => {
  // Only the count of fixes decides whether the section renders, so a
  // placeholder is all the entry needs; the Fix shape is covered elsewhere.
  const oneFix = [{} as unknown as Fix];

  it("lists the five sections in page order when there are fixes, the primer first", () => {
    expect(tocEntries(oneFix)).toEqual([
      { id: "about", label: "What this report is" },
      { id: "ai-says", label: "What AI is saying about you" },
      { id: "control", label: "What you control" },
      { id: "fixes", label: "What to fix" },
      { id: "talk", label: "Talk it through" },
    ]);
  });

  it("never lists the appendix, which keeps its anchor for the in-page links", () => {
    expect(tocEntries(oneFix).map((e) => e.id)).not.toContain(TOC_TARGETS.passes);
    expect(TOC_TARGETS.passes).toBe("passes");
  });

  it("omits What to fix when the report renders no fixes", () => {
    expect(tocEntries([]).map((e) => e.id)).not.toContain("fixes");
    // A clean report still leads to the booking call.
    expect(tocEntries([]).map((e) => e.id)).toContain(TOC_TARGETS.talk);
    // Every other section still renders on a clean report, so it keeps its
    // link: the no-fixes list is the with-fixes list minus What to fix.
    expect(tocEntries([]).map((e) => e.id)).toEqual(
      tocEntries(oneFix)
        .map((e) => e.id)
        .filter((id) => id !== TOC_TARGETS.fixes),
    );
    // The all-pass fixture is NOT that case. Every check passes, but its
    // analyze stage carries two recommendations, so the page renders "2 things
    // to fix" and the list has that entry. Wired through allFixes here so a
    // fixture change that drops them fails this line rather than a jump.
    const v = view();
    expect(allFixes(v)).toHaveLength(2);
    expect(tocEntries(allFixes(v)).map((e) => e.id)).toEqual(tocEntries(oneFix).map((e) => e.id));
  });

  it("lists each section once however many fixes there are", () => {
    // The fix count decides only whether What to fix appears: two or three
    // fixes give the same contents as one, each section listed once.
    const ids = tocEntries([...oneFix, ...oneFix, ...oneFix]).map((e) => e.id);
    expect(ids).toEqual(tocEntries(oneFix).map((e) => e.id));
  });

  it("only ever emits ids from TOC_TARGETS", () => {
    const known = new Set<string>(Object.values(TOC_TARGETS));
    for (const e of tocEntries(oneFix)) expect(known.has(e.id)).toBe(true);
  });
});

describe("auditedOn", () => {
  it("prints the day the audit ran, as the masthead does", () => {
    expect(auditedOn(view())).toBe("September 3, 2026");
  });

  it("is null when the report carries no date", () => {
    expect(auditedOn({ ...view(), generatedAt: "" })).toBeNull();
  });
});

describe("primer", () => {
  // Every gated stage absent, and no fixes: the wording each fallback prints.
  const bare = (): ReportView => ({
    ...view(),
    businessName: null,
    generatedAt: "",
    siteChecks: null,
    crawlerReach: null,
    accessibility: null,
    journey: null,
    categoryProbes: [],
    accuracy: null,
    brandedProbes: [],
  });

  it("prints every live value on the all-pass fixture", () => {
    const p = primer(view(), allFixes(view()));
    expect(p.what).toContain("It is a measurement taken on September 3, 2026, not a promise");
    expect(p.how).toContain("then ran 70 named checks on what came back");
    expect(p.how).toContain(
      "It ran the accessibility rules, read your robots.txt as eight AI crawlers would and " +
        "counted the clicks from any page to reaching you.",
    );
    expect(p.how).toContain(
      "Only then did we ask an assistant about Example Studio, check each statement against " +
        "your own pages, and put a buyer’s questions to it, keeping every source it cited.",
    );
    expect(p.receipts).toContain(
      "What passed sits in one place near the end, the fixes are in the order we would do " +
        "them, and because an assistant’s answers move, this is worth taking again.",
    );
  });

  it("counts the checks that came back with a verdict, not the size of the battery", () => {
    // The fixture ships the whole battery, six rows of which have nothing on
    // this site to apply to, so the honest count is the seventy that returned
    // a verdict.
    expect(view().siteChecks).toHaveLength(76);
    expect(primer(view(), []).how).toContain("then ran 70 named checks on what came back");

    // Said plainly: a check with nothing to apply to, and one we could not
    // measure, are not work the reader was done.
    const mixed = [
      { status: "pass" },
      { status: "fail" },
      { status: "not-applicable" },
      { status: "unmeasured" },
    ] as unknown as ReportView["siteChecks"];
    expect(primer({ ...view(), siteChecks: mixed }, []).how).toContain("then ran 2 named checks");
  });

  it("says nothing about checks when none came back", () => {
    for (const siteChecks of [[], null] as ReportView["siteChecks"][]) {
      const p = primer({ ...view(), siteChecks }, []);
      expect(p.how).toContain("plain and in a real browser.");
      expect(p.how).not.toContain("then ran");
      expect(p.how).not.toContain("named checks");
      expect(p.how).not.toContain("dead links");
    }
  });

  it("drops every clause it cannot stand behind, and words around the missing values", () => {
    const p = primer(bare(), []);
    expect(p.what).toContain("taken on one day, not a promise");
    expect(p.how).toContain("plain and in a real browser.");
    expect(p.how).not.toContain("then ran");
    expect(p.how).not.toContain("dead links");
    expect(p.how).not.toContain("robots.txt");
    expect(p.how).not.toContain("accessibility rules");
    expect(p.how).not.toContain("clicks");
    expect(p.how).not.toContain("Only then");
    expect(p.how).not.toContain("assistant about");
    expect(p.how).not.toContain("buyer's questions");
    expect(p.receipts).toContain(
      "What passed sits in one place near the end, and because an assistant’s answers move, " +
        "this is worth taking again.",
    );
    expect(p.receipts).not.toContain("the fixes are");
  });

  it("still credits the assistant sentence to 'your business' when only the businessName is missing", () => {
    const p = primer({ ...view(), businessName: null }, []);
    expect(p.how).toContain(
      "Only then did we ask an assistant about your business, check each statement against " +
        "your own pages, and put a buyer’s questions to it,",
    );
  });

  it("names only the assistant work that ran", () => {
    const v = view();
    expect(v.accuracy?.answersRead ?? 0).toBeGreaterThan(0);
    expect(v.brandedProbes.length).toBeGreaterThan(0);
    expect(v.categoryProbes.length).toBeGreaterThan(0);

    const noAccuracy = primer({ ...v, accuracy: null }, []).how;
    expect(noAccuracy).toContain(
      "Only then did we ask an assistant about Example Studio and put a buyer’s questions to " +
        "it, keeping every source it cited.",
    );
    expect(noAccuracy).not.toContain("check each statement");

    const unread = primer({ ...v, accuracy: { ...v.accuracy!, answersRead: 0 } }, []).how;
    expect(unread).toContain(
      "Only then did we ask an assistant about Example Studio and put a buyer’s questions to " +
        "it, keeping every source it cited.",
    );
    expect(unread).not.toContain("check each statement");

    const nameOnly = primer({ ...v, accuracy: null, brandedProbes: [] }, []).how;
    expect(nameOnly).toContain(
      "Only then did we put a buyer’s questions to an assistant, keeping every source it cited.",
    );

    const nothing = primer({ ...v, accuracy: null, brandedProbes: [], categoryProbes: [] }, []).how;
    expect(nothing).not.toContain("Only then");

    const noLive = primer({ ...v, categoryProbes: [] }, []).how;
    expect(noLive).toContain(
      "Only then did we ask an assistant about Example Studio and check each statement " +
        "against your own pages.",
    );
  });

  it("drops only the clause whose stage is missing", () => {
    const v = view();
    const cases: [string, Partial<ReportView>, string][] = [
      [
        "crawlerReach",
        { crawlerReach: { measured: false, blocked: [], checked: 0 } },
        "It ran the accessibility rules and counted the clicks from any page to reaching you.",
      ],
      [
        "accessibility",
        { accessibility: { ...v.accessibility!, measured: false } },
        "It read your robots.txt as eight AI crawlers would and counted the clicks from any page to reaching you.",
      ],
      [
        "journey",
        { journey: null },
        "It ran the accessibility rules and read your robots.txt as eight AI crawlers would.",
      ],
    ];
    for (const [name, patch, sentence] of cases) {
      expect(primer({ ...v, ...patch }, []).how, name).toContain(sentence);
    }
  });

  it("counts no clicks when the journey stage examined no pages", () => {
    const v = view();
    const p = primer({ ...v, journey: { ...v.journey!, pagesExamined: 0 } }, []);
    expect(p.how).not.toContain("clicks");
  });

  it("does not name a crawler count the checks stage never measured", () => {
    const v: ReportView = {
      ...view(),
      crawlerReach: { measured: false, blocked: [], checked: 8 },
    };
    expect(primer(v, []).how).not.toContain("robots.txt");
  });
});

describe("W1 (B-03): no all-clear when the parts it stands on failed", () => {
  const failed = (key: "analyze" | "probes" | "accuracy") =>
    toReportView(
      asReport({
        ...raw,
        [key]: { ok: false, error: "400 You have reached your specified API usage limits" },
      }),
    );

  it("positive control: the all-pass fixture is all clear", () => {
    expect(headlineFinding(toReportView(asReport(raw))).kind).toBe("all-clear");
  });

  it("a failed-analysis fixture must not return all-clear, and names what failed", () => {
    const h = headlineFinding(failed("analyze"));
    expect(h.kind).not.toBe("all-clear");
    expect(h.text).not.toContain("checks out");
    expect(h.text).toContain("the content analysis");
  });

  it.each(["probes", "accuracy"] as const)("a failed %s stage is not all clear either", (key) => {
    expect(headlineFinding(failed(key)).kind).toBe("incomplete");
  });

  it("review round 3: failed page checks (analysis skipped as a cascade) are not all clear", () => {
    const v = toReportView(
      asReport({
        ...raw,
        checks: { ok: false, error: "fetch failed: ECONNRESET" },
        analyze: { ok: false, error: "skipped — the checks stage failed" },
      }),
    );
    const h = headlineFinding(v);
    expect(h.kind).toBe("incomplete");
    expect(h.text).not.toContain("checks out");
    expect(h.text).toContain("the page checks");
  });

  it("a stage skipped on purpose is not a failure: --no-probes stays all clear", () => {
    const v = toReportView(
      asReport({ ...raw, probes: { ok: false, error: "skipped (--no-probes)" } }),
    );
    expect(headlineFinding(v).kind).toBe("all-clear");
  });
});

// W3, from the audit-system review (B-04, LG-12, BR-07): every absence is a
// statement about the pages we read, so it says how many, against the site's.
describe("absences carry their denominator", () => {
  /** A crawl that read `read` pages and knew of `considered`, with a sitemap
   *  listing `sitemap` when given. */
  const crawled = (read: number, considered: number, sitemap?: number) => ({
    crawl: {
      ok: true,
      data: {
        ...(raw.crawl!.data as object),
        pages: Array.from({ length: read }, (_, i) => ({
          url: `https://example.test/p${i}`,
          raw: { text: "" },
          rendered: null,
        })),
        sitemap:
          sitemap === undefined
            ? { present: false, urlCount: 0 }
            : { present: true, urlCount: sitemap },
        selection: { pagesConsidered: considered },
      },
    },
  });
  const unanswered = stage("analyze", (d) => ({
    ...d,
    buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
      i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
    ),
  }));

  it("an unanswered-questions headline says how many of the site's pages it rests on", () => {
    const h = headlineFinding(view({ ...unanswered, ...crawled(20, 40, 95) }));
    expect(h.kind).toBe("unanswered");
    expect(h.text).toContain("of your");
    expect(h.text).toContain("in the 20 of your 95 pages we read");
  });

  it("with no sitemap, says how many pages it found linked, never 'your 30 pages'", () => {
    const h = headlineFinding(view({ ...unanswered, ...crawled(12, 30) }));
    expect(h.text).toContain(
      "in the 12 pages we read, of the 30 we found linked from your home page",
    );
    expect(h.text).not.toMatch(/your 30 pages/);
  });

  it("an unidentifiable goal says how much was read, never 'every page'", () => {
    const v = view({
      ...stage("goalFit", (d) => ({ ...d, goal: "unknown", requirements: [] })),
      ...crawled(1, 1),
    });
    const h = headlineFinding(v);
    expect(h.text).not.toMatch(/every page/);
    expect(h.text).toContain(
      "We read the one page we found linked from your home page and could not tell",
    );
  });

  it("a question row says where it looked, and names the word on the page when there was one", () => {
    const v = view({ ...unanswered, ...crawled(20, 40, 95) });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(questionReceipt(v, no!)).toBe("not found in the 20 of your 95 pages we read");
    const hedged: BuyerQuestion = {
      ...no!,
      answered: "unknown",
      notFound: { term: "pricing", page: "https://example.test/services" },
    };
    expect(questionReceipt(v, hedged)).toBe(
      "no direct answer found in the 20 of your 95 pages we read, though “pricing” appears on /services",
    );
  });

  it("says so plainly when a sitemap says it read every page, and never on a count of links", () => {
    const h = headlineFinding(view({ ...unanswered, ...crawled(7, 7, 7) }));
    expect(h.text).toContain("in any of your seven pages (we read them all)");
    expect(h.text).not.toContain("in each of");
    const linked = headlineFinding(view({ ...unanswered, ...crawled(7, 7, 6) }));
    expect(linked.text).not.toMatch(/we read them all|your seven pages/);
  });

  it("the primer no longer claims every page was fetched", () => {
    const v = view(crawled(20, 40, 95));
    const how = primer(v, []).how;
    expect(how).not.toMatch(/every page/);
    expect(how).toContain("It read 20 of your 95 pages, each one twice");
  });

  // Review round 1 (dirty). Each of these was red before its fix.

  /** A crawl whose pages are given as-is, with the stored sitemap and selection. */
  const withPages = (
    pages: { url: string; raw: unknown; rendered: unknown }[],
    sitemap: { present: boolean; urlCount: number; truncated?: boolean } | null,
    selection?: { pagesConsidered: number },
  ) => ({
    crawl: {
      ok: true,
      data: {
        ...(raw.crawl!.data as object),
        pages,
        ...(sitemap ? { sitemap } : {}),
        ...(selection ? { selection } : {}),
      },
    },
  });
  const pageAt = (i: number) => ({
    url: `https://example.test/p${i}`,
    raw: { text: "" },
    rendered: null,
  });

  it("a page with neither extract is not counted as read", () => {
    const v = view(
      withPages(
        [
          { url: "https://example.test/a", raw: { text: "" }, rendered: null },
          { url: "https://example.test/b", raw: null, rendered: { text: "" } },
          { url: "https://example.test/c", raw: null, rendered: null },
        ],
        { present: true, urlCount: 95 },
        { pagesConsidered: 40 },
      ),
    );
    expect(v.pagesRead).toEqual({ read: 2, site: 95, siteIsFloor: false, siteFrom: "sitemap" });
    expect(primer(v, []).how).toContain("It read two of your 95 pages");
  });

  it("a legacy crawl with no selection never reads as all of a smaller sitemap", () => {
    const v = view(
      withPages(
        Array.from({ length: 20 }, (_, i) => pageAt(i)),
        { present: true, urlCount: 12 },
      ),
    );
    expect(v.pagesRead).toEqual({ read: 20, site: null, siteIsFloor: false, siteFrom: null });
    const how = primer(v, []).how;
    expect(how).not.toMatch(/\ball\b/);
    expect(how).toContain("It read 20 pages, each one twice");
  });

  it("a truncated sitemap count is a floor, and says so", () => {
    const v = view({
      ...withPages(
        Array.from({ length: 20 }, (_, i) => pageAt(i)),
        { present: true, urlCount: 95, truncated: true },
        { pagesConsidered: 40 },
      ),
      ...stage("analyze", (d) => ({
        ...d,
        buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
          i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
        ),
      })),
    });
    expect(v.pagesRead?.siteIsFloor).toBe(true);
    expect(headlineFinding(v).text).toContain(
      "in the 20 pages we read, out of at least 95 pages on your site",
    );
  });

  it("the opening summary's absences carry the count too", () => {
    const v = view({
      ...crawled(20, 40, 95),
      ...stage("analyze", (d) => ({
        ...d,
        buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
          i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
        ),
      })),
    });
    expect(openingSummary(v)).toContain("It does not answer, in the 20 of your 95 pages we read:");
  });

  it("a goal-missing headline says how much it read", () => {
    const v = view({
      ...crawled(20, 40, 95),
      ...stage("goalFit", (d) => {
        const reqs = (d as unknown as { requirements: GoalRequirement[] }).requirements;
        return {
          ...d,
          requirements: reqs.map((r, i) => (i === 0 ? { ...r, status: "missing" } : r)),
        } as StageData;
      }),
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("goal-missing");
    expect(h.text).toContain("not in place in the 20 of your 95 pages we read:");
  });

  it("the source-check footnote states the count in words, and says all when the site was read", () => {
    const full = view({ ...crawled(3, 3, 3) });
    expect(
      sourceCheckFootnote({
        ...full,
        accuracy: { ...full.accuracy!, pagesRead: 3, pagesTotal: 3 },
      } as ReportView),
    ).toBe("We read all three of your pages for this check.");
    const part = view({ ...crawled(3, 12, 12) });
    expect(
      sourceCheckFootnote({
        ...part,
        accuracy: { ...part.accuracy!, pagesRead: 3, pagesTotal: 3 },
      } as ReportView),
    ).toBe(
      "We read three of your 12 pages for this check. A statement listed above may be on a page we did not read.",
    );
  });

  it("the primer says twice, not each one twice, when the site is one page", () => {
    const how = primer(view(crawled(1, 1)), []).how;
    expect(how).toContain("It read the one page we found linked from your home page, twice");
    expect(how).not.toContain("each one twice");
  });

  it("a receipt names the home page as the home page, and decodes the path", () => {
    const v = view({ ...unanswered, ...crawled(20, 40, 95) });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(
      questionReceipt(v, {
        ...no!,
        answered: "unknown",
        notFound: { term: "pricing", page: "https://example.test/" },
      }),
    ).toContain("appears on your home page");
    expect(
      questionReceipt(v, {
        ...no!,
        answered: "unknown",
        notFound: { term: "pricing", page: "https://example.test/our%20services" },
      }),
    ).toContain("appears on /our services");
  });

  // W3 review round 2. Each of these was red before its fix.

  it("the footnote of a legacy crawl never reads its sitemap as the site", () => {
    const v = view(
      withPages(
        Array.from({ length: 20 }, (_, i) => pageAt(i)),
        { present: true, urlCount: 12 },
      ),
    );
    expect(v.pagesRead?.site).toBeNull();
    expect(
      sourceCheckFootnote({
        ...v,
        accuracy: { ...v.accuracy!, pagesRead: 15, pagesTotal: 20 },
      } as ReportView),
    ).toBe(
      "We read 15 of the 20 pages we crawled for this check. A statement listed above may be on a page we did not read.",
    );
  });

  it("an absence in every page we read is worded so a negative still reads right", () => {
    const v = view({ ...unanswered, ...crawled(7, 7, 6) });
    // The home page's links and the sitemap together outgrow the sitemap: a count
    // of pages found, so no "all" and no "your seven pages".
    expect(inPagesRead(v)).toBe("in the seven pages we found, which we read");
    expect(headlineFinding(v).text).toContain("in the seven pages we found, which we read: ");
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(questionReceipt(v, no!)).toBe("not found in the seven pages we found, which we read");
  });

  it("a zero-page crawl states no count, and makes no claim about reading", () => {
    const v = view(
      withPages(
        [{ url: "https://example.test/a", raw: null, rendered: null }],
        { present: true, urlCount: 95 },
        { pagesConsidered: 40 },
      ),
    );
    expect(v.pagesRead).toEqual({ read: 0, site: 95, siteIsFloor: false, siteFrom: "sitemap" });
    expect(pagesReadPhrase(v)).toBeNull();
    expect(inPagesRead(v)).toBeNull();
    const how = primer(v, []).how;
    expect(how).toContain("We could not read any of your pages this time.");
    expect(how).not.toMatch(/zero|twice|\bread \d/);
    const h = headlineFinding(
      view({
        ...stage("goalFit", (d) => ({ ...d, goal: "unknown", requirements: [] }) as StageData),
        ...withPages(
          [{ url: "https://example.test/a", raw: null, rendered: null }],
          { present: true, urlCount: 95 },
          { pagesConsidered: 40 },
        ),
      }),
    );
    expect(h.kind).toBe("goal-unknown");
    expect(h.text).not.toMatch(/\bzero\b|We read/);
    expect(h.text).toContain("could not tell what");
  });

  it("counts above ten carry a thousands separator, and 'at least' stays", () => {
    const v = view(
      withPages(
        Array.from({ length: 20 }, (_, i) => pageAt(i)),
        { present: true, urlCount: 50000, truncated: true },
        { pagesConsidered: 40 },
      ),
    );
    expect(pagesReadPhrase(v)).toBe("20 of at least 50,000 pages on your site");
  });

  it("a receipt whose address will not decode prints the raw path, not the URL", () => {
    const v = view({ ...unanswered, ...crawled(20, 40, 95) });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(
      questionReceipt(v, {
        ...no!,
        answered: "unknown",
        notFound: { term: "pricing", page: "https://example.test/100%-off" },
      }),
    ).toBe(
      "no direct answer found in the 20 of your 95 pages we read, though “pricing” appears on /100%-off",
    );
  });

  it("the question table's label is one function, 'Unclear' only for a found-but-unread answer", () => {
    const v = view({ ...unanswered, ...crawled(20, 40, 95) });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(answerLabel(no!)).toBe("No");
    const hedged = {
      ...no!,
      answered: "unknown" as const,
      notFound: { term: "pricing", page: "https://example.test/services" },
    };
    expect(answerLabel(hedged)).toBe("Unclear");
    expect(answerLabel({ ...hedged, notFound: undefined })).toBe("Not measured");
  });
});

// W3 review round 3. Each of these was red before its fix.
describe("review round 3: the check's own count, zero reads, and floors", () => {
  const pageAt = (i: number) => ({
    url: `https://example.test/p${i}`,
    raw: { text: "" },
    rendered: null,
  });
  const withPages = (
    pages: { url: string; raw: unknown; rendered: unknown }[],
    sitemap: { present: boolean; urlCount: number; truncated?: boolean },
    selection?: { pagesConsidered: number },
  ) => ({
    crawl: {
      ok: true,
      data: {
        ...(raw.crawl!.data as object),
        pages,
        sitemap,
        ...(selection ? { selection } : {}),
      },
    },
  });
  const crawled = (read: number, considered: number, sitemap?: number) =>
    withPages(
      Array.from({ length: read }, (_, i) => pageAt(i)),
      sitemap === undefined
        ? { present: false, urlCount: 0 }
        : { present: true, urlCount: sitemap },
      { pagesConsidered: considered },
    );
  const zero = withPages(
    [{ url: "https://example.test/a", raw: null, rendered: null }],
    { present: true, urlCount: 95 },
    { pagesConsidered: 40 },
  );
  const unanswered = stage("analyze", (d) => ({
    ...d,
    buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
      i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
    ),
  }));
  /** A view whose source check read `pagesRead` of `pagesTotal` pages. */
  const checked = (over: Record<string, unknown>, pagesRead: number, pagesTotal: number) => {
    const v = view(over);
    return { ...v, accuracy: { ...v.accuracy!, pagesRead, pagesTotal } } as ReportView;
  };

  // Finding 1: the clause and the footnote state the same count.
  it("the source-check clause counts the pages the check read, against the site's total", () => {
    const v = checked(crawled(20, 40, 95), 8, 20);
    expect(inSourceCheckPages(v)).toBe("in the eight of your 95 pages we read");
    expect(sourceCheckFootnote(v)).toBe(
      "We read eight of your 95 pages for this check. A statement listed above may be on a page we did not read.",
    );
  });

  it("on a seven-page site where the check read five, nothing says it read them all", () => {
    const v = checked(crawled(7, 7, 7), 5, 7);
    expect(inSourceCheckPages(v)).toBe("in the five of your seven pages we read");
    expect(sourceCheckFootnote(v)).not.toMatch(/\ball\b/);
    expect(sourceCheckFootnote(v)).toContain("We read five of your seven pages for this check.");
  });

  // Finding 2: no count of zero.
  it("a check that read no page says so, with no count of zero", () => {
    const v = checked(zero, 0, 20);
    expect(sourceCheckFootnote(v)).toBe(
      "No page of your site could be read for this check. A statement listed above may be on a page we did not read.",
    );
  });

  // Finding 8: one page is a page, not "all one of your pages".
  it("a one-page site the check read is 'your one page', never 'all one of your pages'", () => {
    const v = checked(crawled(1, 1), 1, 1);
    // Counted from links, not a sitemap: a page may be missed, so the hedge stays.
    expect(sourceCheckFootnote(v)).toBe(
      "We read the one page we found linked from your home page for this check. A statement listed above may be on a page we did not read.",
    );
  });

  // Finding 7: a crawl stored without its pages falls back to the crawled wording, never "all".
  it("with no stored pages, a smaller sitemap never makes the check read 'all' of the site", () => {
    const legacy = view({
      crawl: {
        ok: true,
        data: {
          ...(raw.crawl!.data as object),
          pages: undefined,
          sitemap: { present: true, urlCount: 9 },
        },
      },
    });
    expect(legacy.pagesRead).toBeNull();
    const v = {
      ...legacy,
      accuracy: { ...legacy.accuracy!, pagesRead: 12, pagesTotal: 15 },
    } as ReportView;
    expect(sourceCheckFootnote(v)).toBe(
      "We read 12 of the 15 pages we crawled for this check. A statement listed above may be on a page we did not read.",
    );
  });

  // Finding 5: a truncated sitemap makes the site total a floor, whichever count is used.
  it("a truncated sitemap makes the site total a floor even when the selection count is larger", () => {
    const v = view({
      ...unanswered,
      ...withPages(
        Array.from({ length: 20 }, (_, i) => pageAt(i)),
        { present: true, urlCount: 50000, truncated: true },
        { pagesConsidered: 50012 },
      ),
    });
    expect(v.pagesRead).toEqual({ read: 20, site: 50012, siteIsFloor: true, siteFrom: "found" });
    expect(headlineFinding(v).text).toContain(
      "in the 20 pages we read, out of at least 50,012 pages on your site",
    );
  });

  // Finding 6: the contact detail carries the same denominator as every other absence.
  it("the contact row's detail states the pages it rests on, against the site's total", () => {
    const v = view({
      ...crawled(20, 40, 95),
      ...stage("checks", (d) => ({
        ...d,
        journey: { ...(d.journey as object), affordances: [] },
      })),
    });
    const contact = healthRows(v).find((r) => r.key === "contact");
    expect(contact?.detail).toContain("across the 20 of your 95 pages we read");
    expect(contact?.detail).not.toContain("all 20 pages");
  });

  it("the contact row keeps its old wording when no count of pages is known", () => {
    const v = view({
      ...stage("checks", (d) => ({
        ...d,
        journey: { ...(d.journey as object), affordances: [] },
      })),
      crawl: { ok: true, data: { ...(raw.crawl!.data as object), pages: undefined } },
    });
    expect(v.pagesRead).toBeNull();
    const contact = healthRows(v).find((r) => r.key === "contact");
    expect(contact?.detail).toContain("we looked at");
  });

  // Finding 4: a zero-page read claims no absence.
  it("a missing goal requirement over zero pages is not headlined as absent", () => {
    const v = view({
      ...zero,
      ...stage("goalFit", (d) => ({
        ...d,
        requirements: (d.requirements as GoalRequirement[]).map((r) => ({
          ...r,
          status: "missing",
        })),
      })),
    });
    const h = headlineFinding(v);
    expect(h.kind).toBe("goal-missing");
    expect(h.text).toContain("We could not read any of your pages");
    expect(h.text).not.toMatch(/not in place|four of the four|none of/i);
  });

  it("the unanswered-questions headline over zero pages is not headlined as absent", () => {
    const v = view({ ...unanswered, ...zero });
    const h = headlineFinding(v);
    expect(h.kind).toBe("unanswered");
    expect(h.text).toContain("We could not read any of your pages");
    expect(h.text).not.toContain("does not answer");
  });

  it("a question receipt over zero pages says we could not check, not that it is absent", () => {
    const v = view({ ...unanswered, ...zero });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(questionReceipt(v, no!)).toBe(
      "we could not read any of your pages, so we could not check",
    );
  });

  it("the opening summary over zero pages says we could not check, not that it does not answer", () => {
    const v = view({ ...unanswered, ...zero });
    const summary = openingSummary(v) ?? "";
    expect(summary).toContain("could not check whether it answers");
    expect(summary).not.toContain("does not answer");
  });

  it("the question table's label over zero pages is 'Not measured', not 'No'", () => {
    const v = view({ ...unanswered, ...zero });
    const [no] = v.buyerQuestions.filter((q) => q.answered === "no");
    expect(answerLabel(no!, v)).toBe("Not measured");
  });
});

// W3 review round 4. Each of these was red before its fix.
describe("review round 4: a floor is never all, a links count is never your pages, the contact scope, zero reads", () => {
  const pageAt = (i: number) => ({
    url: `https://example.test/p${i}`,
    raw: { text: "" },
    rendered: null,
  });
  const pagesOf = (n: number) => Array.from({ length: n }, (_, i) => pageAt(i));
  const withPages = (
    pages: { url: string; raw: unknown; rendered: unknown }[],
    sitemap: { present: boolean; urlCount: number; truncated?: boolean } | null,
    selection?: { pagesConsidered: number },
  ) => ({
    crawl: {
      ok: true,
      data: {
        ...(raw.crawl!.data as object),
        pages,
        ...(sitemap ? { sitemap } : {}),
        ...(selection ? { selection } : {}),
      },
    },
  });
  const unanswered = stage("analyze", (d) => ({
    ...d,
    buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
      i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
    ),
  }));
  /** A view with the journey stage's affordances emptied, over the given overrides. */
  const noContactAffordances = (over: Record<string, unknown>) =>
    view({
      ...over,
      ...stage("checks", (d) => ({
        ...d,
        journey: { ...(d.journey as object), affordances: [] },
      })),
    });

  // Finding A: a floor total (truncated sitemap) never yields an "all" claim.
  it("a truncated sitemap under the pages read is a floor, never 'all of your pages'", () => {
    const v = view({
      ...unanswered,
      ...withPages(
        pagesOf(5),
        { present: true, urlCount: 3, truncated: true },
        { pagesConsidered: 5 },
      ),
    });
    expect(v.pagesRead).toEqual({ read: 5, site: 5, siteIsFloor: true, siteFrom: "found" });
    const text = headlineFinding(v).text;
    expect(text).not.toMatch(/we read them all|\ball\b|Not in any of your/i);
    expect(text).toContain("in the five pages we read");
    expect(primer(v, []).how).not.toMatch(/\ball\b/);
    expect(
      sourceCheckFootnote({
        ...v,
        accuracy: { ...v.accuracy!, pagesRead: 5, pagesTotal: 5 },
      } as ReportView),
    ).toBe(
      "We read five pages for this check. A statement listed above may be on a page we did not read.",
    );
  });

  it("a truncated sitemap equal to the pages read is still a floor: no 'all', and the hedge stays", () => {
    const v = view(
      withPages(
        pagesOf(5),
        { present: true, urlCount: 5, truncated: true },
        { pagesConsidered: 5 },
      ),
    );
    expect(v.pagesRead).toEqual({ read: 5, site: 5, siteIsFloor: true, siteFrom: "sitemap" });
    expect(
      sourceCheckFootnote({
        ...v,
        accuracy: { ...v.accuracy!, pagesRead: 5, pagesTotal: 5 },
      } as ReportView),
    ).toBe(
      "We read five pages for this check. A statement listed above may be on a page we did not read.",
    );
  });

  // Finding B: a total counted from the home page's links is never "your pages".
  it("with no sitemap, a count of linked pages reads as pages found, never 'your seven pages' or 'all'", () => {
    const v = view({
      ...unanswered,
      ...withPages(pagesOf(7), null, { pagesConsidered: 7 }),
    });
    expect(v.pagesRead).toEqual({ read: 7, site: 7, siteIsFloor: false, siteFrom: "links" });
    const text = headlineFinding(v).text;
    expect(text).toContain("in the seven pages we found linked from your home page, which we read");
    expect(text).not.toMatch(/your seven pages|we read them all|\ball\b/);
    const how = primer(v, []).how;
    expect(how).toContain("It read the seven pages we found linked from your home page");
    expect(how).not.toMatch(/your seven pages|\ball\b/);
  });

  it("a present, untruncated sitemap that is the total still reads as all of your pages", () => {
    const v = view({
      ...unanswered,
      ...withPages(pagesOf(7), { present: true, urlCount: 7 }, { pagesConsidered: 7 }),
    });
    expect(v.pagesRead).toEqual({ read: 7, site: 7, siteIsFloor: false, siteFrom: "sitemap" });
    expect(headlineFinding(v).text).toContain("in any of your seven pages (we read them all): ");
  });

  // Finding C: the contact detail states its own scope, and drops "not just the first" for one page.
  it("the contact detail names the pages it read, and says 'not just the first' only over several", () => {
    const v = noContactAffordances(
      withPages(pagesOf(20), { present: true, urlCount: 95 }, { pagesConsidered: 40 }),
    );
    const contact = healthRows(v).find((r) => r.label === "Getting hold of you");
    expect(contact?.detail).toContain(
      "across the 20 of your 95 pages we read, not just the first.",
    );
    expect(contact?.detail).not.toMatch(/\(we read them all\)|\ball\b/);
  });

  it("the contact detail over one page reads 'on your one page', without 'not just the first'", () => {
    const v = noContactAffordances(
      withPages(pagesOf(1), { present: true, urlCount: 1 }, { pagesConsidered: 1 }),
    );
    const contact = healthRows(v).find((r) => r.label === "Getting hold of you");
    expect(contact?.detail).toContain("so we measured this on your one page, which we read.");
    expect(contact?.detail).not.toContain("not just the first");
  });

  it("the contact detail over linked pages never claims it read them all", () => {
    const v = noContactAffordances(withPages(pagesOf(7), null, { pagesConsidered: 7 }));
    const contact = healthRows(v).find((r) => r.label === "Getting hold of you");
    expect(contact?.detail).toContain(
      "across the seven pages we found linked from your home page, which we read, not just the first.",
    );
  });

  // Finding D: zero pages read means no contact row at all.
  it("a crawl that read no page drops the contact row, even when the journey stage is present", () => {
    const v = noContactAffordances(
      withPages(
        [{ url: "https://example.test/a", raw: null, rendered: null }],
        { present: true, urlCount: 95 },
        { pagesConsidered: 40 },
      ),
    );
    expect(v.journey).not.toBeNull();
    expect(v.pagesRead?.read).toBe(0);
    // The journey row is "Getting hold of you"; the Tier 0 battery has its own "contact" key.
    expect(healthRows(v).find((r) => r.label === "Getting hold of you")).toBeUndefined();
  });

  // Finding E: the lede claims no reading when no page was read.
  it("the goal lede says 'from reading it' only when a page was read", () => {
    expect(goalInferenceLead(view(withPages(pagesOf(0), null, { pagesConsidered: 0 })))).toBe(
      "As far as we can tell",
    );
    expect(goalInferenceLead(view(withPages(pagesOf(3), null, { pagesConsidered: 3 })))).toBe(
      "As far as we can tell from reading it",
    );
  });
});

// W3 review round 5. Each of these was red before its fix.
describe("review round 5: one page, a found total, legacy floors, both, the source check's lead", () => {
  const pageAt = (i: number) => ({
    url: `https://example.test/p${i}`,
    raw: { text: "" },
    rendered: null,
  });
  const pagesOf = (n: number) => Array.from({ length: n }, (_, i) => pageAt(i));
  const withPages = (
    pages: { url: string; raw: unknown; rendered: unknown }[],
    sitemap: { present: boolean; urlCount: number; truncated?: boolean },
    selection?: { pagesConsidered: number },
  ) => ({
    crawl: {
      ok: true,
      data: {
        ...(raw.crawl!.data as object),
        pages,
        sitemap,
        selection,
      },
    },
  });
  const noSitemap = { present: false, urlCount: 0 };
  const unanswered = stage("analyze", (d) => ({
    ...d,
    buyerQuestions: (d.buyerQuestions as BuyerQuestion[]).map((q, i) =>
      i < 2 ? { ...q, answered: "no", evidence: null, page: null } : q,
    ),
  }));
  /** A view with the journey stage's affordances emptied, over the given overrides. */
  const noContactAffordances = (over: Record<string, unknown>) =>
    view({
      ...over,
      ...stage("checks", (d) => ({
        ...d,
        journey: { ...(d.journey as object), affordances: [] },
      })),
    });
  const contactDetail = (v: ReportView) =>
    healthRows(v).find((r) => r.label === "Getting hold of you")?.detail ?? "";
  /** A view whose source check read `pagesRead` of `pagesTotal` pages. */
  const checked = (over: Record<string, unknown>, pagesRead: number, pagesTotal: number) => {
    const v = view(over);
    return { ...v, accuracy: { ...v.accuracy!, pagesRead, pagesTotal } } as ReportView;
  };

  // Finding 1: "your one page" only when a complete sitemap says the site is one page.
  it("one page of a 95-page sitemap is not 'your one page', and not 'not just the first'", () => {
    const v = noContactAffordances(
      withPages(pagesOf(1), { present: true, urlCount: 95 }, { pagesConsidered: 40 }),
    );
    const d = contactDetail(v);
    expect(d).toContain("so we measured this across the one page we read, of your 95.");
    expect(d).not.toMatch(/your one page|not just the first/);
  });

  it("one page of a truncated 50,000-page sitemap says 'out of at least', never 'your one page'", () => {
    const v = noContactAffordances(
      withPages(
        pagesOf(1),
        { present: true, urlCount: 50000, truncated: true },
        {
          pagesConsidered: 1,
        },
      ),
    );
    const d = contactDetail(v);
    expect(d).toContain(
      "so we measured this across the one page we read, out of at least 50,000 pages on your site.",
    );
    expect(d).not.toMatch(/your one page|not just the first/);
  });

  it("one page the home page links to is counted as such, and drops 'not just the first'", () => {
    const v = noContactAffordances(withPages(pagesOf(1), noSitemap, { pagesConsidered: 5 }));
    const d = contactDetail(v);
    expect(d).toContain(
      "so we measured this across the one page we read, of the five we found linked from your home page.",
    );
    expect(d).not.toContain("not just the first");
  });

  // Finding 2: a total larger than the sitemap is the pages we found, never "linked" nor "your".
  it("a home-page-and-sitemap total is the pages we found, never 'linked from your home page' or 'your 95'", () => {
    const v = view({
      ...unanswered,
      ...withPages(pagesOf(20), { present: true, urlCount: 60 }, { pagesConsidered: 95 }),
    });
    expect(v.pagesRead).toEqual({ read: 20, site: 95, siteIsFloor: false, siteFrom: "found" });
    const text = headlineFinding(v).text;
    expect(text).toContain("in the 20 pages we read, of the 95 we found");
    expect(text).not.toMatch(/linked from your home page|your 95|of your 95/);
    const how = primer(v, []).how;
    expect(how).toContain("It read 20 of the 95 pages we found");
    expect(how).not.toMatch(/linked from your home page|your 95/);
  });

  // Finding 3: a sitemap stored without its truncated flag is a floor, not a known total.
  it("a legacy sitemap with no truncated flag is a floor: 'at least', never 'your 66 pages'", () => {
    const v = view({
      ...unanswered,
      crawl: {
        ok: true,
        data: {
          ...(raw.crawl!.data as object),
          pages: pagesOf(20),
          sitemap: { present: true, urlCount: 66 },
          selection: undefined,
        },
      },
    });
    expect(v.pagesRead).toEqual({ read: 20, site: 66, siteIsFloor: true, siteFrom: "sitemap" });
    expect(inPagesRead(v)).toBe("in the 20 pages we read, out of at least 66 pages on your site");
    expect(primer(v, []).how).toContain("20 of at least 66 pages on your site");
    expect(primer(v, []).how).not.toMatch(/your 66 pages|of your 66/);
  });

  // Review round 6, finding 1: a crawl stored without its pages keeps the sitemap's floor.
  describe("no stored pages: the source check keeps the sitemap's floor", () => {
    const legacyWith = (sitemap: Record<string, unknown>) => {
      const base = view({
        crawl: { ok: true, data: { ...(raw.crawl!.data as object), pages: undefined, sitemap } },
      });
      return {
        ...base,
        accuracy: { ...base.accuracy!, pagesRead: 12, pagesTotal: 15 },
      } as ReportView;
    };

    it("a truncated sitemap makes the source check's total a floor: 'at least', never 'your 66'", () => {
      const v = legacyWith({ present: true, urlCount: 66, truncated: true });
      expect(v.pagesRead).toBeNull();
      expect(sourceCheckFootnote(v)).toBe(
        "We read 12 of at least 66 pages on your site for this check. A statement listed above may be on a page we did not read.",
      );
      expect(inSourceCheckPages(v)).toBe(
        "in the 12 pages we read, out of at least 66 pages on your site",
      );
    });

    it("a sitemap with no truncated key is a floor too: absent means unknown, never 'your 66'", () => {
      const v = legacyWith({ present: true, urlCount: 66 });
      expect(sourceCheckFootnote(v)).toBe(
        "We read 12 of at least 66 pages on your site for this check. A statement listed above may be on a page we did not read.",
      );
      expect(inSourceCheckPages(v)).toBe(
        "in the 12 pages we read, out of at least 66 pages on your site",
      );
    });

    // Positive control: a sitemap known to be complete keeps the exact count.
    it("an untruncated sitemap keeps the exact count, 'your 66'", () => {
      const v = legacyWith({ present: true, urlCount: 66, truncated: false });
      expect(sourceCheckFootnote(v)).toBe(
        "We read 12 of your 66 pages for this check. A statement listed above may be on a page we did not read.",
      );
      expect(inSourceCheckPages(v)).toBe("in the 12 of your 66 pages we read");
    });
  });

  // Review round 6, finding 2: a total equal to the pages read names them once.
  it("pages found and read in full are named once, never 'of the two we found'", () => {
    const found = view(
      withPages(pagesOf(2), { present: true, urlCount: 1 }, { pagesConsidered: 2 }),
    );
    expect(found.pagesRead).toEqual({ read: 2, site: 2, siteIsFloor: false, siteFrom: "found" });
    expect(pagesReadPhrase(found)).toBe("the two pages we found");
    expect(inPagesRead(found)).toBe("in the two pages we found, which we read");

    const one = view(withPages(pagesOf(1), { present: true, urlCount: 0 }, { pagesConsidered: 1 }));
    expect(one.pagesRead).toEqual({ read: 1, site: 1, siteIsFloor: false, siteFrom: "found" });
    expect(pagesReadPhrase(one)).toBe("the one page we found");
    expect(inPagesRead(one)).toBe("in the one page we found, which we read");

    const many = view(
      withPages(pagesOf(20), { present: true, urlCount: 5 }, { pagesConsidered: 20 }),
    );
    expect(pagesReadPhrase(many)).toBe("the 20 pages we found");
    expect(inPagesRead(many)).toBe("in the 20 pages we found, which we read");
    for (const v of [found, one, many]) {
      expect(inPagesRead(v)).not.toMatch(/\ball\b|your|of the \w+ we found/);
    }
  });

  it("pages the home page links to, all read, are named once, with the link", () => {
    const two = view(withPages(pagesOf(2), noSitemap, { pagesConsidered: 2 }));
    expect(two.pagesRead).toEqual({ read: 2, site: 2, siteIsFloor: false, siteFrom: "links" });
    expect(pagesReadPhrase(two)).toBe("the two pages we found linked from your home page");
    expect(inPagesRead(two)).toBe(
      "in the two pages we found linked from your home page, which we read",
    );
    expect(inPagesRead(two)).not.toMatch(/of the two|\ball\b|your pages/);
  });

  // Finding 4: two pages, all read, are "both", never "all two".
  it("a complete two-page sitemap says 'both of your pages', never 'all two'", () => {
    const v = noContactAffordances(
      withPages(pagesOf(2), { present: true, urlCount: 2 }, { pagesConsidered: 2 }),
    );
    expect(pagesReadPhrase(v)).toBe("both of your pages");
    expect(contactDetail(v)).toContain("across both of your pages we read, not just the first.");
    const how = primer(v, []).how;
    expect(how).toContain("It read both of your pages, each one twice");
    expect(how).not.toMatch(/all two/);
  });

  // Finding 5: one page of a larger sitemap reads "one page of your 95".
  it("one page of a 95-page sitemap reads 'one page of your 95' in every phrase", () => {
    const v = view(withPages(pagesOf(1), { present: true, urlCount: 95 }, { pagesConsidered: 40 }));
    expect(pagesReadPhrase(v)).toBe("one page of your 95");
    expect(inPagesRead(v)).toBe("in the one page we read, of your 95");
  });

  // Finding 6: a source check that read no page says so, in the words of its footnote.
  it("a source check that read no page, over a crawl that did, says no page could be read for this check", () => {
    const v = checked(
      withPages(pagesOf(20), { present: true, urlCount: 95 }, { pagesConsidered: 40 }),
      0,
      20,
    );
    expect(unsourcedLead(v)).toBe(", though no page could be read for this check");
  });
});
