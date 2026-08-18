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
