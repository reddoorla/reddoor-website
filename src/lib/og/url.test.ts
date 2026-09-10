import { describe, expect, it } from "vitest";
import { OG_KINDS, isOgKind, isOgId, ogCardPath } from "./url";

describe("ogCardPath", () => {
  it("builds the endpoint path", () => {
    expect(ogCardPath("site", "about")).toBe("/og/site/about.png");
    expect(ogCardPath("industry", "medtech")).toBe("/og/industry/medtech.png");
  });
  it("refuses an id the endpoint would reject", () => {
    expect(() => ogCardPath("site", "a b")).toThrow();
    expect(() => ogCardPath("site", "")).toThrow();
  });
});

describe("validation", () => {
  it("knows the kinds", () => {
    expect(OG_KINDS).toEqual(["site", "page", "industry", "showcase", "project"]);
    expect(isOgKind("site")).toBe(true);
    expect(isOgKind("nope")).toBe(false);
    // Per-report cards would need the function; reports share site/audit.
    expect(isOgKind("audit")).toBe(false);
  });
  it("accepts Prismic uids and registry slugs", () => {
    expect(isOgId("the-texas-organ-sharing-alliance")).toBe(true);
    expect(isOgId("default")).toBe(true);
    expect(isOgId("a".repeat(80))).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isOgId("a".repeat(81))).toBe(false);
    expect(isOgId("../x")).toBe(false);
    expect(isOgId("hello world")).toBe(false);
    expect(isOgId("")).toBe(false);
  });
});
