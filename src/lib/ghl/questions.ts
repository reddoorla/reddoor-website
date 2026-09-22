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
    // The yes/no rewrite Erik first floated on 2026-08-20 landed on 2026-08-24:
    // Tim asked for a $10,000+ gate, Erik supplied this wording. A "No" is a
    // self-opt-out — the modal routes it to /not-a-fit instead of /schedule and
    // the CRM sync marks it (see BUDGET_GATE below). The CRM field is
    // "Inquiry - Expects $10k+ Budget" (renamed with the same edit).
    heading:
      "Would you expect to pay $10,000+ to diagnose the problem and rebrand your business if needed?",
    options: ["Yes", "No"],
  },
];

/**
 * The /digital question set.
 *
 * Keyed by a string this repo owns rather than a GHL survey id: no survey
 * exists for these questions and none is needed — nothing has submitted to a
 * GHL survey since the widget path died (2026-08-18), and the answers land as
 * contact custom fields either way.
 *
 * Fields created 2026-09-17 by scripts/crm/create-digital-fields.mjs and read
 * back by id before they were written here. Option strings are the CRM's
 * stored picklist values; a change starts in GHL, never here.
 */
export const DIGITAL_QUESTION_SET_ID = "digital";

const DIGITAL_FIELDS = {
  needs: "6ADqYeIoiuoZYjNOVe65",
  goal: "LF7fDBprx9TnmuuE0r3Z",
  stakeholders: "hFMs3VYZALF59mloih9F",
  budget: "2gNEfoXr5XwltWMFhaxS",
} as const;

const DIGITAL_QUESTIONS: readonly InquiryQuestion[] = [
  {
    kind: "checkbox",
    tag: DIGITAL_FIELDS.needs,
    heading: "What do you need help with?",
    options: [
      "A new website",
      "Redesigning our current website",
      "Showing up in Google and AI search",
      "Keeping our site updated",
      "Not sure yet",
    ],
  },
  {
    kind: "text",
    tag: "website",
    // Every question in the wizard is skippable (nextQuestion advances without
    // validating), which matters most here: a startup asking for its first
    // site has nothing to type, and an empty answer is dropped by
    // partitionAnswers rather than written blank.
    heading: "Where can we see your current website?",
    placeholder: "https://yourwebsite.com",
    inputType: "url",
  },
  {
    kind: "radio",
    tag: DIGITAL_FIELDS.goal,
    heading: "What's the main job your website needs to do?",
    options: [
      "Bring in leads and calls",
      "Sell online",
      "Make us look credible",
      "Support hiring",
      "Other",
    ],
  },
  {
    kind: "radio",
    tag: DIGITAL_FIELDS.stakeholders,
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
    tag: DIGITAL_FIELDS.budget,
    // PLACEHOLDER RANGES pending Tim (see the spec's §2). The page's pricing
    // FAQ carries the same numbers and moves with them.
    heading: "What's your budget for this project?",
    options: ["Under $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+", "Not sure yet"],
  },
];

/**
 * The budget gate: the one answer that reroutes the flow. A visitor answering
 * "No" has self-opted out — per Tim (2026-08-24) they land on the official
 * not-a-fit page rather than the scheduler, and the CRM record is tagged so a
 * workflow can exclude them from the booking chase.
 *
 * The literal "No" is the CRM's stored picklist value, pinned like every other
 * option string here.
 */
export const BUDGET_GATE = { tag: "xW6eFrHUFBNQCijp1mOM", optOut: "No" } as const;

/** True only for the gate's exact stored opt-out value — a radio submits a
 *  plain string, so an array shape is a forgery, not an answer. */
export function isBudgetOptOut(answers: Record<string, string | string[]>): boolean {
  return answers[BUDGET_GATE.tag] === BUDGET_GATE.optOut;
}

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
 * Question set for a key, or undefined for a key this build has no
 * transcription of. The caller treats undefined as "no wizard": step one still
 * captures the email, the visitor gets the thank-you, and nothing submits
 * answers a different set would misfile.
 *
 * Keys are whatever an industry document's `inquiry_survey_id` holds — the
 * A-101 GHL survey id for the brand funnel, `digital` for the web funnel.
 */
const QUESTION_SETS: Record<string, readonly InquiryQuestion[]> = {
  [DEFAULT_INQUIRY_SURVEY_ID]: A101_QUESTIONS,
  [DIGITAL_QUESTION_SET_ID]: DIGITAL_QUESTIONS,
};

export function questionsFor(surveyId: string): readonly InquiryQuestion[] | undefined {
  return QUESTION_SETS[surveyId];
}
