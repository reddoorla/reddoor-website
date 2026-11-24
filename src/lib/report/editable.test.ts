import { describe, it, expect } from "vitest";
import { editableTargets, resolveTargets, type EditTarget } from "./editable";
import { toReportView } from "./model";
import { healthFixes } from "./narrative";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";

const RAW = {
  url: "https://acme.test/",
  siteChecks: {
    ok: true,
    data: [
      {
        key: "dead-links",
        label: "Links that go nowhere",
        status: "fail",
        evidence: "3 of 40",
        why: "Generated why.",
        scope: "quick",
      },
    ],
  },
  analyze: {
    ok: true,
    data: {
      fixes: [
        { title: "Fix one", why: "Because.", impact: "high", effort: "low", tier: "content" },
      ],
    },
  },
};

describe("editableTargets", () => {
  it("lists payload strings with their key and current text", () => {
    const targets = editableTargets(toReportView(RAW), RAW);
    expect(targets).toContainEqual({
      key: "siteChecks.data[0].why",
      text: "Generated why.",
      original: "Generated why.",
    });
    expect(targets).toContainEqual({
      key: "analyze.data.fixes[0].title",
      text: "Fix one",
      original: "Fix one",
    });
  });

  it("reports the GENERATED text as original for an already-edited line", () => {
    const view = toReportView(RAW, {
      "siteChecks.data[0].why": { original: "Generated why.", text: "Edited why." },
    });
    expect(editableTargets(view, RAW)).toContainEqual({
      key: "siteChecks.data[0].why",
      text: "Edited why.",
      original: "Generated why.",
    });
  });

  it("skips empty and whitespace-only strings", () => {
    const raw = {
      ...RAW,
      siteChecks: { ok: true, data: [{ ...RAW.siteChecks.data[0], evidence: "   " }] },
    };
    const targets = editableTargets(toReportView(raw), raw);
    expect(targets.some((t) => t.key === "siteChecks.data[0].evidence")).toBe(false);
  });

  it("includes the composed sentences", () => {
    const keys = editableTargets(toReportView(RAW), RAW).map((t) => t.key);
    expect(keys).toContain("composed:headlineFinding");
  });

  // The fixture must actually produce the things these tests look for, or an
  // assertion like "no evidence target" passes because there are no targets at
  // all. Pins the control rather than assuming it.
  it("produces targets from this fixture at all", () => {
    expect(editableTargets(toReportView(RAW), RAW).length).toBeGreaterThan(2);
  });

  // Dependency order, required by the plan's own cascade section and otherwise
  // untested. `healthRows` is not a leaf: `passes` builds its items from
  // `${row.label}: ${row.value}`, `healthFixes` builds each why from
  // `${spec.what} ${row.detail}`, and `headlineFinding`'s site-check branch
  // prints a row label. So an override on a health row changes the GENERATED
  // text of those downstream sentences and invalidates any original already
  // recorded against them. Enumerating rows first means a consumer walking this
  // array in order sees a cause before its effects.
  it("enumerates health rows before the sentences built from them", () => {
    // The small RAW fixture above produces health rows but NO passes and NO
    // health fixes, so it cannot exercise this at all — written against it, this
    // test passed on an empty comparison. Uses the full fixture instead, and
    // asserts both families are present BEFORE comparing their positions, so a
    // fixture that stops producing one reds here rather than passing silently.
    const keys = editableTargets(toReportView(ALL_PASS_REPORT), ALL_PASS_REPORT).map((t) => t.key);
    const firstHealth = keys.findIndex((k) => k.startsWith("composed:health["));
    const firstDerived = keys.findIndex(
      (k) => k.startsWith("composed:passes[") || k.startsWith("composed:healthFix["),
    );
    expect(firstHealth).toBeGreaterThanOrEqual(0);
    expect(firstDerived).toBeGreaterThanOrEqual(0);
    expect(firstHealth).toBeLessThan(firstDerived);
  });
});

