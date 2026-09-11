import { describe, it, expect } from "vitest";
import { editableTargets, resolveTargets, type EditTarget } from "./editable";
import { toReportView } from "./model";
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
