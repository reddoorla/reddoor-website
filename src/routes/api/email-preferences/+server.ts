import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { screenSubmission } from "@reddoorla/maintenance/forms";
import { resubscribeEmail } from "$lib/ghl/consent";
import type { RequestHandler } from "./$types";

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turn marketing email back on for an address.
 *
 * The only consent operation this site performs, and it only ever runs in the
 * opt-IN direction — see $lib/ghl/consent for why unsubscribing stays with
 * GHL's own tooling.
 *
 * Two things it deliberately does NOT do:
 *
 * It does not say whether the address was known. An endpoint that answered
 * "no such contact" is an email-enumeration oracle against a CRM, so a valid
 * address always gets the same answer whatever happened upstream. That also
 * means a CRM failure is logged rather than surfaced — the visitor cannot fix
 * it, and the alternative is telling them their address does not exist.
 *
 * And it does not accept a name or a phone. A resubscribe form is not a place
 * to take profile data from an unauthenticated stranger.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Malformed request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  // Bot screen ahead of every validation error, as on the other endpoints.
  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: typeof body.botField === "string" ? body.botField : null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  if (!email || !EMAIL.test(email) || email.length > 254) {
    return json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[email-preferences] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json(
      { error: "This is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  const result = await resubscribeEmail({ token: env.CRM_FUNNEL_ACTIVE_TOKEN, fetch, email });
  if (!result.ok) {
    // Logged, not surfaced: see the enumeration note above.
    console.error(`[email-preferences] resubscribe failed (${result.status}): ${result.error}`);
  } else if (result.data.isNew) {
    // Worth a line. It means someone typed an address the CRM had never seen,
    // which is either a typo or the upsert's known cost (see consent.ts).
    console.warn(`[email-preferences] resubscribe CREATED contact ${result.data.contactId}`);
  }

  return json({ success: true });
};
