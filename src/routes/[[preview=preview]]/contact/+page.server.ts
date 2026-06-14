import { fail } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { submitToIngest, screenSubmission } from "@reddoorla/maintenance/forms";
import metaImage from "$lib/assets/icons/logos/printedReddoor.png";
import type { Actions, PageServerLoad } from "./$types";

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
  default: async ({ request, fetch, url }) => {
    const form = await request.formData();

    // Bot screen: a filled honeypot or an implausibly fast fill is silently
    // accepted (no forward) so bots get no signal.
    const screen = screenSubmission({
      botField: form.get("bot-field")?.toString() ?? null,
      elapsedMs: elapsedMs(form.get("ts")),
    });
    if (!screen.ok) return { success: true };

    if (!env.FORMS_INGEST_URL || !env.FORMS_INGEST_TOKEN) {
      console.error("[contact] FORMS_INGEST_URL / FORMS_INGEST_TOKEN not set");
      return fail(500, {
        error: "The contact form is temporarily unavailable. Please email info@reddoorla.com.",
      });
    }

    const result = await submitToIngest({
      url: env.FORMS_INGEST_URL,
      token: env.FORMS_INGEST_TOKEN,
      fetch,
      payload: {
        formType: "contact",
        name: form.get("name")?.toString(),
        email: form.get("email")?.toString(),
        phone: form.get("phone")?.toString(),
        message: form.get("message")?.toString(),
        company: form.get("company")?.toString(),
        sourceUrl: `${url.origin}${url.pathname}`,
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
