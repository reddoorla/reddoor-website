import { error, redirect } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchAppointment } from "$lib/ghl/appointment";
import { googleCalendarUrl } from "$lib/schedule/ics";
import type { RequestHandler } from "./$types";

export const prerender = false;

/**
 * Hand this booking to Google Calendar.
 *
 * A redirect rather than a rendered link, so the Zoom join URL — password and
 * all — lives only in a `Location` header. The equivalent client-side anchor
 * would put it in our HTML, where anyone opening a forwarded confirmation email
 * could read it out of the page source.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const eventId = params.eventId ?? "";
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(eventId)) error(404, "We couldn't find that booking.");
  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[calendar] CRM_FUNNEL_ACTIVE_TOKEN not set");
    error(500, "This link is temporarily unavailable.");
  }

  const a = await fetchAppointment({ token: env.CRM_FUNNEL_ACTIVE_TOKEN, fetch, eventId });
  if (!a.ok) {
    if (a.status !== 404) console.error(`[calendar] read failed (${a.status}): ${a.error}`);
    error(a.status === 404 ? 404 : 502, "We couldn't load that booking.");
  }

  redirect(
    302,
    googleCalendarUrl({
      title: a.data.title || "Intro call — Reddoor Creative",
      startTime: a.data.startTime,
      endTime: a.data.endTime,
      join: a.data.address,
    }),
  );
};