describe("W1 review round 4: every composed target key is one the renderer reads", () => {
  it("an edit saved under a health fix's target key renders in healthFixes", () => {
    const raw = viewportFails() as typeof ALL_PASS_REPORT;
    const targets = editableTargets(toReportView(raw), raw).filter((t) =>
      t.key.startsWith("composed:healthFix["),
    );
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      const map = { [t.key]: { original: t.original, text: `EDITED ${t.key}` } };
      const view = toReportView(raw, map);
      const shown = healthFixes(view).flatMap((f) => [f.title, f.why]);
      expect(shown).toContain(`EDITED ${t.key}`);
    }
  });
});

describe("resolveTargets", () => {
  const t = (key: string, text: string): EditTarget => ({ key, text, original: text });

  it("wires a leaf that maps to exactly one target", () => {
    const { resolved, ambiguous } = resolveTargets(
      [{ id: "a", text: "Only once." }],
      [t("k1", "Only once.")],
    );
    expect(resolved).toEqual([{ id: "a", target: t("k1", "Only once.") }]);
    expect(ambiguous).toBe(0);
  });

  it("skips a string that names more than one target", () => {
    const { resolved, ambiguous } = resolveTargets(
      [{ id: "a", text: "Same words." }],
      [t("k1", "Same words."), t("k2", "Same words.")],
    );
    expect(resolved).toEqual([]);
    expect(ambiguous).toBe(1);
  });

  it("skips a target rendered in more than one place", () => {
    const { resolved, ambiguous } = resolveTargets(
      [
        { id: "a", text: "Twice on screen." },
        { id: "b", text: "Twice on screen." },
      ],
      [t("k1", "Twice on screen.")],
    );
    expect(resolved).toEqual([]);
    expect(ambiguous).toBe(2);
  });

  it("ignores rendered text that is not a target at all", () => {
    const { resolved, ambiguous } = resolveTargets(
      [{ id: "a", text: "Just page furniture." }],
      [t("k1", "Something else.")],
    );
    expect(resolved).toEqual([]);
    expect(ambiguous).toBe(0);
  });

  it("resolves the unambiguous ones alongside the ambiguous", () => {
    const { resolved, ambiguous } = resolveTargets(
      [
        { id: "a", text: "Unique." },
        { id: "b", text: "Dupe." },
        { id: "c", text: "Dupe." },
      ],
      [t("k1", "Unique."), t("k2", "Dupe.")],
    );
    expect(resolved.map((r) => r.id)).toEqual(["a"]);
    expect(ambiguous).toBe(2);
  });
});

describe("W1: hide targets and the changes list", () => {
  it("lists hideable rows from the stored payload, marking the hidden ones", async () => {
    const { hideTargets, changeList } = await import("./editable");
    const raw = {
      analyze: { ok: true, data: { fixes: [{ title: "Fix one" }, { title: "Fix two" }] } },
      accuracy: {
        ok: true,
        data: {
          conflation: {
            detected: true,
            settled: false,
            otherNames: [],
            engineQuote: "Two of them.",
          },
        },
      },
    } as never;
    const map = {
      "analyze.data.fixes[1]": { original: "Fix two", text: "", hidden: true as const },
      "composed:headlineFinding": { original: "Old.", text: "New." },
    };
    const targets = hideTargets(raw, map);
    expect(targets.map((t) => [t.key, t.hidden])).toEqual([
      ["analyze.data.fixes[0]", false],
      ["analyze.data.fixes[1]", true],
      ["accuracy.data.conflation", false],
    ]);
    const onScreen = [{ key: "composed:headlineFinding", text: "New.", original: "Old." }];
    expect(changeList(map, onScreen)).toEqual([
      { key: "analyze.data.fixes[1]", kind: "hidden", before: "Fix two", after: "" },
      { key: "composed:headlineFinding", kind: "reworded", before: "Old.", after: "New." },
    ]);
  });
});

describe("W1 review round 1: a rewording the page withholds", () => {
  it("is listed as stale, not as in force, and a retype records the generated text", async () => {
    const { changeList } = await import("./editable");
    const map = { "composed:passes[1].items[14]": { original: "Old line", text: "REWORDED" } };
    // On screen now, under that key, is a different generated line.
    const targets = [
      { key: "composed:passes[1].items[14]", text: "Another line", original: "Another line" },
    ];
    expect(changeList(map, targets)).toEqual([
      { key: "composed:passes[1].items[14]", kind: "stale", before: "Old line", after: "REWORDED" },
    ]);
    // In force when the target shows it.
    const inForce = [
      { key: "composed:passes[1].items[14]", text: "REWORDED", original: "Old line" },
    ];
    expect(changeList(map, inForce)[0]!.kind).toBe("reworded");
  });
});

