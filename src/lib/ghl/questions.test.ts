import { describe, expect, it } from "vitest";
import {
  questionsFor,
  SMS_CONSENT,
  BUDGET_GATE,
  isBudgetOptOut,
  DIGITAL_QUESTION_SET_ID,
} from "./questions";
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

describe("the digital question set", () => {
  const questions = questionsFor(DIGITAL_QUESTION_SET_ID)!;

  it("resolves under its own key and leaves unknown keys undefined", () => {
    expect(questions).toBeDefined();
    expect(questionsFor("not-a-set")).toBeUndefined();
  });

  it("is five questions in slide order, website second", () => {
    expect(questions).toHaveLength(5);
    expect(questions.map((q) => q.kind)).toEqual(["checkbox", "text", "radio", "radio", "radio"]);
    expect(questions[1].tag).toBe("website");
  });

  it("writes only real CRM field ids", () => {
    // Every tag is either the standard `website` field or a 20-char GHL id.
    for (const q of questions) {
      if (q.tag === "website") continue;
      expect(q.tag).toMatch(/^[A-Za-z0-9]{20}$/);
    }
  });

  it("shares no custom field with the medtech set", () => {
    const a101 = questionsFor(DEFAULT_INQUIRY_SURVEY_ID)!.map((q) => q.tag);
    const shared = questions.map((q) => q.tag).filter((t) => a101.includes(t));
    // `website` is a standard contact field and is deliberately shared; a
    // shared CUSTOM field would mix two funnels' picklists in one column.
    expect(shared).toEqual(["website"]);
  });

  it("carries the budget ranges as offered, and no budget gate", () => {
    const budget = questions[4] as Extract<(typeof questions)[number], { kind: "radio" }>;
    expect(budget.options).toEqual([
      "Under $5,000",
      "$5,000 - $10,000",
      "$10,000 - $25,000",
      "$25,000+",
      "Not sure yet",
    ]);
    // The gate belongs to the medtech set. No digital answer can trip it —
    // not even one that names the gate's own opt-out string.
    expect(questions.some((q) => q.tag === BUDGET_GATE.tag)).toBe(false);
    const answered = Object.fromEntries(
      questions.map((q) => [q.tag, q.kind === "checkbox" ? ["No"] : "No"]),
    );
    expect(isBudgetOptOut(answered)).toBe(false);
  });
});
