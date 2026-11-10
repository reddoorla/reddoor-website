import { json, type Cookies } from "@sveltejs/kit";
import { submitToIngest, screenSubmission } from "@reddoorla/maintenance/forms";
import { syncInquiryToCrm, syncApplicationToCrm } from "$lib/ghl/client";
import { normalizeZone } from "$lib/schedule/timezone";
import { DEFAULT_INQUIRY_SURVEY_ID } from "$lib/ghl/constants";
import { questionsFor } from "$lib/ghl/questions";
import { createClient } from "$lib/prismicio";
import { isFunnelPath } from "$lib/consent/metaPixel";
import { metaCookies, sendMetaEvent } from "$lib/server/metaCapi";
import * as env from "$app/env/private";
import type { Content } from "@prismicio/client";
import type { RequestHandler } from "./$types";

// The industry landing pages are prerendered (root layout sets `prerender =
// "auto"`), and a prerendered page cannot host a form `action` — that is what
// forced /contact to opt out. Rather than drop /medtech and every future
// industry page out of the prerender for one modal, the modal POSTs here and
// this endpoint stays the only dynamic part.
export const prerender = false;

// Mirrors the /contact action's limits so a submission that would be rejected
// there is rejected here identically.
const MAX_LEN = {
  email: 254,
  step: 200,
  sourceUrl: 500,
  name: 200,
  phone: 40,
  // CRM identifiers: 20-char ids in practice, bounded well above that.
  fieldTag: 64,
  surveyId: 64,
  referrer: 500,
  campaign: 100,
  // Cloudflare documents a token as at most 2048 characters.
  turnstileToken: 2048,
};

// The completed application carries the wizard's answers as display-shaped
// {label, value} pairs — the client renders the questions, so the client is the
// one source of what the visitor actually saw. Bounds rather than a question
// whitelist: the survey a document points at is content-configurable, so this
// endpoint can't know the canonical set, only refuse absurd payloads.
const MAX_ANSWERS = 8;
const MAX_ANSWER_LABEL = 160;
const MAX_ANSWER_VALUE = 600;
const MAX_ANSWER_OPTIONS = 10;
// Ceiling on the summed label+value characters across all answers, so the
// newline-joined ingest message stays near /contact's own 5000-char message cap.
const MAX_ANSWERS_TOTAL = 4000;

type AnswerLine = { label: string; value: string | string[] };

// Answers land in a newline-joined ingest message. A raw newline in a label or
// value could forge a whole line of that message (e.g. a fake "SMS consent:
// yes"), so collapse every newline to a space before the value is trusted —
// the CRM option strings and the website field never contain one legitimately.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** Validate + sanitise the answers array; null when the shape is wrong. */
function readAnswers(raw: unknown): AnswerLine[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ANSWERS) return null;
  const out: AnswerLine[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const { label, value } = item as Record<string, unknown>;
    if (typeof label !== "string" || label.length > MAX_ANSWER_LABEL) return null;
    if (typeof value === "string") {
      if (value.length > MAX_ANSWER_VALUE) return null;
      out.push({ label: oneLine(label), value: oneLine(value) });
    } else if (Array.isArray(value)) {
      if (value.length > MAX_ANSWER_OPTIONS) return null;
      if (!value.every((v) => typeof v === "string" && v.length <= MAX_ANSWER_VALUE)) return null;
      out.push({ label: oneLine(label), value: value.map(oneLine) });
    } else {
      return null;
    }
  }
  return out;
}

/**
 * The same answers keyed by CRM field id, for the custom-field write. Bounded
 * exactly like `answers` above. WHICH ids are actually writable is decided
 * downstream by the CRM client's whitelist and never by this payload — a forged
 * tag reaches the client and is dropped there rather than trusted here.
 */
