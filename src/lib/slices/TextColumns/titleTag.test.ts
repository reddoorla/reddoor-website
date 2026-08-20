import { describe, expect, it } from "vitest";
import { deriveTitleTag } from "./titleTag";

describe("deriveTitleTag", () => {
  describe("default variation", () => {
    it("nests column titles under the slice's own eyebrow", () => {
      expect(deriveTitleTag("default", "Our Solution")).toBe("h3");
    });

    it("promotes column titles to h2 when there is no eyebrow to nest under", () => {
      expect(deriveTitleTag("default", "")).toBe("h2");
      expect(deriveTitleTag("default", null)).toBe("h2");
      expect(deriveTitleTag("default", undefined)).toBe("h2");
    });
  });

  describe("landing-page variations", () => {
    it("always uses h3 — a LeadText rail (or this slice's own rail label) owns the h2", () => {
      expect(deriveTitleTag("serviceList", "")).toBe("h3");
      expect(deriveTitleTag("serviceList", null)).toBe("h3");
      expect(deriveTitleTag("serviceList", "What we do for you:")).toBe("h3");
      expect(deriveTitleTag("iconColumns", "")).toBe("h3");
      expect(deriveTitleTag("iconColumns", null)).toBe("h3");
      expect(deriveTitleTag("iconColumns", "Brand Credibility Framework")).toBe("h3");
    });
  });

  it("treats an unknown variation like the default one", () => {
    expect(deriveTitleTag("somethingNew", "Label")).toBe("h3");
    expect(deriveTitleTag("somethingNew", "")).toBe("h2");
  });
});
