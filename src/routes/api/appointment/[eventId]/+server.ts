import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchAppointment, publicView } from "$lib/ghl/appointment";
import type { RequestHandler } from "./$types";

export const prerender = false;

/**
 * What the browser is allowed to know about an appointment it holds the id for.
 *
 * The id is a bearer token out of an email, so this returns the narrowest thing
 * that still lets someone move or cancel: a time, a status, and whether either
 * is still possible. The CRM's own answer carries the Zoom join URL, the
 * contact id and the assigned user; `publicView` drops all three before this
 * ever reaches a response body.
 */
export const GET: RequestHandler = async ({ params, fetch, setHeaders }) => {
  const eventId = params.eventId ?? "";
  // Ids are opaque CRM handles. Bound the length so a long string cannot be
  // used to probe the upstream, and reject anything that is not one.
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(eventId)) {
    return json({ error: "We couldn't find that booking." }, { status: 404 });
  }

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[appointment] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json({ error: "This page is temporarily unavailable." }, { status: 500 });
  }

  // Never cached: a status can change from under a shared CDN entry, and the
  // response is about one identified person's booking.
  setHeaders({ "cache-control": "no-store" });

  const appointment = await fetchAppointment({
    token: env.CRM_FUNNEL_ACTIVE_TOKEN,
    fetch,
    eventId,
  });
  if (!appointment.ok) {
    // A missing appointment and a broken upstream read the same to a visitor —
    // but not to us, so log the difference and only 404 on a real 404.
    if (appointment.status === 404) {
      return json({ error: "We couldn't find that booking." }, { status: 404 });
    }
    console.error(`[appointment] read failed (${appointment.status}): ${appointment.error}`);
    return json({ error: "We couldn't load that booking." }, { status: 502 });
  }

  return json(publicView(appointment.data));
};
