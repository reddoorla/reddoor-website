import { describe, expect, it } from "vitest";
import { SITE_HEADLINES, auditHeadline, docHeadline, headlineSize } from "./headline";

describe("SITE_HEADLINES", () => {
  it("covers every code-routed page and the default", () => {
    expect(Object.keys(SITE_HEADLINES).sort()).toEqual(
      ["about", "contact", "default", "portfolio", "showcase"].sort(),
    );
  });
});

describe("docHeadline", () => {
  it("strips the site's title suffix", () => {
    expect(docHeadline("MedTech | Reddoor Creative")).toBe("MedTech");
    expect(docHeadline("Home | reddoor creative")).toBe("Home");
  });
  it("collapses whitespace", () => {
    expect(docHeadline("  Two\n words  ")).toBe("Two words");
  });
  it("caps runaway titles at 90 characters with an ellipsis", () => {
    const long = "x".repeat(120);
    expect(docHeadline(long)).toHaveLength(90);
    expect(docHeadline(long).endsWith("…")).toBe(true);
  });
  it("falls back to the default headline when empty", () => {
    expect(docHeadline("")).toBe(SITE_HEADLINES.default);
    expect(docHeadline(" | Reddoor Creative")).toBe(SITE_HEADLINES.default);
  });
});

describe("auditHeadline", () => {
  it("names the business", () => {
    expect(auditHeadline("Beachfront Dentistry")).toBe("When AI answers for Beachfront Dentistry");
  });
  it("uses the generic line without a name", () => {
    expect(auditHeadline(null)).toBe("When AI answers for your business");
    expect(auditHeadline("   ")).toBe("When AI answers for your business");
  });
});

describe("headlineSize", () => {
  it("steps down as the headline grows", () => {
    expect(headlineSize("Portfolio")).toBe(92);
    expect(headlineSize("Thanks for being straight with us.")).toBe(72);
    expect(headlineSize("We save you from drowning in an ocean of noise.")).toBe(56);
  });
});
