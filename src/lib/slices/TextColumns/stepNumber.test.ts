import { describe, it, expect } from "vitest";
import { stepNumber, numeralNudge } from "./stepNumber";

describe("stepNumber", () => {
  it("is 1-based, not 0-based — the first step reads 01, not 00", () => {
    expect(stepNumber(0)).toBe("01");
  });

  it("zero-pads single digits to the board's two-digit circles", () => {
    expect(stepNumber(1)).toBe("02");
    expect(stepNumber(2)).toBe("03");
    expect(stepNumber(8)).toBe("09");
  });

  it("stops padding at two digits so a tenth step stays 10, not 010", () => {
    expect(stepNumber(9)).toBe("10");
    expect(stepNumber(11)).toBe("12");
  });
});

describe("numeralNudge", () => {
  // The failure this guards against is a single average applied to every
  // numeral: it lands 01 too far left and 02-09 too far right, which is exactly
  // what shipped first and what got noticed.
  it("gives 01 a pixel and a half — `1` ends 2.74px short of its slot", () => {
    expect(numeralNudge("01")).toBeCloseTo(1.56, 2);
  });

  it("still moves numerals whose glyphs are symmetric — the tracking alone", () => {
    // Half the trailing letter-spacing, and nothing else: these glyphs sit
    // centred in their own slots.
    for (const n of ["02", "03", "04", "05", "06", "07", "08", "09"]) {
      expect(numeralNudge(n)).toBeCloseTo(0.5, 1);
    }
  });

  it("pulls back the other way when the numeral STARTS with a 1", () => {
    // `10`'s ink begins 1.82px in and ends on a symmetric `0`, so its bearings
    // more than cancel the tracking — the mirror of 01, and the case a single
    // average gets worst.
    expect(numeralNudge("10")).toBeCloseTo(-0.1, 2);
    expect(numeralNudge("12")).toBeCloseTo(-0.1, 2);
  });

  it("nets out near the tracking when a 1 sits at both ends", () => {
    expect(numeralNudge("11")).toBeCloseTo(0.96, 2);
  });

  it("never returns more than a pixel and change, at any step count", () => {
    for (let i = 0; i < 100; i++) {
      expect(Math.abs(numeralNudge(stepNumber(i)))).toBeLessThan(1.6);
    }
  });

  it("is 0 for an empty numeral rather than NaN in a style attribute", () => {
    expect(numeralNudge("")).toBe(0);
  });
});