function readFields(raw: unknown): Record<string, string | string[]> | null {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS) return null;
  const out: Record<string, string | string[]> = {};
  for (const [tag, value] of entries) {
    if (tag.length > MAX_LEN.fieldTag) return null;
    if (typeof value === "string") {
      if (value.length > MAX_ANSWER_VALUE) return null;
      out[tag] = oneLine(value);
    } else if (Array.isArray(value)) {
      if (value.length > MAX_ANSWER_OPTIONS) return null;
      if (!value.every((v) => typeof v === "string" && v.length <= MAX_ANSWER_VALUE)) return null;
      out[tag] = value.map(oneLine);
    } else {
      return null;
    }
  }
  return out;
}

/**
 * The framework step titles of the industry page `campaign` names, read the way
 * the page reads them (the icon-columns slice; see [uid]/+page.svelte). A step
 * the visitor sent that is one of these is the page's own text, not theirs.
 * Empty on any failure or for a page with no steps, which only means `step`
 * counts as typed: a real step name is short and falls under ingest's floors.
 */
/** A step title as the modal sends it: trimmed, with the trailing colon the
 * page's titles carry ("The Diagnosis:") dropped, as InquiryModal's
 * `stepLabel` does. Both sides of the known-step check go through this, so the
 * check matches what production content actually holds (review round 3: every
 * live title ends in a colon, and the raw set never matched). */
function stepTitle(t: string): string {
  return t.trim().replace(/:$/, "").trim();
}

