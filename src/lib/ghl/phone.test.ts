import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes ten US digits however they're dressed", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    expect(normalizePhone("1 555 123 4567")).toBe("+15551234567");
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("passes anything else through untouched rather than guessing", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(normalizePhone("  12345  ")).toBe("12345");
  });

  it("never re-stamps an explicit non-US country code as +1", () => {
    // Ten total digits behind a + must stay put — the old code slapped +1 on
    // the front and produced a bogus number.
    expect(normalizePhone("+351 12 345 678")).toBe("+351 12 345 678");
    expect(normalizePhone("+30 21 012 3456")).toBe("+30 21 012 3456");
    // …but a +1 US number still normalizes.
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });
});
