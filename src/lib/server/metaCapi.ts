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
 * Meta's `ph` normalisation: digits only, with the country code. A number
 * written with `+` keeps its own code; without one, only a North American
 * number is recognisable (ten digits starting 2-9, or eleven starting 1).
 * Anything else is dropped (empty), because guessing hashes a wrong number:
 * "020 7946 0958" minus its 0 would read as a US number.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return digits.replace(/^0+/, "");
  if (/^[2-9]\d{9}$/.test(digits)) return `1${digits}`;
  if (/^1[2-9]\d{9}$/.test(digits)) return digits;
  return "";
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

const GRAPH_TIMEOUT_MS = 3000;

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

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`;
  try {
    // The token rides in the JSON body (Graph reads it there), never the URL,
    // so nothing that logs request URLs can leak it. The timeout bounds a hung
    // Graph call: the endpoint awaits this before answering.
    const res = await opts.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...buildPayload(ev, opts.testEventCode), access_token: opts.token }),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (res.ok) return "sent";
    // Codes only: Meta's message text can quote what it rejected (an IP, a
    // user agent, fbc), which is personal data and does not belong in logs.
    const err = ((await res.json().catch(() => null)) as { error?: Record<string, unknown> } | null)
      ?.error;
    log.error(
      `[meta-capi] ${ev.eventName} refused: HTTP ${res.status} code=${err?.code ?? "?"} subcode=${err?.error_subcode ?? "-"} trace=${err?.fbtrace_id ?? "-"}`,
    );
    return "failed";
  } catch (err) {
    log.error(`[meta-capi] ${ev.eventName} not sent: ${(err as Error)?.message ?? err}`);
    return "failed";
  }
}
