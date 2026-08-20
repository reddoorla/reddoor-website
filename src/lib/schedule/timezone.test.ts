import { describe, expect, it } from "vitest";
import { isIanaZone, normalizeZone } from "./timezone";

describe("isIanaZone", () => {
  it("accepts the zones our visitors actually report", () => {
    for (const z of [
      "America/Chicago", // Erik's — the report that prompted this
      "America/Boise", // the location's own
      "America/Los_Angeles",
      "America/New_York",
      "Europe/London",
      "Asia/Kolkata",
      "America/Argentina/Buenos_Aires", // three segments
    ]) {
      expect(isIanaZone(z), z).toBe(true);
    }
  });

  it("rejects anything the tz database does not know", () => {
    // Intl is the check rather than a regex: the question is whether the
    // database knows the zone, not whether the string looks plausible.
    expect(isIanaZone("America/Nowhere")).toBe(false);
    expect(isIanaZone("Mountain Time")).toBe(false);
    expect(isIanaZone("MDT")).toBe(false);
  });

  it("rejects bare offsets and abbreviations that carry no region", () => {
    // "UTC" is a valid Intl argument but tells us nothing about where someone
    // is, and putting it on a contact would claim more than we know.
    expect(isIanaZone("UTC")).toBe(false);
    expect(isIanaZone("GMT")).toBe(false);
    expect(isIanaZone("+05:30")).toBe(false);
  });

  it("rejects non-strings and oversized input", () => {
    expect(isIanaZone(undefined)).toBe(false);
    expect(isIanaZone(null)).toBe(false);
    expect(isIanaZone(42)).toBe(false);
    expect(isIanaZone("")).toBe(false);
    expect(isIanaZone("America/" + "x".repeat(200))).toBe(false);
  });
});

describe("normalizeZone", () => {
  it("trims a recognised zone", () => {
    expect(normalizeZone("  America/Chicago  ")).toBe("America/Chicago");
  });

  it("drops an unrecognised one rather than substituting a default", () => {
    // A wrong zone silently applied is worse than the CRM's Mountain fallback:
    // the fallback is at least consistent and explicable.
    expect(normalizeZone("Middle/Earth")).toBeUndefined();
    expect(normalizeZone("")).toBeUndefined();
  });
});
