import { describe, it, expect } from "vitest";
import { stepNumber, numeralNudge } from "./stepNumber";

describe("stepNumber", () => {
  it("reads the step's 1-based position, never 0-based", () => {
    for (let i = 0; i < 100; i++) {
      expect(stepNumber(i)).toMatch(/^\d+$/);
      expect(Number(stepNumber(i)), stepNumber(i)).toBe(i + 1);
    }
  });

  it("stops padding at two digits so a tenth step stays 10, not 010", () => {
    expect(stepNumber(9)).toBe("10");
    expect(stepNumber(11)).toBe("12");
  });
});

describe("numeralNudge", () => {
  it("is a finite number at any step count, never NaN or Infinity in a style attribute", () => {
    for (let i = 0; i < 100; i++) {
      expect(Number.isFinite(numeralNudge(stepNumber(i))), stepNumber(i)).toBe(true);
    }
  });
});
