import { describe, expect, it } from "vitest";
import { SITE_TITLES, auditHeadline, docHeadline, headlineSize } from "./headline";

describe("SITE_TITLES", () => {
  it("covers every code-routed page and the default", () => {
    expect(Object.keys(SITE_TITLES).sort()).toEqual(
      ["about", "audit", "contact", "default", "portfolio", "showcase"].sort(),
    );
  });

  // The point of the map: a card repeats the page's title, it does not invent
  // a line of its own. Each entry is the string in that page's <title>.
  it("is the page's own title, and reduces to the bare page name", () => {
    expect(SITE_TITLES.about).toBe("About | Reddoor Creative");
    expect(SITE_TITLES.contact).toBe("Contact | Reddoor Creative");
    expect(SITE_TITLES.portfolio).toBe("Portfolio | Reddoor Creative");
    expect(SITE_TITLES.showcase).toBe("Reddoor Creative | Showcase");
    expect(SITE_TITLES.audit).toBe(auditHeadline(null));
    expect(
      ["about", "contact", "portfolio", "showcase"].map((k) => docHeadline(SITE_TITLES[k])),
    ).toEqual(["About", "Contact", "Portfolio", "Showcase"]);
  });
});

describe("docHeadline", () => {
  it("strips the site name from either end", () => {
    expect(docHeadline("MedTech | Reddoor Creative")).toBe("MedTech");
    expect(docHeadline("Home | reddoor creative")).toBe("Home");
    expect(docHeadline("Reddoor Creative | Showcase")).toBe("Showcase");
  });
  it("keeps a title that is only the site name — the default card", () => {
    expect(docHeadline("Reddoor Creative")).toBe("Reddoor Creative");
  });
  it("collapses whitespace", () => {
    expect(docHeadline("  Two\n words  ")).toBe("Two words");
  });
  it("caps runaway titles at 90 characters with an ellipsis", () => {
    const long = "x".repeat(120);
    expect(docHeadline(long)).toHaveLength(90);
    expect(docHeadline(long).endsWith("…")).toBe(true);
  });
  it("falls back to the site name when empty", () => {
    expect(docHeadline("")).toBe(SITE_TITLES.default);
    expect(docHeadline(" | Reddoor Creative")).toBe(SITE_TITLES.default);
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
