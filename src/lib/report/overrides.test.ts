import { describe, it, expect } from "vitest";
import { applyOverrides, composed, type OverrideMap } from "./overrides";

/**
 * `OverrideMap` is a cast at the fetch boundary, not a validated shape: `unwrap`
 * proves only that `overrides` is a non-array object, never that an entry is
 * `{ original, text }`. So a map of the wrong shape is a wire fact, not a type
 * error, and these tests have to build one the only way the runtime can see it —
 * through a cast.
 */
const wire = (map: Record<string, unknown>): OverrideMap => map as OverrideMap;

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

  it("WITHHOLDS an entry whose text is not a string", () => {
    const bad = wire({
      "composed:headlineFinding": { original: "Generated line.", text: { nested: "object" } },
    });
    const out = composed(bad, "composed:headlineFinding", "Generated line.");
    expect(out).toBe("Generated line.");
    expect(typeof out).toBe("string");
  });
});

describe("applyOverrides", () => {
  const raw = {
    url: "https://acme.test/",
    siteChecks: {
      ok: true,
      data: [{ key: "dead-links", label: "Links that go nowhere", why: "Generated why." }],
    },
    analyze: {
      ok: true,
      data: {
        fixes: [
          { title: "Fix one", why: "Because." },
          { title: "Fix two", why: "Also because." },
        ],
      },
    },
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

  // The single-entry cases above never exercise the machinery this function is
  // shaped around: the clone-once flag, the re-walk per override, and whether a
  // second write can see the first. Two entries is the smallest map that can.

  it("applies TWO overrides to the same object, and still does not mutate the input", () => {
    const before = JSON.stringify(raw);
    const out = applyOverrides(raw, {
      "siteChecks.data[0].why": { original: "Generated why.", text: "Edited why." },
      "siteChecks.data[0].label": {
        original: "Links that go nowhere",
        text: "Links that lead nowhere",
      },
    }) as typeof raw;

    expect(out.siteChecks.data[0].why).toBe("Edited why.");
    expect(out.siteChecks.data[0].label).toBe("Links that lead nowhere");
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("applies TWO overrides to the same array, and still does not mutate the input", () => {
    const before = JSON.stringify(raw);
    const out = applyOverrides(raw, {
      "analyze.data.fixes[0].title": { original: "Fix one", text: "Fix one, reworded" },
      "analyze.data.fixes[1].title": { original: "Fix two", text: "Fix two, reworded" },
    }) as typeof raw;

    expect(out.analyze.data.fixes[0].title).toBe("Fix one, reworded");
    expect(out.analyze.data.fixes[1].title).toBe("Fix two, reworded");
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("WITHHOLDS a null entry rather than throwing", () => {
    // A null entry reaches here intact, because nothing upstream validates one.
    // Inside a `$derived` a throw blanks the report rather than degrading it.
    expect(() => applyOverrides(raw, wire({ "siteChecks.data[0].why": null }))).not.toThrow();

    const out = applyOverrides(raw, wire({ "siteChecks.data[0].why": null })) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Generated why.");
  });

  it("WITHHOLDS an entry with no text, rather than deleting the string", () => {
    const out = applyOverrides(
      raw,
      wire({ "siteChecks.data[0].why": { original: "Generated why." } }),
    ) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Generated why.");
  });

  it("WITHHOLDS an entry whose text is not a string", () => {
    const out = applyOverrides(
      raw,
      wire({
        "siteChecks.data[0].why": { original: "Generated why.", text: { nested: "object" } },
      }),
    ) as typeof raw;
    expect(out.siteChecks.data[0].why).toBe("Generated why.");
    expect(typeof out.siteChecks.data[0].why).toBe("string");
  });

  it("REFUSES unsafe path segments, so prototype pollution is unreachable", () => {
    try {
      applyOverrides(
        raw,
        wire({
          "__proto__.polluted": { original: undefined, text: "owned" },
          "constructor.prototype.polluted": { original: undefined, text: "owned" },
          "siteChecks.__proto__.polluted": { original: undefined, text: "owned" },
        }),
      );
      const proto = Object.prototype as unknown as Record<string, unknown>;
      expect(proto.polluted).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    } finally {
      // Never let an escaped write leak into a sibling test file.
      delete (Object.prototype as unknown as Record<string, unknown>).polluted;
    }
  });

  it("REFUSES an unsafe segment even where it resolves to a real own string", () => {
    // The three cases above cannot pollute today whether or not parsePath
    // refuses them, because the walk and the write-gate happen to block them —
    // which is exactly the coincidence the guard replaces, and which would make
    // that test green against unguarded code too. This one is not a coincidence:
    // `constructor` here is an OWN string property, so it walks and it matches,
    // and only parsePath refusing the segment withholds the write.
    const odd = { stage: { constructor: "Generated why." } };
    const out = applyOverrides(
      odd as unknown as Parameters<typeof applyOverrides>[0],
      wire({ "stage.constructor": { original: "Generated why.", text: "Edited why." } }),
    ) as unknown as typeof odd;

    expect(out.stage.constructor).toBe("Generated why.");
    expect(out).toBe(odd);
  });

  it("SHARES an untouched subtree by identity, and clones only the touched one", () => {
    const out = applyOverrides(raw, {
      "siteChecks.data[0].why": { original: "Generated why.", text: "Edited why." },
    }) as typeof raw;

    expect(out).not.toBe(raw);
    expect(out.analyze).toBe(raw.analyze);
    expect(out.siteChecks).not.toBe(raw.siteChecks);
  });

  it("returns the SAME report object for an empty map", () => {
    expect(applyOverrides(raw, {})).toBe(raw);
  });
});
