import { describe, it, expect } from "vitest";
import { applyOverrides, composed, type OverrideMap } from "./overrides";

describe("composed", () => {
  const map: OverrideMap = {
    "composed:headlineFinding": { original: "Generated line.", text: "Edited line." },
  };

  it("returns the override when the original still matches", () => {
    expect(composed(map, "composed:headlineFinding", "Generated line.")).toBe("Edited line.");
  });

  it("returns the generated text when there is no override", () => {
    expect(composed(map, "composed:openingSummary", "Generated line.")).toBe("Generated line.");
  });

  it("WITHHOLDS an override whose original no longer matches", () => {
    expect(composed(map, "composed:headlineFinding", "Something else entirely.")).toBe(
      "Something else entirely.",
    );
  });

  it("passes an empty map through untouched", () => {
    expect(composed({}, "composed:headlineFinding", "Generated line.")).toBe("Generated line.");
  });
});

describe("applyOverrides", () => {
  const raw = {
    url: "https://acme.test/",
    siteChecks: {
      ok: true,
      data: [{ key: "dead-links", label: "Links that go nowhere", why: "Generated why." }],
    },
    analyze: { ok: true, data: { fixes: [{ title: "Fix one", why: "Because." }] } },
  };

  it("replaces a value addressed through a stage wrapper", () => {
    const out = applyOverrides(raw, {
      "siteChecks.data[0].why": { original: "Generated why.", text: "Edited why." },
    }) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Edited why.");
  });

  it("replaces a nested array value", () => {
    const out = applyOverrides(raw, {
      "analyze.data.fixes[0].title": { original: "Fix one", text: "Fix one, reworded" },
    }) as typeof raw;
    expect(out.analyze.data.fixes[0].title).toBe("Fix one, reworded");
  });

  it("WITHHOLDS an override whose original no longer matches", () => {
    const out = applyOverrides(raw, {
      "siteChecks.data[0].why": { original: "Stale text.", text: "Edited why." },
    }) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Generated why.");
  });

  it("ignores a path that does not resolve, rather than throwing", () => {
    expect(() =>
      applyOverrides(raw, { "nope.data[9].why": { original: "x", text: "y" } }),
    ).not.toThrow();
  });

  it("ignores composed: keys, which are not payload paths", () => {
    const out = applyOverrides(raw, {
      "composed:headlineFinding": { original: "a", text: "b" },
    }) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Generated why.");
  });

  it("does not mutate the input", () => {
    const before = JSON.stringify(raw);
    applyOverrides(raw, {
      "siteChecks.data[0].why": { original: "Generated why.", text: "Edited why." },
    });
    expect(JSON.stringify(raw)).toBe(before);
  });
});
