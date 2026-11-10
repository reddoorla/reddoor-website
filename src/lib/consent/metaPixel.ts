/**
 * Meta Pixel for the MedTech funnel, consent-gated.
 *
 * Tim's pixel ("Reddoor Creative MT", 2026-11-10) belongs on the funnel only:
 * Meta's advice was to install it on the pages that should be tracked, and the
 * operator's call was to consent-gate it on the existing pages rather than move
 * them to a subdomain. So nothing here runs anywhere but `FUNNEL_PATHS`, and
 * nothing loads from Facebook until the visitor accepts.
 *
 * The gate is load-after-accept, the model Gallery Sonder's CookieConsent uses
 * (same storage key, PageView only): before an answer the page has no `fbq` and
 * no request to connect.facebook.net or facebook.com, and a Reject is final for
 * that browser.
 *
 * Two pixel defaults are switched off because they would break "PageView on the
 * funnel, nothing else":
 * - `disablePushState`: fbevents.js otherwise fires its own PageView on every
 *   history.pushState, so after one accepted funnel page every SPA navigation —
 *   to `/`, to a work page — would be tracked.
 * - `autoConfig`: otherwise the pixel scrapes clicks and form fields into
 *   automatic events on its own initiative.
 */

export const META_PIXEL_ID = "4257052441251456";

export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * The MedTech funnel, in order: the landing page, the offer page, the booking
 * page the inquiry hands over to, and the page an unqualified applicant lands
 * on. Exact paths — `/boise` is another funnel's front door and is not Tim's
 * pixel's to see, and a Prismic preview (`/preview/...`) is an editor, not a
 * visitor.
 */
export const FUNNEL_PATHS: readonly string[] = [
  "/medtech",
  "/brand-friction-audit",
  "/schedule",
  "/not-a-fit",
];

export function isFunnelPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return FUNNEL_PATHS.includes(normalized);
}

/** Shared with Gallery Sonder's banner: "true" accepted, "false" rejected. */
export const CONSENT_KEY = "cookieConsent";
export const CONSENT_DATE_KEY = "cookieConsentDate";

export type Consent = "accepted" | "rejected" | null;

/**
 * Storage can throw (private mode, blocked site data); unreadable means
 * unanswered. It is passed as a getter because with site data blocked even
 * READING `window.localStorage` throws, so the access itself has to sit inside
 * the try (the same failure $lib/schedule/handoff.ts guards for sessionStorage).
 */
export function readConsent(storage: () => Pick<Storage, "getItem">): Consent {
  try {
    const v = storage().getItem(CONSENT_KEY);
    if (v === "true") return "accepted";
    if (v === "false") return "rejected";
    return null;
  } catch {
    return null;
  }
}

export function saveConsent(
  storage: () => Pick<Storage, "setItem">,
  accepted: boolean,
  now: Date = new Date(),
): void {
  try {
    const s = storage();
    s.setItem(CONSENT_KEY, String(accepted));
    s.setItem(CONSENT_DATE_KEY, now.toISOString());
  } catch {
    // The answer still applies for this page view; it just won't be remembered.
  }
}

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqFn;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  /** Resolves once fbevents.js has loaded or failed (blocked, offline). */
  settled?: Promise<"load" | "error">;
};

export type PixelWindow = { fbq?: FbqFn; _fbq?: FbqFn };

/**
 * Meta's bootstrap, typed: define the `fbq` queue, add fbevents.js, init the
 * pixel with automatic events off. Idempotent — a second call only returns the
 * existing queue. Does not track; the caller sends the PageView.
 */
export function ensureMetaPixel(win: PixelWindow, doc: Document): FbqFn {
  if (win.fbq) return win.fbq;

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as FbqFn;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq.disablePushState = true;
  win.fbq = fbq;
  if (!win._fbq) win._fbq = fbq;

  const script = doc.createElement("script");
  script.async = true;
  script.src = META_PIXEL_SRC;
  fbq.settled = new Promise((resolve) => {
    script.addEventListener("load", () => resolve("load"));
    script.addEventListener("error", () => resolve("error"));
  });
  doc.head.appendChild(script);

  fbq("set", "autoConfig", false, META_PIXEL_ID);
  fbq("init", META_PIXEL_ID);
  return fbq;
}

