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
  doc.head.appendChild(script);

  fbq("set", "autoConfig", false, META_PIXEL_ID);
  fbq("init", META_PIXEL_ID);
  return fbq;
}

/** One PageView for the funnel page now showing. */
export function trackFunnelPageView(win: PixelWindow, doc: Document): void {
  ensureMetaPixel(win, doc)("track", "PageView");
}
