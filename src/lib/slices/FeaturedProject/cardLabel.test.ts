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

  it("returns the trimmed value it picked", () => {
    expect(resolveCardLabel("  Medical Solutions of Texas  ", null)).toBe(
      "Medical Solutions of Texas",
    );
    expect(resolveCardLabel(null, "  An iMac showing the MSOT site  ")).toBe(
      "An iMac showing the MSOT site",
    );
  });
});
