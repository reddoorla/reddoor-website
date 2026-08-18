import {
  GHL_ATTRIBUTION_FIELDS,
  GHL_LOCATION_ID,
  GHL_PIPELINE_ID,
  GHL_STAGE_NEW_INQUIRY,
  INQUIRY_FORM_NAME,
  LEAD_SOURCE,
  TAG_APPLICATION_COMPLETED,
  TAG_APPLICATION_STARTED,
} from "./constants";
import { normalizePhone } from "./phone";
import { questionsFor, SMS_CONSENT } from "./questions";

/**
 * Server-side CRM sync over LeadConnector's OFFICIAL API, replacing the
 * browser's fire-and-forget POST at the hosted widget's internal endpoint.
 *
 * Why the rewrite: the widget contract was never a supported interface, and the
 * evidence says it never delivered. Auditing the location on 2026-08-18 found
 * exactly ONE form submission on record — a jsfiddle test of the raw embed —
 * and nothing at all from this site, which is what the Cloudflare bot gate in
 * the old module's header comment predicted. The widget body also carries a
 * `signatureHash` (a CryptoJS "Salted__" blob keyed inside their bundle) that we
 * cannot reproduce and they can rotate at will.
 *
 * What this module targets instead is the OBSERVED EFFECT of a real widget
 * submission on the contact record, read back from the API:
 *
 *   source                = the form's name ("A-101-2. Application Step 1 ")
 *   type                  = "lead"        (derived by the CRM, not settable)
 *   customFields          = the 5 answers + SMS consent, keyed by field id
 *   website               = a STANDARD contact field, NOT a custom field
 *   dnd                   = untouched     (consent is only a custom-field value)
 *   attributionSource     = set by their tracking pipeline — READ-ONLY to us
 *
 * That last line is the one thing the API cannot do: `UpsertContactDto` has no
 * attribution property. The template ships utm_* / lead_source / funnel as real
 * contact fields, so that is where attribution goes instead of being dropped —
 * plus a human-readable note for whoever reads the record before a call.
 *
 * Two things go BEYOND the embed's effect, deliberately:
 *
 *   tags         the CRM's own process vocabulary, written so the record reads
 *                correctly and so the A-102 chain fires the moment a
 *                Contact-Tag-Added trigger is added to it.
 *   opportunity  a guarded stopgap while A-102-2 (which would normally open it)
 *                is unfinished — without one, the sales review has no surface.
 *
 * Token: a location-level Private Integration Token with `contacts.write`
 * (verified granted 2026-08-18). Injected rather than read from env here so the
 * unit tests need no env mocking, matching how submitToIngest is wired.
 */

const API = "https://services.leadconnectorhq.com";
/** LeadConnector pins behaviour to a dated version header; not optional. */
const API_VERSION = "2021-07-28";
/** The CRM sits behind the lead's own request, so it may never hang it. */
const TIMEOUT_MS = 6000;

export type CrmFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type CrmResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** A custom-field write, in the {id, value} shape the API takes. */
export type CrmCustomField = { id: string; value: string | string[] };

/**
 * `website` is the survey's one question whose tag names a STANDARD contact
 * field rather than a custom field — confirmed by reading a widget-created
 * contact, where every other answer appeared under customFields and this one
 * did not. Writing it into customFields would create a phantom field id.
 */
const STANDARD_FIELD_TAGS = new Set(["website"]);

/**
 * The custom-field ids this server is willing to write, for a given survey.
 *
 * A whitelist because the answer map arrives from the browser: without it a
 * forged payload could write ANY custom field on the contact — including ones
 * belonging to unrelated pipelines. The server decides what is writable, never
 * the client. A survey this code has no transcription of yields an empty set,
 * so its answers are dropped rather than guessed at.
 *
 * The SMS-consent field is deliberately NOT here. It is a compliance record, so
 * it is written from the request's own boolean using the CRM's exact stored
 * sentence (see syncApplicationToCrm) rather than from a string the browser
 * supplied — a client must not be able to assert consent on a visitor's behalf.
 */
export function writableFieldIds(surveyId: string): Set<string> {
  const questions = questionsFor(surveyId);
  if (!questions) return new Set();
  return new Set(questions.filter((q) => !STANDARD_FIELD_TAGS.has(q.tag)).map((q) => q.tag));
}