async function knownSteps(
  campaign: string,
  fetchFn: typeof fetch,
  cookies: Cookies,
): Promise<Set<string>> {
  if (!campaign) return new Set();
  try {
    const doc = await createClient({ fetch: fetchFn, cookies }).getByUID("industry", campaign);
    const slice = doc.data.slices.find(
      (s) => s.slice_type === "text_columns" && s.variation === "iconColumns",
    ) as Extract<Content.TextColumnsSlice, { variation: "iconColumns" }> | undefined;
    return new Set(
      (slice?.primary.columns ?? []).map((c) => stepTitle(c.title ?? "")).filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

/**
 * The part of the composed message the visitor actually typed, for central
 * ingest's duplicate scan (`extra.visitorText`). The message repeats the
 * survey's headings and option strings and the page's step title for every
 * applicant, so ingest never matches it on the message; this is what it scans
 * instead, so a pitch typed into an answer is still caught as a spray.
 * Everything that came from the browser and is not the site's own text goes
 * in: free-text answers, any label or option the survey does not have (a
 * forgery), and a `step` that is not one of the page's step titles.
 */
function visitorTextOf(
  step: string,
  steps: Set<string>,
  answers: AnswerLine[],
  surveyId: string,
): string {
  const questions = questionsFor(surveyId) ?? [];
  const headings = new Set(questions.map((q) => q.heading));
  const options = new Set(questions.flatMap((q) => (q.kind === "text" ? [] : q.options)));
  const typed: string[] = step && !steps.has(stepTitle(step)) ? [step] : [];
  for (const { label, value } of answers) {
    if (label && !headings.has(label)) typed.push(label);
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v && !options.has(v)) typed.push(v);
    }
  }
  return typed.join("\n");
}

// crypto.randomUUID() on the client; the same bound the pixel endpoint uses.
const LEAD_EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * The browser's Lead tag (`metaLead`), when it is well formed and accepted.
 * Anything else is undefined and ignored: a visitor cannot fix a bad tag, so it
 * is never a 400.
 */
function readLeadEventId(tag: unknown): string | undefined {
  if (typeof tag !== "object" || tag === null) return undefined;
  const { eventId, consent } = tag as Record<string, unknown>;
  if (consent !== "accepted") return undefined;
  return typeof eventId === "string" && LEAD_EVENT_ID.test(eventId) ? eventId : undefined;
}

type LeadInput = {
  tag: unknown;
  sourceUrl: string;
  url: URL;
  userAgent: string | undefined;
  clientIp: string | undefined;
  email: string;
  phone: string;
  cookies: Cookies;
  fetch: typeof fetch;
};

/**
 * The server copy of the browser's Lead for a completed application (see
 * $lib/consent/metaPixel `trackLead`). The source must be a funnel page on this
 * origin, as the browser's page was, and a request with no user agent is not a
 * browser's. Sends nothing when any check fails.
 */
async function sendLead(lead: LeadInput): Promise<void> {
  const eventId = readLeadEventId(lead.tag);
  if (!eventId || !lead.userAgent) return;
  let source: URL;
  try {
    source = new URL(lead.sourceUrl || `${lead.url.origin}${lead.url.pathname}`);
  } catch {
    return;
  }
  if (source.origin !== lead.url.origin || !isFunnelPath(source.pathname)) return;

  await sendMetaEvent(
    {
      eventName: "Lead",
      eventId,
      eventSourceUrl: source.origin + source.pathname,
      ip: lead.clientIp,
      userAgent: lead.userAgent,
      ...metaCookies((n) => lead.cookies.get(n), source),
      email: lead.email,
      phone: lead.phone,
    },
    {
      fetch: lead.fetch,
      token: env.META_CAPI_ACCESS_TOKEN,
      testEventCode: env.META_CAPI_TEST_EVENT_CODE,
    },
  );
}

export const POST: RequestHandler = async ({ request, fetch, url, getClientAddress, cookies }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Malformed request." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(body.email);
  const step = str(body.step);
  const sourceUrl = str(body.sourceUrl);
  const name = str(body.name);
  const phone = str(body.phone);
  const smsConsent = body.smsConsent === true;
  // For the CRM sync only: the referrer and the survey whose field ids the
  // answers are keyed by. Both are advisory — a missing survey id falls back to
  // the default, and a missing referrer just shortens the attribution note.
  const referrer = str(body.referrer);
  const surveyId = str(body.surveyId) || DEFAULT_INQUIRY_SURVEY_ID;
  // The industry page's uid. Fills utm_campaign when the visitor arrived with
  // none, and is recorded as the CRM's `funnel` value either way.
  const campaign = str(body.campaign);
  // Set on the contact so the CRM's own emails and texts render in the
  // visitor's time rather than the location's Mountain. Advisory like the two
  // above: an unrecognised value is dropped, never substituted.
  const timezone = normalizeZone(body.timezone);

  // Bot screen FIRST, ahead of every 400: a filled honeypot or an implausibly
  // fast fill is silently accepted (no forward) so a bot gets no signal —
  // whatever else is wrong with the payload. Running a validation 400 ahead of
  // this (e.g. on a malformed answers array) would hand a bot exactly the
  // accepted-vs-rejected signal the honeypot exists to deny it.
  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: str(body.botField) || null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  const answers = readAnswers(body.answers);
  const fields = readFields(body.fields);
  // A malformed answers array is a bug or a bot, not a visitor mistake — there
  // is no form state a human could fix to make it valid.
  if (answers === null || fields === null) {
    return json({ error: "Malformed request." }, { status: 400 });
  }
  /** Step one sends email only; the finished application carries the rest. */
  const isApplication = answers.length > 0 || name !== "" || phone !== "";
  // Per-item bounds still let 8 answers × (160 label + 10 × 600) sum to ~49KB;
  // cap the total so the composed ingest message stays near /contact's 5000.
  const answersChars = answers.reduce(
    (n, a) =>
      n + a.label.length + (Array.isArray(a.value) ? a.value.join("").length : a.value.length),
    0,
  );

  if (!email) {
    return json({ error: "Please provide an email address." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (
    email.length > MAX_LEN.email ||
    step.length > MAX_LEN.step ||
    sourceUrl.length > MAX_LEN.sourceUrl ||
    name.length > MAX_LEN.name ||
    phone.length > MAX_LEN.phone ||
    referrer.length > MAX_LEN.referrer ||
    surveyId.length > MAX_LEN.surveyId ||
    campaign.length > MAX_LEN.campaign ||
    answersChars > MAX_ANSWERS_TOTAL
  ) {
    return json({ error: "One of the fields is too long — please shorten it." }, { status: 400 });
  }

  if (!env.FORMS_INGEST_URL || !env.FORMS_INGEST_TOKEN) {
    console.error("[inquiry] FORMS_INGEST_URL / FORMS_INGEST_TOKEN not set");
    return json(
      { error: "The form is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  // Transient `_meta` envelope for central ingest — the Turnstile token, IP and
  // UA are used only for verification and scoring, none of it persisted. The
  // token is forwarded exactly as /contact's action forwards its
  // `cf-turnstile-response`. It is not optional in practice: the reddoor site
  // row has `require_turnstile` on, so central ingest stores a tokenless
  // submission as `spam_auto` (`turnstile-required-absent`) and emails nobody,
  // while the visitor still sees success. Every /medtech and /boise inquiry was
  // lost that way until 2026-11-03, when this endpoint forwarded no token. An
  // over-long value is dropped rather than rejected: a visitor cannot fix it.
  const rawToken = str(body.turnstileToken);
  const turnstileToken =
    rawToken && rawToken.length <= MAX_LEN.turnstileToken ? rawToken : undefined;
  const userAgent = request.headers.get("user-agent")?.trim();
  let clientIp: string | undefined;
  try {
    clientIp = getClientAddress();
  } catch {
    // Some adapters expose no client address — drop it silently.
  }
  const meta = {
    ...(turnstileToken ? { turnstileToken } : {}),
    ...(clientIp ? { clientIp } : {}),
    ...(userAgent ? { userAgent } : {}),
  };

  // Ingest requires a message. Step one says where the visitor opened the
  // modal; the finished application appends every question the wizard asked
  // with what they answered, so the lead reads complete in the dashboard
  // whether or not the CRM fire beside it landed.
  const opened = step ? `Landing-page inquiry — opened from "${step}".` : "Landing-page inquiry.";
  const message = isApplication
    ? [
        opened.replace("inquiry", "application"),
        "",
        ...answers.map(({ label, value }) => {
          const shown = Array.isArray(value) ? value.join("; ") : value;
          return `${label} ${shown || "—"}`;
        }),
        `SMS consent: ${smsConsent ? "yes" : "no"}`,
      ].join("\n")
    : opened;

  const result = await submitToIngest({
    url: env.FORMS_INGEST_URL,
    token: env.FORMS_INGEST_TOKEN,
    fetch,
    payload: {
      formType: "inquiry",
      email,
      // Central ingest requires a name (submissions.name is NOT NULL). Step one
      // is an email-only capture with no name yet, so fall back to the email —
      // the completed application posts the real name in its own submission.
      // (Follow-up: make name nullable for email-only leads — tracked on the
      // Airtable→Turso migration, maintenance #539.)
      name: name || email,
      ...(phone ? { phone } : {}),
      message,
      sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
      // Structured copy of the same answers, for anything downstream that
      // would rather not parse the message back apart. `composedMessage` tells
      // central ingest that this endpoint wrote `message` from a template, not
      // the visitor: step one is the same sentence for everyone and every
      // application repeats the same question labels, so ingest's fleet
      // duplicate-body scan stored every lead after the first in 30 days as
      // spam (2026-11-03). Ingest honours the flag only on a site that requires
      // Turnstile, with a token that passed on this site's own host, and then
      // scans `visitorText` (see visitorTextOf) instead of the whole message.
      extra: {
        ...(isApplication ? { answers, smsConsent } : {}),
        composedMessage: true,
        visitorText: visitorTextOf(
          step,
          step ? await knownSteps(campaign, fetch, cookies) : new Set(),
          answers,
          surveyId,
        ),
      },
      // Synthetic end-to-end probe marker (the fleet `form-e2e` audit): forwarded
      // ONLY when the submission carries testMode=true. Central ingest routes
      // those away from every real sink.
      ...(body.testMode === true ? { testMode: true } : {}),
      ...(Object.keys(meta).length ? { _meta: meta } : {}),
    },
  });

  if (!result.ok) {
    console.error(`[inquiry] ingest failed (${result.status}): ${result.error}`);
    return json(
      { error: "Something went wrong. Please try again or email info@reddoorla.com." },
      { status: 502 },
    );
  }

  // Ingest is the source of record and holds the lead now. The CRM sync runs on
  // top of it: awaited, so a failure is logged with a real status — the browser
  // fire this replaced was opaque by construction (`mode: "no-cors"`) and, on
  // the evidence, never landed once — but never fatal. A CRM outage must not
  // tell a visitor their application failed when it is safely in the dashboard.
  //
  // Synthetic probes are exempt: the fleet form-e2e audit hits the live endpoint
  // on a schedule, and its fake leads must not surface in anyone's pipeline.
  if (body.testMode !== true) {
    if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
      console.warn("[inquiry] CRM_FUNNEL_ACTIVE_TOKEN not set — skipping CRM sync");
    } else {
      const sync = isApplication
        ? await syncApplicationToCrm({
            token: env.CRM_FUNNEL_ACTIVE_TOKEN,
            fetch,
            surveyId,
            email,
            name,
            phone,
            fields,
            smsConsent,
            transcript: message,
            sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
            referrer,
            campaign,
            timezone,
          })
        : await syncInquiryToCrm({
            token: env.CRM_FUNNEL_ACTIVE_TOKEN,
            fetch,
            email,
            campaign,
            sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
            timezone,
          });
      if (!sync.ok) {
        console.error(`[inquiry] CRM sync failed (${sync.status}): ${sync.error}`);
      } else {
        // Logged on SUCCESS too, not just on a partial failure. This id is the
        // only link between an ingest submission and the CRM record it became,
        // and ingest has already been written by this point — see above, that
        // ordering is deliberate — so there is nowhere durable left to put it.
        // Recording it in the logs is the cheap half of the fix; the real one
        // is persisting funnel state, which is a larger piece of work.
        console.info(`[inquiry] ${step} -> crm contact ${sync.data.contactId}`);
        // The contact is saved by this point; these are the best-effort extras.
        // Named individually so a partial sync is diagnosable from the log
        // rather than looking like a clean success.
        const d = sync.data;
        const failed = [
          d.taggedOk === false && "tag",
          "opportunityOk" in d && d.opportunityOk === false && "opportunity",
          "noteOk" in d && d.noteOk === false && "note",
        ].filter(Boolean);
        if (failed.length) {
          console.warn(`[inquiry] contact ${d.contactId} saved; failed: ${failed.join(", ")}`);
        }
        // Its own line, because it is not a transport failure and reads as a
        // clean success everywhere else: the number collided with another
        // contact and the CRM kept the other one. The note carries it, but a
        // contact holding SMS consent and no number should be visible here too.
        if ("phoneDropped" in d && d.phoneDropped) {
          console.warn(
            `[inquiry] contact ${d.contactId}: submitted phone NOT stored (already on another contact)`,
          );
        }
      }
    }
  }

  // The Lead is the server copy of the browser's, for a finished application
  // only: step one is an email capture and sends none, and a probe never does.
  // Whatever happens here, the visitor still gets success: the application is
  // in ingest already.
  if (body.testMode !== true && isApplication) {
    try {
      await sendLead({
        tag: body.metaLead,
        sourceUrl,
        url,
        userAgent,
        clientIp,
        email,
        phone,
        cookies,
        fetch,
      });
    } catch (err) {
      console.error(`[inquiry] Lead not sent: ${(err as Error)?.message ?? err}`);
    }
  }

  return json({ success: true });
};