/** What the browser posts to /api/meta-event for the Conversions API copy. */
export type ServerEventBody = {
  event_name: string;
  event_id: string;
  event_source_url: string;
  consent: "accepted";
};

export const SERVER_EVENT_ENDPOINT = "/api/meta-event";

/**
 * One id per event, shared by the pixel (`eventID`) and the server
 * (`event_id`), so Meta keeps one of the pair. randomUUID is missing on plain
 * http (`vite:devHost` on a phone) and before Safari 15.4, so it falls back to
 * getRandomValues, which is there on both.
 */
function newEventId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Fire-and-forget; `keepalive` lets it finish if the visitor leaves. */
function postServerEvent(body: ServerEventBody): void {
  try {
    void fetch(SERVER_EVENT_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // Measurement never breaks the page.
  }
}

/**
 * One PageView for the funnel page now showing, in the browser and (with the
 * same event id) on the server. Only an "accepted" answer sends either: the
 * server endpoint checks the same value again.
 */
export function trackFunnelPageView(
  win: PixelWindow,
  doc: Document,
  consent: Consent,
  send: (body: ServerEventBody) => void = postServerEvent,
): void {
  if (consent !== "accepted") return;
  const eventId = newEventId();
  const fbq = ensureMetaPixel(win, doc);
  fbq("track", "PageView", {}, { eventID: eventId });
  // Meta gets origin and path; the click id is the one query value the server
  // needs (for fbc). A CRM link's name, email and phone never leave the page.
  const here = new URL(doc.location.href);
  const fbclid = here.searchParams.get("fbclid");
  const body: ServerEventBody = {
    event_name: "PageView",
    event_id: eventId,
    event_source_url:
      here.origin + here.pathname + (fbclid ? `?fbclid=${encodeURIComponent(fbclid)}` : ""),
    consent,
  };
  void whenCookiesWritten(doc, fbq.settled).then(() => send(body));
}

const FBP_WAIT_STEP_MS = 100;
const FBP_WAIT_MAX_MS = 2000;
const hasFbp = (doc: Document) => /(?:^|;\s*)_fbp=/.test(doc.cookie ?? "");

/**
 * The server copy should carry Meta's _fbp/_fbc cookies, and fbevents.js
 * writes them only after it has loaded AND fetched the pixel's config: on the
 * deploy preview (2026-11-10, real fbevents.js) a post sent at load time went
 * 53ms after Accept with no _fb cookie, while both existed seconds later. So
 * after a load, wait (bounded) for _fbp; after a blocked script, no cookie is
 * coming and it posts at once.
 */
async function whenCookiesWritten(
  doc: Document,
  settled: Promise<"load" | "error"> | undefined,
): Promise<void> {
  if ((await settled) !== "load") return;
  for (let waited = 0; waited < FBP_WAIT_MAX_MS && !hasFbp(doc); waited += FBP_WAIT_STEP_MS) {
    await new Promise((r) => setTimeout(r, FBP_WAIT_STEP_MS));
  }
}

/**
 * The Lead tag for a submitted application, decided before the post so the
 * server gets the same id the pixel will. Null off the funnel or without an
 * accepted answer: then the post carries no tag and no Lead is fired anywhere.
 */
export function prepareLead(pathname: string, consent: Consent): { eventId: string } | null {
  if (!isFunnelPath(pathname) || consent !== "accepted") return null;
  return { eventId: newEventId() };
}

/**
 * The browser's Lead, once the application is in. It fires for a "No" at the
 * budget gate too: a Lead is a submitted application. Measurement never breaks
 * the form, so any failure here is swallowed.
 */
export function trackLead(win: PixelWindow, doc: Document, eventId: string): void {
  try {
    const fbq = ensureMetaPixel(win, doc);
    fbq("track", "Lead", {}, { eventID: eventId });
  } catch {
    // Measurement never breaks the form.
  }
}
