import { createHash } from "node:crypto";
import { META_PIXEL_ID } from "$lib/consent/metaPixel";

/**
 * Meta Conversions API (CAPI): the server copy of the MedTech funnel's pixel
 * events, sent by a direct Graph API call (no gateway, no partner).
 *
 * Each event carries the `event_id` the browser gave the same event as
 * `eventID`, so Meta keeps one of the pair and drops the other (48-hour window:
 * developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events).
 *
 * Unset `META_CAPI_ACCESS_TOKEN` is a real state (dev, CI, deploy previews,
 * production before the token is generated): then this sends nothing, logs
 * once per server instance, and never throws.
 */

/**
 * v27.0 is the version in Meta's current CAPI example; on 2026-11-10 Graph
 * answered v26.0 and v27.0 and called v28.0 unknown. Versions are supported
 * for at least two years.
 */
export const GRAPH_API_VERSION = "v27.0";

export type ServerEvent = {
  eventName: string;
  /** The browser's `eventID` for the same event: the deduplication key. */
  eventId: string;
  eventSourceUrl: string;
  /** Unix seconds; now when omitted. */
  eventTime?: number;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  /** Only from a form the visitor submitted; hashed before it leaves. */
  email?: string;
  /** Only from a form the visitor submitted; hashed before it leaves. */
  phone?: string;
};

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Meta's `em` normalisation: trim, then lower-case. */
export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

/**
 * Meta's `ph` normalisation: digits only, no leading zeros, with the country
 * code. A bare 10-digit number is taken as US/Canada, which is who the
 * MedTech funnel's forms are for.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

export function buildPayload(ev: ServerEvent, testEventCode?: string) {
  const user_data: Record<string, string | string[]> = {};
  if (ev.ip) user_data.client_ip_address = ev.ip;
  if (ev.userAgent) user_data.client_user_agent = ev.userAgent;
  if (ev.fbp) user_data.fbp = ev.fbp;
  if (ev.fbc) user_data.fbc = ev.fbc;
  const em = ev.email ? normalizeEmail(ev.email) : "";
  if (em) user_data.em = [sha256(em)];
  const ph = ev.phone ? normalizePhone(ev.phone) : "";
  if (ph) user_data.ph = [sha256(ph)];

  return {
    data: [
      {
        event_name: ev.eventName,
        event_time: ev.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: ev.eventId,
        action_source: "website",
        event_source_url: ev.eventSourceUrl,
        user_data,
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

type Log = Pick<Console, "warn" | "error">;

let warnedNoToken = false;

export async function sendMetaEvent(
  ev: ServerEvent,
  opts: {
    fetch: typeof fetch;
    token: string | undefined;
    testEventCode?: string;
    log?: Log;
  },
): Promise<"sent" | "skipped" | "failed"> {
  const log = opts.log ?? console;
  if (!opts.token) {
    if (!warnedNoToken) {
      warnedNoToken = true;
      log.warn("[meta-capi] META_CAPI_ACCESS_TOKEN is not set; server events are off.");
    }
    return "skipped";
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`);
  url.searchParams.set("access_token", opts.token);
  try {
    const res = await opts.fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildPayload(ev, opts.testEventCode)),
    });
    if (res.ok) return "sent";
    // Meta's error body names the problem (bad token, stale event_time); it
    // never echoes the token, and the URL holding it is not logged.
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    log.error(`[meta-capi] ${ev.eventName} refused: HTTP ${res.status} ${detail}`);
    return "failed";
  } catch (err) {
    log.error(`[meta-capi] ${ev.eventName} not sent: ${(err as Error)?.message ?? err}`);
    return "failed";
  }
}
