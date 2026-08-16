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
const MAX_LEN = { email: 254, step: 200, sourceUrl: 500 };

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

  // Bot screen: a filled honeypot or an implausibly fast fill is silently
  // accepted (no forward) so bots get no signal — same contract as /contact.
  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: str(body.botField) || null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  if (!email) {
    return json({ error: "Please provide an email address." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (
    email.length > MAX_LEN.email ||
    step.length > MAX_LEN.step ||
    sourceUrl.length > MAX_LEN.sourceUrl
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

  const result = await submitToIngest({
    url: env.FORMS_INGEST_URL,
    token: env.FORMS_INGEST_TOKEN,
    fetch,
    payload: {
      formType: "inquiry",
      email,
      // Ingest requires a message; the useful signal for this modal is which
      // step of the framework the visitor opened it from, so say that plainly
      // rather than forwarding an empty string.
      message: step ? `Landing-page inquiry — opened from "${step}".` : "Landing-page inquiry.",
      sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
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
