import { describe, it, expect } from "vitest";
import { fixLinkSentence } from "./health-fix-coverage";

// Keys are real health-row keys: "https" and "copyright" have a fix spec;
// "phones" and the site check "h1-present" have none.

describe("fixLinkSentence", () => {
  it("every problem row has a fix spec: the sentence says each one matches", () => {
    expect(fixLinkSentence(["https", "copyright"], true)).toEqual({
      before: "Each of these has a matching item in ",
      after: ".",
    });
  });

  it("some rows have no spec: no 'each', and no count", () => {
    for (const keys of [["https", "phones"], ["h1-present"]]) {
      const s = fixLinkSentence(keys, true);
      expect(s?.before).toBe("The ones we would act on first are in ");
      expect(`${s?.before}${s?.after}`).not.toMatch(/each|\d/i);
    }
  });

  it("a report with no fixes at all: no sentence", () => {
    expect(fixLinkSentence(["https"], false)).toBeNull();
    expect(fixLinkSentence(["phones"], false)).toBeNull();
  });

  it("no problem rows: no sentence", () => {
    expect(fixLinkSentence([], true)).toBeNull();
  });

  it("an inherited property name is not a fix spec", () => {
    expect(fixLinkSentence(["constructor"], true)?.before).toBe(
      "The ones we would act on first are in ",
    );
  });
});
