import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchAppointment } from "$lib/ghl/appointment";
import { buildIcs, toUtcStamp } from "$lib/schedule/ics";
import type { RequestHandler } from "./$types";

export const prerender = false;

/**
 * The booking as a .ics file — Apple Calendar, Outlook desktop, and everything
 * else that speaks RFC 5545.
 *
 * Served from the server so the Zoom join URL inside it is never rendered into
 * a page. The filename matters more than it looks: this arrives in a downloads
 * folder, where "event.ics" is indistinguishable from every other one.
 */
export const GET: RequestHandler = async ({ params, fetch, setHeaders }) => {
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

  let body: string;
  try {
    body = buildIcs(
      {
        title: a.data.title || "Intro call — Reddoor Creative",
        startTime: a.data.startTime,
        endTime: a.data.endTime,
        join: a.data.address,
      },
      eventId,
      toUtcStamp(new Date().toISOString()),
    );
  } catch (err) {
    // buildIcs throws only on an unparseable time, which would mean the CRM
    // handed us something we do not understand — a 502, not a 404.
    console.error(`[calendar] could not build ics: ${err instanceof Error ? err.message : err}`);
    error(502, "We couldn't build that calendar file.");
  }

  setHeaders({ "cache-control": "no-store" });
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="reddoor-intro-call.ics"',
    },
  });
};
