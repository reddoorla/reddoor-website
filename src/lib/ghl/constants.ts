/**
 * GoHighLevel (LeadConnector) wiring for the industry inquiry flow.
 *
 * The CRM behind links.reddoorla.com. There is no supported public API for
 * anonymous form submission, so the flow speaks the same internal contract the
 * hosted widgets speak: `POST {endpoint}?formId=&locationId=` as
 * multipart/form-data with a `formData` JSON part (field values keyed by the
 * widget's field tags + an `eventData` attribution envelope), `locationId`,
 * `formId`/`surveyId`, and a Cloudflare Turnstile token. Extracted from the
 * widget bundles at stcdn.leadconnectorhq.com (2026-08-17); if submissions stop
 * arriving in the CRM, diff the live bundle's submit path against payload.ts
 * before suspecting this code.
 *
 * Delivery is best-effort BY DESIGN: the endpoint sits behind Cloudflare bot
 * management and never exposes CORS read access to this origin, so the browser
 * can send but not read the outcome. The lead itself is never entrusted to it —
 * /api/inquiry forwards every submission to central ingest first, and the GHL
 * fire is the CRM sync on top.
 */

export const GHL_LOCATION_ID = "nluRF7uH234gl3PdTBVD";

export const GHL_FORMS_ENDPOINT = "https://backend.leadconnectorhq.com/forms/submit";
export const GHL_SURVEYS_ENDPOINT = "https://backend.leadconnectorhq.com/surveys/submit";

/** "A-101-2. Application Step 1" — the email-capture form. */
export const DEFAULT_INQUIRY_FORM_ID = "MgcBOjbMGpQByfbVnUe7";
/** "Inquiry Form" — the five-question application survey. */
export const DEFAULT_INQUIRY_SURVEY_ID = "VfiN5rugWcATPw47P20U";

/**
 * GHL's own invisible-Turnstile sitekey, read from the widget config. Their key
 * rather than ours because the token is verified against GHL's secret — a token
 * minted under PUBLIC_TURNSTILE_SITE_KEY is meaningless to their verifier.
 */
export const GHL_TURNSTILE_SITE_KEY = "0x4AAAAAACCpVlau-4k7cJ33";

/**
 * Attribution defaults for `eventData.url_params`. Fill-in only — a visitor who
 * arrived carrying real utm_* params keeps them (an ad click's utm_source must
 * not be overwritten by ours).
 */
export const GHL_DEFAULT_PARAMS = {
  utm_source: "reddoorla-website",
  utm_medium: "industry-lp",
} as const;
