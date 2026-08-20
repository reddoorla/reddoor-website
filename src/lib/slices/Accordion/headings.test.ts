import { describe, it, expect } from "vitest";
import { deriveItemTag, normalizeLabel } from "./headings";

describe("normalizeLabel", () => {
  it("treats every 'no label' shape Prismic can produce as empty", () => {
    // undefined: the default variation of a doc published before the field
    // existed. null: an editor cleared it. "": Slice Machine's empty Text.
    expect(normalizeLabel(undefined)).toBe("");
    expect(normalizeLabel(null)).toBe("");
    expect(normalizeLabel("")).toBe("");
    expect(normalizeLabel("   ")).toBe("");
    expect(normalizeLabel("\n\t ")).toBe("");
  });

  it("keeps a real label but trims it, so no heading renders as blank", () => {
    expect(normalizeLabel("  Frequently Asked Questions  ")).toBe("Frequently Asked Questions");
  });
});

describe("deriveItemTag", () => {
  it("keeps item titles at h2 with no label — the pre-existing published state", () => {
    // Regression lock: promoting these to h3 would jump the page h1 straight to
    // an h3 on every already-published `project` / `industry` document.
    expect(deriveItemTag(undefined)).toBe("h2");
    expect(deriveItemTag(null)).toBe("h2");
    expect(deriveItemTag("")).toBe("h2");
  });

  it("does not demote item titles under a whitespace-only label", () => {
    // The label would render as an empty heading (axe `empty-heading`) and the
    // items would sit at h3 under a heading that announces nothing.
    expect(deriveItemTag("   ")).toBe("h2");
  });

  it("nests item titles under a real label", () => {
    expect(deriveItemTag("Frequently Asked Questions")).toBe("h3");
    expect(deriveItemTag("  FAQ  ")).toBe("h3");
  });
});
