import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { screenSubmission } from "@reddoorla/maintenance/forms";
import { cancelAppointment, fetchAppointment, publicView } from "$lib/ghl/appointment";
import type { RequestHandler } from "./$types";

export const prerender = false;

const EVENT_ID = /^[A-Za-z0-9_-]{10,64}$/;

/**
 * Cancel an existing appointment.
 *
 * POST rather than GET, and behind an explicit confirm on the page, because the
 * id travels in an email: a GET here would be cancelled by the first link
 * scanner, spam filter or inbox preview that touched the message. The CRM's own
 * hosted page has the same property and solves it the same way.
 *
 * A cancel that "already happened" is reported as success, not as an error.
 * Someone who clicks twice, or opens the link on their phone after cancelling
 * on their laptop, has got what they wanted, and an error would suggest
 * otherwise.
 */
export const POST: RequestHandler = async ({ params, request, fetch }) => {
  const eventId = params.eventId ?? "";
  if (!EVENT_ID.test(eventId)) {
    return json({ error: "We couldn't find that booking." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Malformed request." }, { status: 400 });
  }

  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: typeof body.botField === "string" ? body.botField : null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[cancel] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json(
      { error: "Cancelling is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  const token = env.CRM_FUNNEL_ACTIVE_TOKEN;
  const existing = await fetchAppointment({ token, fetch, eventId });
  if (!existing.ok) {
    if (existing.status === 404) {
      return json({ error: "We couldn't find that booking." }, { status: 404 });
    }
    console.error(`[cancel] read failed (${existing.status}): ${existing.error}`);
    return json({ error: "We couldn't load that booking." }, { status: 502 });
  }

  // Already cancelled, or already happened. Both are "nothing left to do".
  if (!publicView(existing.data).actionable) {
    return json({ success: true, alreadyDone: true });
  }

  const cancelled = await cancelAppointment({ token, fetch, eventId });
  if (!cancelled.ok) {
    console.error(`[cancel] cancel failed (${cancelled.status}): ${cancelled.error}`);
    return json(
      { error: "We couldn't cancel that booking. Please email info@reddoorla.com." },
      { status: 502 },
    );
  }

  return json({ success: true });
};
