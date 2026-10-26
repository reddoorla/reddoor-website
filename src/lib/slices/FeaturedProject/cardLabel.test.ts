import { describe, expect, it } from "vitest";
import { resolveCardLabel } from "./cardLabel";

describe("resolveCardLabel", () => {
  it("prefers the project title", () => {
    expect(resolveCardLabel("Medical Solutions of Texas", "An iMac showing the MSOT site")).toBe(
      "Medical Solutions of Texas",
    );
  });

  it("keeps the title in its stored natural case (the uppercase is CSS only)", () => {
    expect(resolveCardLabel("Medical Solutions of Texas", null)).not.toBe(
      "MEDICAL SOLUTIONS OF TEXAS",
    );
  });

  it("falls back to the image alt when no title was authored", () => {
    expect(resolveCardLabel(null, "An iMac showing the MSOT site")).toBe(
      "An iMac showing the MSOT site",
    );
    expect(resolveCardLabel(undefined, "An iMac showing the MSOT site")).toBe(
      "An iMac showing the MSOT site",
    );
    expect(resolveCardLabel("", "An iMac showing the MSOT site")).toBe(
      "An iMac showing the MSOT site",
    );
  });

  it("treats whitespace-only values as absent", () => {
    expect(resolveCardLabel("   ", "An iMac showing the MSOT site")).toBe(
      "An iMac showing the MSOT site",
    );
    expect(resolveCardLabel("  ", "  ")).toBe("View project");
  });

  it("never returns an empty name — an unnamed link is an axe link-name violation", () => {
    expect(resolveCardLabel(null, null)).toBe("View project");
    expect(resolveCardLabel("", "")).toBe("View project");
    expect(resolveCardLabel(undefined, undefined)).toBe("View project");
  });

  // WCAG 2.5.3 (Label in Name): the caption shows the services line under the
  // title, so it has to be in the name too. axe 4.14 runs this as
  // `label-content-name-mismatch` and compares lowercased, punctuation-stripped
  // text; this does the same.
  describe("contains every word the caption shows", () => {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
    const cases: [string | null, string | null, string | null][] = [
      ["Medical Solutions of Texas", "An iMac showing the MSOT site", "brand, digital"],
      [null, "An iMac showing the MSOT site", "brand, digital"],
      [null, null, "brand, digital"],
      ["Medical Solutions of Texas", null, null],
    ];
    for (const [title, alt, services] of cases) {
      it(`title ${JSON.stringify(title)}, alt ${JSON.stringify(alt)}, services ${JSON.stringify(services)}`, () => {
        const visible = normalize([title, services].filter(Boolean).join(" "));
        expect(normalize(resolveCardLabel(title, alt, services))).toContain(visible);
      });
    }
  });

  it("leads with the project and keeps the services after it", () => {
    expect(resolveCardLabel("Medical Solutions of Texas", null, "  brand, digital ")).toBe(
      "Medical Solutions of Texas, brand, digital",
    );
    expect(resolveCardLabel("Medical Solutions of Texas", null, "   ")).toBe(
      "Medical Solutions of Texas",
    );
  });

  it("returns the trimmed value it picked", () => {
    expect(resolveCardLabel("  Medical Solutions of Texas  ", null)).toBe(
      "Medical Solutions of Texas",
    );
    expect(resolveCardLabel(null, "  An iMac showing the MSOT site  ")).toBe(
      "An iMac showing the MSOT site",
    );
  });
});
