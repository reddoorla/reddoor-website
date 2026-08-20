import { DEFAULT_INQUIRY_SURVEY_ID } from "./constants";

/**
 * The five application questions, transcribed from the GHL survey the modal
 * fronts ("Inquiry Form", VfiN5rugWcATPw47P20U).
 *
 * These live in code rather than Prismic ON PURPOSE. `tag` is the CRM field's
 * identity and every option string is the literal value the CRM stores — GHL
 * matches submitted values against its picklists byte-for-byte, so an editor
 * "fixing" a comma here would silently unmap the answer from the contact
 * record. Copy changes start in GHL (Sites → Surveys), then get mirrored here.
 * The colocated test pins these strings for the same reason.
 */

export type InquiryQuestion = {
  /** GHL field tag — the key this answer submits under. */
  tag: string;
  /** Slide heading, shown as the question. */
  heading: string;
} & (
  | { kind: "checkbox"; options: readonly string[] }
  | { kind: "radio"; options: readonly string[] }
  | { kind: "text"; placeholder: string; inputType: "url" | "text" }
);

/** One visitor's answers, keyed by question tag. */
export type InquiryAnswers = Record<string, string | string[]>;

const A101_QUESTIONS: readonly InquiryQuestion[] = [
  {
    kind: "checkbox",
    tag: "vlLzA6TsJhHkmvmf6ArR",
    heading: "What problems are you experiencing?",
    options: [
      "Bigger companies are squeezing out small and medium-sized businesses",
      "Outdated sales and marketing materials",
      "Scattered messaging with inconsistent look and feel",
      "Brand lacks the credibility that buyers expect",
      "Using DIY tools with little or no success",
      "Internal team is too busy or not capable",
    ],
  },
  {
    kind: "text",
    tag: "website",
    heading: "Where can we check out your work?",
    placeholder: "https://yourwebsite.com",
    inputType: "url",
  },
  {
    kind: "checkbox",
    tag: "K0obgvYezsY9MX088GFN",
    heading: "What are your goals for this project?",
    options: [
      "Building brand recognition and trust that converts customers",
      "Confidence to compete in new markets",
      "Marketing deliverables that do the selling for you",
      "Command instant credibility with healthcare workers",
      "Consistency across all marketing and sales presentations",
    ],
  },
  {
    kind: "radio",
    tag: "iRpYADswmWvMc0hnWtrT",
    heading: "Is there anyone else involved in this project?",
    options: [
      "Just myself",
      "My business partner",
      "My department head",
      "Our board of directors",
      "Other",
    ],
  },
  {
    kind: "radio",
    tag: "xW6eFrHUFBNQCijp1mOM",
    // Erik's 2026-08-20 notes also proposed rewriting this question into a
    // yes/no ("Do you have a budget set aside…?"). That part was not taken up:
    // asked for the full option text, he supplied wording that answers the
    // question as it already stands, so the heading is unchanged and no
    // builder edit is outstanding. The last option is his, verbatim.
    heading:
      "What would you expect to pay to rebrand a business and execute all the deliverables, if needed?",
    options: [
      "Less than $10,000",
      "$10,000 - 30,000",
      "$30,000 - 50,000",
      "$50,000 - 100,000",
      "$100,000 - 200,000",
      "I don't have a budget, and I'm unsure of how much something like this costs.",
    ],
  },
];

/**
 * The survey's final slide also demands SMS consent; its tag and the literal
 * consent string the CRM stores. Shown beside the phone field, required.
 *
 * This one is not a label. It is written to the contact as the value of the
 * SMS Consent field, so the string here IS the record of what a person agreed
 * to. Contacts who consented before 2026-08-20 hold the previous wording ("I
 * consent to receiving text messages to this number…") and keep it — a consent
 * record should say what was actually shown at the time, so nothing backfills.
 */
export const SMS_CONSENT = {
  tag: "K6hRBtIufgEo0ZuJfDPD",
  label:
    "I agree to receive text messages at this number. We will only use this number for text communication regarding this application.",
} as const;

/**
 * Question set for a survey id, or undefined for a survey this code has no
 * transcription of. The caller treats undefined as "no wizard": step one still
 * captures the email, the visitor gets the thank-you, and nothing submits
 * answers a different survey would misfile.
 */
export function questionsFor(surveyId: string): readonly InquiryQuestion[] | undefined {
  return surveyId === DEFAULT_INQUIRY_SURVEY_ID ? A101_QUESTIONS : undefined;
}