describe("W1 review round 2: hiding stops at the last row, and a hidden row is not a target", () => {
  const raw = {
    analyze: {
      ok: true,
      data: {
        fixes: [
          { title: "Fix one", why: "w1" },
          { title: "Fix two", why: "w2" },
        ],
      },
    },
  } as never;

  it("the last visible row of a section cannot be hidden", async () => {
    const { hideTargets } = await import("./editable");
    const map = {
      "analyze.data.fixes[0]": { original: "Fix one", text: "", hidden: true as const },
    };
    const t = hideTargets(raw, map);
    expect(t.find((x) => x.key === "analyze.data.fixes[1]")!.canHide).toBe(false);
    // With nothing hidden, both can be.
    expect(hideTargets(raw, {}).every((x) => x.canHide)).toBe(true);
  });

  it("a rewording on a hidden row is listed as stale, not in force", async () => {
    const { changeList, editableTargets } = await import("./editable");
    const { toReportView } = await import("./model");
    const map = {
      "analyze.data.fixes[0]": { original: "Fix one", text: "", hidden: true as const },
      "analyze.data.fixes[0].why": { original: "w1", text: "W1 edited" },
    };
    const targets = editableTargets(toReportView(raw, map), raw);
    expect(targets.some((t) => t.key.startsWith("analyze.data.fixes[0]"))).toBe(false);
    expect(changeList(map, targets).find((c) => c.key === "analyze.data.fixes[0].why")!.kind).toBe(
      "stale",
    );
  });
});

/** The all-pass fixture with one measured problem: no viewport tag (one health fix). */
function viewportFails() {
  const r = structuredClone(ALL_PASS_REPORT) as Record<string, unknown>;
  (r.checks as { data: Record<string, unknown> }).data.viewportOk = false;
  return r;
}

describe("R1 fix 10: hiding offers only the accuracy rows on the page", () => {
  const assertion = (over: Record<string, unknown>) => ({
    claim: "",
    verdict: "absent",
    engineQuote: "",
    siteQuote: null,
    unverifiedReason: null,
    nearbyMention: null,
    sourceDomains: [],
    query: "who is Example Studio",
    engine: "claude",
    subject: "prospect",
    ...over,
  });
  const allPass = ALL_PASS_REPORT as unknown as { accuracy: { data: Record<string, unknown> } };
  const raw = {
    ...ALL_PASS_REPORT,
    accuracy: {
      ok: true,
      data: {
        ...allPass.accuracy.data,
        assertions: [
          assertion({
            claim: "Example Studio has an office in Denver.",
            engineQuote: "an office in Denver",
          }),
          assertion({
            claim: "Southgate has a branch in Riverton.",
            verdict: "confirmed",
            engineQuote: "Southgate opened a branch in Riverton",
            siteQuote: "Example Studio, Austin, Texas",
            subject: "other",
          }),
          assertion({
            claim: "It holds a 3.4 out of 5 rating.",
            engineQuote: "Employee ratings sit at 3.4/5",
          }),
        ],
      },
    },
  } as never;

  it("offers only the printed row, which is then the last one and cannot be hidden", async () => {
    const { hideTargets } = await import("./editable");
    const accuracy = hideTargets(raw, {}).filter((t) =>
      t.key.startsWith("accuracy.data.assertions["),
    );
    expect(accuracy.map((t) => t.key)).toEqual(["accuracy.data.assertions[0]"]);
    expect(accuracy[0]!.canHide).toBe(false);
  });

  it("labels an accuracy row with its quote, and keeps the claim as the identity", async () => {
    const { hideTargets } = await import("./editable");
    const [t] = hideTargets(raw, {}).filter((x) => x.key.startsWith("accuracy.data.assertions["));
    expect(t!.label).toBe("“an office in Denver”");
    expect(t!.original).toBe("Example Studio has an office in Denver.");
  });
});
