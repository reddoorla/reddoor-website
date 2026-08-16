import { describe, it, expect } from "vitest";
import { stepNumber } from "./stepNumber";

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
