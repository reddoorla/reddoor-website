import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { screenSubmission } from "@reddoorla/maintenance/forms";
import { fetchAppointment, publicView, rescheduleAppointment } from "$lib/ghl/appointment";
import type { RequestHandler } from "./$types";

export const prerender = false;

const EVENT_ID = /^[A-Za-z0-9_-]{10,64}$/;

/**
 * Move an existing appointment to a new time.
 *
 * Failure philosophy matches /api/book rather than /api/inquiry: the CRM call
 * IS the outcome. If the calendar still holds the old time, nothing moved, and
 * telling someone otherwise means they turn up on the wrong day.
 *
 * The appointment is READ first, and a dead or past one is refused here rather
 * than handed to the CRM. Not for the CRM's benefit — for the visitor's: "that
 * booking has already been cancelled" is an answer, where whatever the upstream
 * returns for a PUT against a cancelled event is a guess.
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

  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";

  // Bot screen ahead of every validation error, as on the other endpoints: a
  // filled honeypot is accepted silently so a bot learns nothing from the
  // difference between an accepted and a rejected payload.
  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: typeof body.botField === "string" ? body.botField : null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  // No visitor can produce an unparseable time by using the page, so there is
  // nothing here for them to correct.
  if (!startTime || Number.isNaN(Date.parse(startTime)) || startTime.length > 40) {
    return json({ error: "Please choose a time." }, { status: 400 });
  }

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[reschedule] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json(
      { error: "Rescheduling is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  const token = env.CRM_FUNNEL_ACTIVE_TOKEN;
  const existing = await fetchAppointment({ token, fetch, eventId });
  if (!existing.ok) {
    if (existing.status === 404) {
      return json({ error: "We couldn't find that booking." }, { status: 404 });
    }
    console.error(`[reschedule] read failed (${existing.status}): ${existing.error}`);
    return json({ error: "We couldn't load that booking." }, { status: 502 });
  }
  if (!publicView(existing.data).actionable) {
    return json(
      {
        error:
          "That booking has already been cancelled or has passed. Please book a new time instead.",
        gone: true,
      },
      { status: 409 },
    );
  }

  const moved = await rescheduleAppointment({ token, fetch, eventId, startTime });
  if (!moved.ok) {
    console.error(`[reschedule] move failed (${moved.status}): ${moved.error}`);
    // Slot validation is left on, so the CRM rejects a time taken between page
    // load and submit. That is the likely 4xx, and the visitor CAN fix it.
    const taken = moved.status >= 400 && moved.status < 500;
    return json(
      {
        error: taken
          ? "That time was just taken. Please choose another."
          : "We couldn't move that booking. Please try again or email info@reddoorla.com.",
        refreshSlots: taken,
      },
      { status: taken ? 409 : 502 },
    );
  }

  return json({ success: true, startTime: moved.data.startTime });
};
