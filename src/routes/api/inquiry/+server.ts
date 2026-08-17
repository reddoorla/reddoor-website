import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { submitToIngest, screenSubmission } from "@reddoorla/maintenance/forms";
import type { RequestHandler } from "./$types";

// The industry landing pages are prerendered (root layout sets `prerender =
// "auto"`), and a prerendered page cannot host a form `action` — that is what
// forced /contact to opt out. Rather than drop /medtech and every future
// industry page out of the prerender for one modal, the modal POSTs here and
// this endpoint stays the only dynamic part.
export const prerender = false;

// Mirrors the /contact action's limits so a submission that would be rejected
// there is rejected here identically.
const MAX_LEN = { email: 254, step: 200, sourceUrl: 500, name: 200, phone: 40 };

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

export const POST: RequestHandler = async ({ request, fetch, url, getClientAddress }) => {
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
  // A malformed answers array is a bug or a bot, not a visitor mistake — there
  // is no form state a human could fix to make it valid.
  if (answers === null) {
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

  // Transient `_meta` envelope for central ingest — IP/UA used only for scoring,
  // none of it persisted. No Turnstile token here: this modal is a single email
  // field rather than /contact's full form, so it leans on the honeypot + timing
  // screen above and central verification stays fail-open, as it already is for
  // any submission that arrives without a token.
  const userAgent = request.headers.get("user-agent")?.trim();
  let clientIp: string | undefined;
  try {
    clientIp = getClientAddress();
  } catch {
    // Some adapters expose no client address — drop it silently.
  }
  const meta = {
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
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      message,
      sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
      // Structured copy of the same answers, for anything downstream that
      // would rather not parse the message back apart.
      ...(isApplication ? { extra: { answers, smsConsent } } : {}),
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

  return json({ success: true });
};
