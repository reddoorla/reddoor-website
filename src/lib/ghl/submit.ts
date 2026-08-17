import {
  GHL_FORMS_ENDPOINT,
  GHL_SURVEYS_ENDPOINT,
  GHL_LOCATION_ID,
  DEFAULT_INQUIRY_FORM_ID,
  DEFAULT_INQUIRY_SURVEY_ID,
} from "./constants";
import { buildGhlFormData, normalizePhone, type GhlPageContext } from "./payload";
import type { InquiryAnswers } from "./questions";
import { SMS_CONSENT } from "./questions";

/**
 * Fire a submission at the CRM. Fire-and-forget on purpose:
 *
 * - `mode: "no-cors"` because the endpoint never grants this origin CORS read
 *   access — a normal fetch REJECTS even when the request lands, which would
 *   read as failure for every successful delivery. Opaque mode sends without
 *   pretending we can know the outcome.
 * - `keepalive` so a fire racing a navigation (visitor submits and closes) is
 *   still handed to the network layer. Bodies here are a few KB, well under
 *   keepalive's 64KB cap.
 * - Never throws and nothing awaits it: the lead is already safe in central
 *   ingest by the time this runs. If the CRM's bot gate eats the request, the
 *   dashboard still has the submission.
 */
export function fireGhlSubmission(opts: {
  kind: "form" | "survey";
  id: string;
  formData: Record<string, unknown>;
  token: string | undefined;
}): void {
  const endpoint = opts.kind === "form" ? GHL_FORMS_ENDPOINT : GHL_SURVEYS_ENDPOINT;
  const param = opts.kind === "form" ? "formId" : "surveyId";
  const body = new FormData();
  body.set("formData", JSON.stringify(opts.formData));
  body.append("locationId", GHL_LOCATION_ID);
  body.append(param, opts.id);
  if (opts.token) body.append("turnstileNonInteractiveToken", opts.token);

  // The id is CMS-authored (the Inquiry tab), so encode it rather than trust it
  // to be query-safe — a stray & or space would otherwise corrupt the URL.
  fetch(
    `${endpoint}?${param}=${encodeURIComponent(opts.id)}&locationId=${encodeURIComponent(GHL_LOCATION_ID)}`,
    {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      body,
    },
  ).catch((err) => {
    // Network-level refusal (offline, CSP, hard block). Logged for triage;
    // the ingest copy of this lead already exists.
    console.warn(`[ghl] ${opts.kind} fire failed:`, err);
  });
}

/**
 * Snapshot the page's attribution context. The caller MUST invoke this at
 * submit time, not inside the token-resolution callback — a token can take up
 * to a couple of seconds, and an SPA navigation in that window would otherwise
 * attribute the fire to whatever page the visitor moved to.
 */
export function capturePageContext(): GhlPageContext {
  return {
    url: location.href,
    title: document.title,
    referrer: document.referrer,
    hostname: location.hostname,
    search: location.search,
  };
}

function fbEventId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

/**
 * Step one: the email-capture form ("Lead" event in the CRM). `page` and
 * `campaign` are passed in (not read here) because this runs inside the token
 * callback, after submit — see capturePageContext.
 */
export function fireInquiryForm(opts: {
  formId?: string;
  email: string;
  campaign: string;
  page: GhlPageContext;
  openedAt: number;
  token: string | undefined;
}): void {
  const now = Date.now();
  fireGhlSubmission({
    kind: "form",
    id: opts.formId || DEFAULT_INQUIRY_FORM_ID,
    token: opts.token,
    formData: buildGhlFormData({
      kind: "form",
      id: opts.formId || DEFAULT_INQUIRY_FORM_ID,
      locationId: GHL_LOCATION_ID,
      fields: { email: opts.email },
      campaign: opts.campaign,
      page: opts.page,
      now,
      fbEventId: fbEventId(),
      timeSpentSeconds: Math.max(0, (now - opts.openedAt) / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    }),
  });
}

/**
 * The completed application: answers + contact details ("SubmitApplication").
 * `page`/`campaign` are snapshotted by the caller at submit time.
 */
export function fireInquirySurvey(opts: {
  surveyId?: string;
  email: string;
  fullName: string;
  phone: string;
  answers: InquiryAnswers;
  campaign: string;
  page: GhlPageContext;
  openedAt: number;
  token: string | undefined;
}): void {
  const now = Date.now();
  const id = opts.surveyId || DEFAULT_INQUIRY_SURVEY_ID;
  fireGhlSubmission({
    kind: "survey",
    id,
    token: opts.token,
    formData: buildGhlFormData({
      kind: "survey",
      id,
      locationId: GHL_LOCATION_ID,
      fields: {
        ...opts.answers,
        full_name: opts.fullName,
        email: opts.email,
        phone: normalizePhone(opts.phone),
        // Required consent checkbox — checkbox values submit as arrays of the
        // selected option strings, a one-element array here.
        [SMS_CONSENT.tag]: [SMS_CONSENT.label],
      },
      campaign: opts.campaign,
      page: opts.page,
      now,
      fbEventId: fbEventId(),
      timeSpentSeconds: Math.max(0, (now - opts.openedAt) / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    }),
  });
}
