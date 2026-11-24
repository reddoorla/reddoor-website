import { describe, it, expect } from "vitest";
import { fixLinkSentence } from "./health-fix-coverage";

// Keys are real health-row keys: "https" and "copyright" have a fix spec,
// "phones" is a receipt with no spec, so it can never have a fix.

describe("fixLinkSentence", () => {
  it("every problem row has a fix: the sentence says each one matches", () => {
    expect(fixLinkSentence(["https", "copyright"])).toEqual({
      before: "Each of these has a matching item in ",
      after: ".",
    });
  });

  it("some problem rows have a fix: the sentence counts them and lists the rest", () => {
    expect(fixLinkSentence(["https", "phones"])).toEqual({
      before: "1 of these have a matching item in ",
      after: "; the rest are listed here so you can check them.",
    });
  });

  it("no problem row has a fix: no sentence", () => {
    expect(fixLinkSentence(["phones"])).toBeNull();
  });

  it("no problem rows: no sentence", () => {
    expect(fixLinkSentence([])).toBeNull();
  });
});
