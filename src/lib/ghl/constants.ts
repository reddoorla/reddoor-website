/**
 * GoHighLevel (LeadConnector) wiring for the industry inquiry flow.
 *
 * The CRM behind links.reddoorla.com. Sync runs SERVER-SIDE through the official
 * API (see client.ts) using a location-level Private Integration Token; the
 * browser no longer talks to the CRM at all.
 *
 * This replaced a browser fire at the hosted widget's internal endpoint. That
 * path was never a supported interface and, on the evidence, never delivered:
 * an audit of the location on 2026-08-18 found a single form submission on
 * record (a jsfiddle test of the raw embed) and nothing from this site.
 */

/** The sub-account every call is scoped to. */
export const GHL_LOCATION_ID = "nluRF7uH234gl3PdTBVD";

/** "A-101-2. Application Step 1" — the email-capture form. */
export const DEFAULT_INQUIRY_FORM_ID = "MgcBOjbMGpQByfbVnUe7";
/** "Inquiry Form" — the five-question application survey. */
export const DEFAULT_INQUIRY_SURVEY_ID = "VfiN5rugWcATPw47P20U";

/**
 * The contact `source` a real widget submission writes, copied verbatim so this
 * flow's leads group with the embed's in the CRM's own source reporting.
 * The trailing space is the CRM's, not a typo — it is part of the form's name.
 */
export const INQUIRY_FORM_NAME = "A-101-2. Application Step 1 ";

/**
 * The pipeline a completed application opens an opportunity in, and the stage
 * it starts at. Read from the CRM 2026-08-18.
 *
 * Creating this ourselves is a STOPGAP. In the template the opportunity is a
 * workflow action inside "A-102-2. New Inquiry Submitted" — but that workflow is
 * unfinished, so nothing reaches the pipeline and the one deliberate human step
 * in the whole process (reviewing a lead in Scheduled Appointment and approving
 * or rejecting it) has no surface to happen on. We create it guarded by a lookup
 * so that finishing A-102-2 later cannot produce duplicates.
 */
export const GHL_PIPELINE_ID = "WAOZ0z0Po1E5eePUMjWd";
/** "1. New Inquiry" — the first stage of "01. Sales Pipeline". */
export const GHL_STAGE_NEW_INQUIRY = "d4d833e0-6663-456a-8c01-4c0be26625c8";

/**
 * Process-state tags. These are the CRM's own vocabulary, and in the template
 * they are applied BY the A-102 workflows rather than being what starts them —
 * so applying them does not currently trigger anything. They are written anyway
 * so the contact record carries correct state for the pipeline and for whoever
 * reads it by hand, and so the chain lights up the moment a Contact-Tag-Added
 * trigger is added to A-102-1/A-102-2. Tags are ADDED (never sent on upsert,
 * which would overwrite the whole array).
 */
export const TAG_APPLICATION_STARTED = "application started";
export const TAG_APPLICATION_COMPLETED = "application completed";

/**
 * Attribution custom fields, by field id. The template ships these, which is
 * where utm data belongs — `attributionSource` is read-only on the API, so the
 * values GHL would normally derive from its own tracking have to be written
 * here explicitly or they are lost.
 */
export const GHL_ATTRIBUTION_FIELDS = {
  /** contact.utm_source */
  utm_source: "0IUZyt1voFzbwN6wzEkE",
  /** contact.utm_medium */
  utm_medium: "crVdbGgZZtPu9RGXm5zh",
  /** contact.utm_campaign */
  utm_campaign: "9cpTB290UIOnrKtAlBfE",
  /** contact.utm_content */
  utm_content: "5EDQLTB4hjyWWdPDCzpU",
  /** contact.lead_source */
  lead_source: "6kweGxbWRwBR2LV508jv",
  /** contact.funnel */
  funnel: "NlnuKejf3ThqsfBVvMgU",
} as const;

/** What we report as `lead_source` — the site, distinct from any ad utm_source. */
export const LEAD_SOURCE = "reddoorla.com";

/**
 * "Schedule an intro call with Reddoor Creative" — the only calendar on the
 * account. Round-robin with one member (Tim), 30-minute slots on a 30-minute
 * interval, Mon–Fri 09:00–17:00 in the LOCATION timezone, a five-day booking
 * window, no minimum notice, auto-confirmed, meeting held over Zoom.
 *
 * Note the location timezone is America/Boise, so those hours are Mountain —
 * 8am–4pm Pacific. Possibly deliberate (the team spans San Antonio, LA and
 * Boise); either way slots must be rendered in the VISITOR's timezone with the
 * zone named, never as the raw offset the API returns.
 */
export const GHL_CALENDAR_ID = "kNRHivTnovXd07knBgu1";

/** Process-state tag for a booked intro call. */
export const TAG_SCHEDULED_A_CALL = "scheduled a call";
