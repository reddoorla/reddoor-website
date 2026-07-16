import { fail } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { submitToIngest, screenSubmission } from "@reddoorla/maintenance/forms";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { Actions, PageServerLoad } from "./$types";

// The root layout sets `prerender = "auto"`; this page now has a form `action`,
// and a prerendered/static page can't run a server action ("Cannot prerender
// pages with actions"). Opt this route out — it is genuinely dynamic now.
export const prerender = false;

export const load: PageServerLoad = async () => {
  return {
    title: "Contact | Reddoor Creative",
    meta_description: "We design beautiful marketing materials that help you thrive. Talk to us.",
    meta_title: "Contact | Reddoor Creative",
    meta_image: metaImage,
    // Planted per-request for the bot timing check (see screenSubmission).
    formTs: Date.now(),
  };
};

function elapsedMs(tsRaw: FormDataEntryValue | null): number | null {
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return Date.now() - ts;
}

export const actions: Actions = {
  default: async ({ request, fetch, url, getClientAddress }) => {
    const form = await request.formData();

    // Bot screen: a filled honeypot or an implausibly fast fill is silently
    // accepted (no forward) so bots get no signal.
    const screen = screenSubmission({
      botField: form.get("bot-field")?.toString() ?? null,
      elapsedMs: elapsedMs(form.get("ts")),
    });
    if (!screen.ok) return { success: true };

    // Server-side validation: the browser's `required` attributes don't bind a
    // direct POST — an empty submission must not report success, and oversized
    // payloads must not be forwarded to ingest.
    const fields = {
      name: form.get("name")?.toString().trim() ?? "",
      email: form.get("email")?.toString().trim() ?? "",
      phone: form.get("phone")?.toString().trim() ?? "",
      message: form.get("message")?.toString().trim() ?? "",
      company: form.get("company")?.toString().trim() ?? "",
    };
    const MAX_LEN = { name: 200, email: 254, phone: 50, message: 5000, company: 200 };
    if (!fields.email || !fields.message) {
      return fail(400, { error: "Please provide an email address and a message." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return fail(400, { error: "Please provide a valid email address." });
    }
    for (const key of Object.keys(MAX_LEN) as (keyof typeof MAX_LEN)[]) {
      if (fields[key].length > MAX_LEN[key]) {
        return fail(400, { error: "One of the fields is too long — please shorten it." });
      }
    }

    if (!env.FORMS_INGEST_URL || !env.FORMS_INGEST_TOKEN) {
      console.error("[contact] FORMS_INGEST_URL / FORMS_INGEST_TOKEN not set");
      return fail(500, {
        error: "The contact form is temporarily unavailable. Please email info@reddoorla.com.",
      });
    }

    // Transient `_meta` envelope for central ingest: the Cloudflare Turnstile token
    // (verified centrally) plus IP/UA used only for verification + scoring. None of
    // it is persisted; an absent token leaves central verification fail-open.
    const turnstileToken = form.get("cf-turnstile-response")?.toString().trim();
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

    const result = await submitToIngest({
      url: env.FORMS_INGEST_URL,
      token: env.FORMS_INGEST_TOKEN,
      fetch,
      payload: {
        formType: "contact",
        name: fields.name || undefined,
        email: fields.email,
        phone: fields.phone || undefined,
        message: fields.message,
        company: fields.company || undefined,
        sourceUrl: `${url.origin}${url.pathname}`,
        // Synthetic end-to-end probe marker (the fleet `form-e2e` audit). Forwarded
        // ONLY when the submitted form carries testMode=true — a real visitor never
        // sets it; central ingest recognizes it and routes the submission away from
        // every real sink.
        ...(form.get("testMode")?.toString() === "true" ? { testMode: true } : {}),
        ...(Object.keys(meta).length ? { _meta: meta } : {}),
      },
    });

    if (!result.ok) {
      console.error(`[contact] ingest failed (${result.status}): ${result.error}`);
      return fail(502, {
        error:
          "Something went wrong sending your message. Please try again or email info@reddoorla.com.",
      });
    }
    return { success: true };
  },
};
