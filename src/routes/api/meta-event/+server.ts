import * as env from "$app/env/private";
import { isFunnelPath } from "$lib/consent/metaPixel";
import { metaCookies, sendMetaEvent } from "$lib/server/metaCapi";
import type { RequestHandler } from "./$types";

// The server half of the MedTech funnel's Meta Pixel ($lib/consent/metaPixel).
// The browser posts here once for each event it tracks, with the `eventID` it
// gave fbq; this sends the same event to the Conversions API with that id, so
// Meta counts the pair once. The browser pixel is the source of truth for which
// events exist, where, and under what consent: this endpoint only mirrors it.
export const prerender = false;

/** The events the browser pixel sends. PageView only, as of #332. */
const PIXEL_EVENTS = new Set(["PageView"]);

// crypto.randomUUID() on the client; bounded so a body can't stuff Meta's logs.
const EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

const MAX_BODY = 4096;

const noContent = () => new Response(null, { status: 204 });
const bad = () => new Response(null, { status: 400 });

export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress, fetch }) => {
  let body: Record<string, unknown>;
  try {
    // A real body is ~250 bytes. Refuse a declared-large one unread; the
    // length check after reading catches one that does not declare it.
    if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return bad();
    const text = await request.text();
    if (text.length > MAX_BODY) return bad();
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return bad();
    body = parsed as Record<string, unknown>;
  } catch {
    return bad();
  }

  // The same consent the pixel reads: the browser sends the visitor's answer,
  // and only "accepted" lets anything through. Checked before validation, so a
  // visitor who did not accept never causes a Graph call, malformed or not.
  if (body.consent !== "accepted") return noContent();

  const { event_name, event_id, event_source_url } = body;
  if (typeof event_name !== "string" || !PIXEL_EVENTS.has(event_name)) return bad();
  if (typeof event_id !== "string" || !EVENT_ID.test(event_id)) return bad();
  if (typeof event_source_url !== "string") return bad();
  let source: URL;
  try {
    source = new URL(event_source_url);
  } catch {
    return bad();
  }
  if (source.origin !== url.origin || !isFunnelPath(source.pathname)) return bad();

  // Meta requires client_user_agent on a website event and rejects one
  // without it; a request with none is not a browser's.
  const userAgent = request.headers.get("user-agent");
  if (!userAgent) return noContent();

  let ip: string | undefined;
  try {
    ip = getClientAddress();
  } catch {
    ip = undefined;
  }

  // A PageView is not a form submission, so it carries no email or phone,
  // whatever the body holds.
  await sendMetaEvent(
    {
      eventName: event_name,
      eventId: event_id,
      // Origin and path only. A CRM link lands on /schedule with the lead's
      // name, email and phone in the query, and $lib/url/stripQueryParams
      // removes them only after this page view has been posted; Meta must
      // never see them. fbclid is read from the full URL above, first.
      eventSourceUrl: source.origin + source.pathname,
      ip,
      userAgent,
      ...metaCookies((n) => cookies.get(n), source),
    },
    {
      fetch,
      token: env.META_CAPI_ACCESS_TOKEN,
      testEventCode: env.META_CAPI_TEST_EVENT_CODE,
    },
  );
  return noContent();
};
