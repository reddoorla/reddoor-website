import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchFreeSlots } from "$lib/ghl/booking";
import type { RequestHandler } from "./$types";

export const prerender = false;

/**
 * Open slots for the intro-call calendar.
 *
 * Read by /schedule from the browser rather than a server `load`, for two
 * reasons that both come down to freshness. The page shell itself is static and
 * prerenderable; folding slot data into it would make it neither. And the root
 * layout puts every SSR response on Netlify's durable CDN for five minutes with
 * a day of stale-while-revalidate — correct for marketing pages, wrong for a
 * list where a stale entry means two people arrive for the same call.
 *
 * For the same reason this response is not cached AT ALL. A short CDN TTL looked
 * tempting (the endpoint is cheap and traffic is low) until the failure it
 * creates: losing a slot race returns "that time was just taken", the page
 * refetches, the CDN serves the same taken slot back, and the visitor loops.
 * Correctness beats the saved call.
 *
 * Flat, not grouped by day: the CRM buckets by the LOCATION's calendar date
 * (Mountain) and only the browser knows the visitor's zone, so grouping happens
 * there. See $lib/schedule/slots.
 */

/** The calendar's own booking window is five days; ask wider so a config change
 *  widens the page too, and let the CRM decide what it will actually offer. */
const DEFAULT_DAYS = 14;
const MAX_DAYS = 31;
const DAY_MS = 86_400_000;

export const GET: RequestHandler = async ({ fetch, url, setHeaders }) => {
  const requested = Number(url.searchParams.get("days"));
  const days = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), MAX_DAYS)
    : DEFAULT_DAYS;

  if (!env.CRM_TOKEN) {
    console.error("[slots] CRM_TOKEN not set");
    return json(
      { error: "Booking is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  // From now, so slots already past today are gone. The calendar is configured
  // with no minimum notice, so the CRM may legitimately offer a time a few
  // minutes out — that is its setting to make, not ours to quietly override.
  const startDate = Date.now();
  const result = await fetchFreeSlots({
    token: env.CRM_TOKEN,
    fetch,
    startDate,
    endDate: startDate + days * DAY_MS,
  });

  if (!result.ok) {
    console.error(`[slots] free-slots failed (${result.status}): ${result.error}`);
    return json(
      { error: "We couldn't load available times. Please try again or email info@reddoorla.com." },
      { status: 502 },
    );
  }

  setHeaders({ "cache-control": "no-store" });
  return json({
    slots: result.data
      .flatMap((day) => day.slots)
      // Lexical order would be wrong the moment two slots carry different
      // offsets, which is exactly what happens across a DST boundary.
      .sort((a, b) => Date.parse(a) - Date.parse(b)),
  });
};