/**
 * Split a tag-keyed answer map into the API's customFields array plus the
 * standard-field values that must ride at the top level of the body. Unknown
 * tags are discarded silently — they are either a bot's invention or a survey
 * this build predates, and neither should reach the CRM.
 */
export function partitionAnswers(
  raw: Record<string, string | string[]>,
  writable: Set<string>,
): { customFields: CrmCustomField[]; standard: Record<string, string> } {
  const customFields: CrmCustomField[] = [];
  const standard: Record<string, string> = {};
  for (const [tag, value] of Object.entries(raw)) {
    // Empty answers are omitted rather than sent blank, matching how the
    // widget skips fields the visitor left alone.
    const empty = Array.isArray(value) ? value.length === 0 : value.trim() === "";
    if (empty) continue;
    if (STANDARD_FIELD_TAGS.has(tag)) {
      if (!Array.isArray(value)) standard[tag] = value.trim();
      continue;
    }
    if (writable.has(tag)) customFields.push({ id: tag, value });
  }
  return { customFields, standard };
}

/**
 * The attribution the API refuses to store, rendered for a contact note.
 * Deliberately human-shaped: this is read by a salesperson in the CRM, not
 * parsed. utm_* params come from the landing URL the browser reported.
 */
export function attributionLines(sourceUrl: string, referrer: string): string[] {
  const lines: string[] = [];
  let params: URLSearchParams | undefined;
  try {
    params = new URL(sourceUrl).searchParams;
  } catch {
    /* a malformed sourceUrl just means no params to report */
  }
  lines.push(`Landing page: ${sourceUrl || "(unknown)"}`);
  if (referrer) lines.push(`Referrer: ${referrer}`);
  const utm = [...(params ?? [])].filter(([k]) => /^(utm_|gclid|fbclid|gbraid|wbraid)/.test(k));
  if (utm.length) lines.push(...utm.map(([k, v]) => `${k}: ${v}`));
  return lines;
}

/**
 * Attribution as custom-field writes. The template ships utm_* / lead_source /
 * funnel as real contact fields, which is the only place this data can live:
 * `attributionSource` is read-only on the API, so what GHL would normally derive
 * from its own tracking pipeline has to be written explicitly or it is lost.
 *
 * A param the visitor actually arrived with always wins; `campaign` only fills
 * utm_campaign when the URL carried none, so an ad click's own campaign is never
 * overwritten by the page's uid.
 */
export function attributionFields(sourceUrl: string, campaign: string): CrmCustomField[] {
  let params: URLSearchParams | undefined;
  try {
    params = new URL(sourceUrl).searchParams;
  } catch {
    /* a malformed sourceUrl just means no params to read */
  }
  const value = (key: string) => params?.get(key)?.trim() || "";
  const resolved: Record<keyof typeof GHL_ATTRIBUTION_FIELDS, string> = {
    utm_source: value("utm_source"),
    utm_medium: value("utm_medium"),
    utm_campaign: value("utm_campaign") || campaign,
    utm_content: value("utm_content"),
    lead_source: LEAD_SOURCE,
    funnel: campaign,
  };
  return (
    Object.entries(resolved)
      // Empty values are omitted rather than blanking a field the CRM already has
      // — step two must not wipe attribution step one recorded.
      .filter(([, v]) => v !== "")
      .map(([key, v]) => ({
        id: GHL_ATTRIBUTION_FIELDS[key as keyof typeof GHL_ATTRIBUTION_FIELDS],
        value: v,
      }))
  );
}

/**
 * One authenticated call to the CRM, shared by every helper here and in
 * booking.ts. Never throws: a transport failure comes back as status 0 so the
 * caller can tell "never got an answer" from a real HTTP rejection.
 */
