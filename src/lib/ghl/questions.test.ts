import { describe, expect, it } from "vitest";
import { questionsFor, SMS_CONSENT, BUDGET_GATE, isBudgetOptOut } from "./questions";
import { DEFAULT_INQUIRY_SURVEY_ID } from "./constants";

// These assertions pin the CRM contract, not our prose. Every tag is a GHL
// field id and every option string is the literal value the CRM matches
// against its picklists — if one of these tests fails, either the GHL survey
// changed (mirror it here) or someone edited copy that was never ours to edit.
describe("the A-101 question set", () => {
  const questions = questionsFor(DEFAULT_INQUIRY_SURVEY_ID)!;

  it("exists for the default survey and only the default survey", () => {
    expect(questions).toBeDefined();
    expect(questionsFor("someOtherSurvey")).toBeUndefined();
  });

  it("is five questions with the survey's field tags, in slide order", () => {
    expect(questions.map((q) => q.tag)).toEqual([
      "vlLzA6TsJhHkmvmf6ArR",
      "website",
      "K0obgvYezsY9MX088GFN",
      "iRpYADswmWvMc0hnWtrT",
      "xW6eFrHUFBNQCijp1mOM",
    ]);
    expect(questions.map((q) => q.kind)).toEqual([
      "checkbox",
      "text",
      "checkbox",
      "radio",
      "radio",
    ]);
  });

  it("submits the CRM's exact option strings", () => {
    const byTag = Object.fromEntries(questions.map((q) => [q.tag, q]));
    const options = (tag: string) =>
      (byTag[tag] as Extract<(typeof questions)[number], { kind: "checkbox" | "radio" }>).options;

    expect(options("vlLzA6TsJhHkmvmf6ArR")).toHaveLength(6);
    expect(options("K0obgvYezsY9MX088GFN")).toHaveLength(5);
    expect(options("iRpYADswmWvMc0hnWtrT")).toEqual([
      "Just myself",
      "My business partner",
      "My department head",
      "Our board of directors",
      "Other",
    ]);
    // Reduced from six price ranges to a yes/no gate — Tim's ask, Erik's
    // wording, both 2026-08-24. "No" self-opts the visitor out (see BUDGET_GATE).
    expect(options("xW6eFrHUFBNQCijp1mOM")).toEqual(["Yes", "No"]);
  });

  it("names the budget gate and recognises only its exact opt-out", () => {
    expect(BUDGET_GATE.tag).toBe("xW6eFrHUFBNQCijp1mOM");
    expect(isBudgetOptOut({ [BUDGET_GATE.tag]: "No" })).toBe(true);
    expect(isBudgetOptOut({ [BUDGET_GATE.tag]: "Yes" })).toBe(false);
    // Unanswered, array-shaped, or foreign values are not an opt-out.
    expect(isBudgetOptOut({})).toBe(false);
    expect(isBudgetOptOut({ [BUDGET_GATE.tag]: ["No"] })).toBe(false);
    expect(isBudgetOptOut({ someOtherTag: "No" })).toBe(false);
  });

  it("carries the CRM's exact consent field and wording", () => {
    expect(SMS_CONSENT.tag).toBe("K6hRBtIufgEo0ZuJfDPD");
    expect(SMS_CONSENT.label).toBe(
      "I agree to receive text messages at this number. We will only use this number for text communication regarding this application.",
    );
  });
});
