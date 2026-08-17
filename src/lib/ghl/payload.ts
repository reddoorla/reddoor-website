import { GHL_DEFAULT_PARAMS } from "./constants";

/**
 * Pure builders for the GHL submission body. Everything time- or
 * environment-dependent (clock, uuid, location/document globals) is injected so
 * the exact JSON the widget contract expects can be pinned in tests.
 */

/** What the browser knows about the page the submission came from. */
export type GhlPageContext = {
  /** location.href */
  url: string;
  /** document.title */
  title: string;
  /** document.referrer ("" when none) */
  referrer: string;
  /** location.hostname */
  hostname: string;
  /** location.search ("" or "?a=b") */
  search: string;
};

export type GhlSubmissionInput = {
  kind: "form" | "survey";
  /** Form id or survey id, per kind. */
  id: string;
  locationId: string;
  /** Field values keyed by GHL field tag (email, full_name, phone, question tags…). */
  fields: Record<string, string | string[]>;
  /** The industry page's uid — becomes the default utm_campaign. */
  campaign: string;
  page: GhlPageContext;
  /** Date.now() at submit. */
  now: number;
  /** A fresh uuid for fbEventId (event de-duplication on their side). */
  fbEventId: string;
  /** Seconds between the modal opening and this submission. */
  timeSpentSeconds: number;
  /** IANA timezone, e.g. "America/Los_Angeles". */
  timezone: string;
};

/**
 * `eventData.url_params` is what GHL records as the contact's attribution — the
 * whole reason this flow tags its own submissions. Real params from the
 * visitor's URL win; ours only fill what's absent, so an ad click's utm_source
 * survives while a direct visit still says it came from this site.
 */
export function attributionParams(search: string, campaign: string): Record<string, string> {
  const actual: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(search)) actual[k] = v;
  return { ...GHL_DEFAULT_PARAMS, utm_campaign: campaign, ...actual };
}

/**
 * The `formData` JSON part of the multipart body. Mirrors what the hosted
 * widget assembles for a submit (see constants.ts for provenance); keys the
 * widget only sets conditionally (payment, sticky-contact ids…) are omitted
 * rather than guessed.
 */
export function buildGhlFormData(input: GhlSubmissionInput): Record<string, unknown> {
  const params = attributionParams(input.page.search, input.campaign);
  return {
    ...input.fields,
    formId: input.id,
    location_id: input.locationId,
    ...(input.kind === "survey" ? { surveyId: input.id } : {}),
    eventData: {
      source: input.page.referrer ? "Referral" : "Direct traffic",
      referrer: input.page.referrer,
      keyword: "",
      adSource: "",
      url_params: params,
      page: { url: input.page.url, title: input.page.title },
      timestamp: input.now,
      campaign: params.utm_campaign,
      contactSessionIds: null,
      type: "page-visit",
      domain: input.page.hostname,
      version: "v3",
      parentName: "",
      fingerprint: null,
      documentURL: input.page.url,
      fbEventId: input.fbEventId,
      medium: input.kind,
      mediumId: input.id,
    },
    Timezone: input.timezone,
    timeSpent: input.timeSpentSeconds,
  };
}

/**
 * US-centric phone normalization to the +1XXXXXXXXXX shape the CRM stores (its
 * own widget runs intl-tel-input; we cover the market this funnel targets).
 * Anything that doesn't look like a ten-digit US number passes through trimmed
 * — a mangled guess is worse than the visitor's own formatting.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  // An explicit non-US country code (a leading + whose digits don't start with
  // the US "1") is left exactly as given — otherwise a ten-digit international
  // number like "+351 12 345 678" would get a bogus +1 stamped on the front.
  if (trimmed.startsWith("+") && !digits.startsWith("1")) return trimmed;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}