export async function crmCall<T>(
  opts: { token: string; fetch: CrmFetch },
  path: string,
  init: RequestInit,
  pick: (json: Record<string, unknown>) => T,
): Promise<CrmResult<T>> {
  try {
    const res = await opts.fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Version: API_VERSION,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // The API returns `message` as a string OR an array of validation strings.
      const m = json.message;
      const error = Array.isArray(m) ? m.join("; ") : String(m ?? res.statusText);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, data: pick(json) };
  } catch (err) {
    // Timeout, DNS, TLS. Status 0 marks "never got an answer" apart from a real
    // HTTP failure, so the caller can log the two differently.
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Upsert a contact by email. Dedupe follows the location's own "Allow Duplicate
 * Contact" setting, so step two lands on the same record step one created —
 * which is exactly how the form/survey pair behaves in the CRM today.
 */
export async function upsertCrmContact(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
  /** Full name; the CRM splits it into first/last as the widget's does. */
  name?: string;
  phone?: string;
  /** Only on the FIRST touch — see syncApplicationToCrm for why. */
  source?: string;
  customFields?: CrmCustomField[];
  /** Standard-field values (currently just `website`). */
  standard?: Record<string, string>;
}): Promise<CrmResult<{ contactId: string; isNew: boolean }>> {
  const body: Record<string, unknown> = {
    locationId: GHL_LOCATION_ID,
    email: opts.email,
    ...(opts.name ? { name: opts.name } : {}),
    ...(opts.phone ? { phone: normalizePhone(opts.phone) } : {}),
    ...(opts.source ? { source: opts.source } : {}),
    ...(opts.customFields?.length ? { customFields: opts.customFields } : {}),
    ...(opts.standard ?? {}),
  };
  // NOTE: `tags` is deliberately never sent. The API documents it as
  // "will overwrite all current tags associated with the contact", so passing it
  // on the second touch would wipe any tag a CRM workflow added between the two
  // submissions. The embed applies no tags anyway; if we ever need one, it goes
  // through POST /contacts/{id}/tags, which adds instead of replacing.
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/contacts/upsert",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    (json) => {
      const c = (json.contact ?? {}) as Record<string, unknown>;
      return { contactId: String(c.id ?? ""), isNew: c.new === true };
    },
  );
}

/** Attach a note to a contact. Covered by contacts.write — no extra scope. */
export async function addCrmNote(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  body: string;
}): Promise<CrmResult<{ noteId: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/contacts/${encodeURIComponent(opts.contactId)}/notes`,
    { method: "POST", body: JSON.stringify({ body: opts.body }) },
    (json) => {
      const n = (json.note ?? {}) as Record<string, unknown>;
      return { noteId: String(n.id ?? "") };
    },
  );
}

/**
 * Add tags WITHOUT clobbering. The upsert body's `tags` property replaces the
 * entire array, so process state is applied through this endpoint instead —
 * it appends, leaving anything a workflow added intact.
 */
export async function addCrmTags(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  tags: string[];
}): Promise<CrmResult<{ tags: string[] }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/contacts/${encodeURIComponent(opts.contactId)}/tags`,
    { method: "POST", body: JSON.stringify({ tags: opts.tags }) },
    (json) => ({ tags: (json.tags as string[]) ?? [] }),
  );
}

/**
 * Open a pipeline opportunity for a completed application — but only if the
 * contact has none.
 *
 * The guard is the whole point. In the template this is a workflow action inside
 * A-102-2, which is currently unfinished; creating it here gives the sales
 * review an actual surface to happen on. When A-102-2 is finished it will do the
 * same thing, and the lookup is what stops the two from racing into duplicates.
 *
 * A failed LOOKUP is treated as "do not create". Creating on an unknown state
 * risks a duplicate in someone's live pipeline; skipping only risks a missing
 * card, which a human can add. The cheaper mistake wins.
 */
export async function ensureCrmOpportunity(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  /** Shown as the opportunity name — the person, falling back to their email. */
  name: string;
}): Promise<CrmResult<{ opportunityId: string; created: boolean }>> {
  const existing = await crmCall<number>(
    { token: opts.token, fetch: opts.fetch },
    `/opportunities/search?location_id=${GHL_LOCATION_ID}&contact_id=${encodeURIComponent(opts.contactId)}`,
    { method: "GET" },
    (json) => {
      const list = (json.opportunities as unknown[]) ?? [];
      const meta = json.meta as { total?: number } | undefined;
      return meta?.total ?? list.length;
    },
  );
  if (!existing.ok) return existing;
  if (existing.data > 0) return { ok: true, data: { opportunityId: "", created: false } };

  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/opportunities/",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        pipelineId: GHL_PIPELINE_ID,
        pipelineStageId: GHL_STAGE_NEW_INQUIRY,
        contactId: opts.contactId,
        name: opts.name,
        // "open" is the CRM's short-term-follow-up state. Their other statuses
        // carry specific meaning a human assigns later: `abandoned` for a good
        // fit on a long horizon, `lost` for dead, `won` for cash collected.
        status: "open",
      }),
    },
    (json) => {
      const o = (json.opportunity ?? {}) as Record<string, unknown>;
      return { opportunityId: String(o.id ?? ""), created: true };
    },
  );
}

/**
 * Step one — the email capture. Mirrors the embed's first touch: a contact whose
 * `source` is the form's name. `source` is set HERE and only here, because the
 * CRM keeps the first-touch label and the survey submission does not overwrite
 * it — so the second touch must leave it alone.
 *
 * Attribution rides on this first write because it is the only touch guaranteed
 * to see the visitor's original landing URL with its utm params intact.
 */
export async function syncInquiryToCrm(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
  /** The industry page's uid — utm_campaign fallback and the `funnel` value. */
  campaign: string;
  /** location.href at submit, carrying whatever utm params the visitor arrived with. */
  sourceUrl: string;
}): Promise<CrmResult<{ contactId: string; isNew: boolean; taggedOk: boolean }>> {
  const contact = await upsertCrmContact({
    token: opts.token,
    fetch: opts.fetch,
    email: opts.email,
    source: INQUIRY_FORM_NAME,
    customFields: attributionFields(opts.sourceUrl, opts.campaign),
  });
  if (!contact.ok) return contact;

  // Best-effort from here: the lead is already recorded, so a failed tag is
  // logged rather than surfaced as a failure to the visitor.
  const tagged = await addCrmTags({
    token: opts.token,
    fetch: opts.fetch,
    contactId: contact.data.contactId,
    tags: [TAG_APPLICATION_STARTED],
  });
  return { ok: true, data: { ...contact.data, taggedOk: tagged.ok } };
}

/**
 * Step two — the completed application. Writes the answers as custom fields,
 * marks the process state, opens a pipeline opportunity if none exists, and
 * appends a readable transcript for whoever takes the call.
 *
 * Everything after the contact upsert is best-effort: the answers are already
 * safe on the record by then, so a failed tag, opportunity or note is reported
 * for logging rather than surfaced to the visitor.
 */
export async function syncApplicationToCrm(opts: {
  token: string;
  fetch: CrmFetch;
  surveyId: string;
  email: string;
  name: string;
  phone: string;
  /** Answers keyed by CRM field id, as the wizard collected them. */
  fields: Record<string, string | string[]>;
  /** Whether the visitor ticked the required SMS-consent box. */
  smsConsent: boolean;
  /** Already-composed human transcript (the same text ingest receives). */
  transcript: string;
  sourceUrl: string;
  referrer: string;
  /** The industry page's uid — utm_campaign fallback and the `funnel` value. */
  campaign: string;
}): Promise<
  CrmResult<{
    contactId: string;
    isNew: boolean;
    taggedOk: boolean;
    opportunityOk: boolean;
    noteOk: boolean;
  }>
> {
  const { customFields, standard } = partitionAnswers(opts.fields, writableFieldIds(opts.surveyId));
  // Consent is written from THIS request's boolean using the CRM's exact stored
  // sentence, in the one-element array shape a real widget submission produces.
  // Deliberately not sourced from the answer map: a browser must not be able to
  // put words in a visitor's mouth on a compliance field.
  if (opts.smsConsent) {
    customFields.push({ id: SMS_CONSENT.tag, value: [SMS_CONSENT.label] });
  }
  // Re-asserted on the second touch so a visitor who reopened the modal on a
  // fresh URL still lands attribution. attributionFields drops empties, so this
  // can only add to what step one recorded — it can never blank it.
  customFields.push(...attributionFields(opts.sourceUrl, opts.campaign));

  const contact = await upsertCrmContact({
    token: opts.token,
    fetch: opts.fetch,
    email: opts.email,
    name: opts.name,
    phone: opts.phone,
    customFields,
    standard,
  });
  if (!contact.ok) return contact;
  const { token, fetch: f } = opts;
  const contactId = contact.data.contactId;

  const tagged = await addCrmTags({
    token,
    fetch: f,
    contactId,
    tags: [TAG_APPLICATION_COMPLETED],
  });
  const opportunity = await ensureCrmOpportunity({
    token,
    fetch: f,
    contactId,
    name: opts.name.trim() || opts.email,
  });
  const note = await addCrmNote({
    token,
    fetch: f,
    contactId,
    body: [opts.transcript, "", ...attributionLines(opts.sourceUrl, opts.referrer)].join("\n"),
  });

  return {
    ok: true,
    data: {
      ...contact.data,
      taggedOk: tagged.ok,
      opportunityOk: opportunity.ok,
      noteOk: note.ok,
    },
  };
}
