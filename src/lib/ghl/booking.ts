import { GHL_LOCATION_ID, GHL_CALENDAR_ID, TAG_SCHEDULED_A_CALL } from "./constants";
import { crmCall, type CrmFetch, type CrmResult } from "./client";

/**
 * The booking half of the CRM integration: reading the intro-call calendar's
 * open slots, and turning a chosen one into a real appointment.
 *
 * Why native rather than the hosted widget: our CSP is enforcing and allows
 * framing only Vimeo, Prismic, Cloudflare and Netlify, so the
 * `links.reddoorla.com` booking iframe is inert on staging and production. It
 * would also reintroduce the third-party cookies we cleaned up fleet-wide. And
 * it is what Tim asked for — "use our CSS and then I can tweak any spacing".
 *
 * The calendar is Mon–Fri 9:00–17:00 in the LOCATION's timezone
 * (America/Boise), 30-minute slots, one booking per slot, a five-day booking
 * window and no minimum notice. Slots come back as ISO strings carrying an
 * absolute offset, so the browser can render them in the visitor's own zone
 * without us guessing at it — which matters, because the raw offset is Mountain
 * and this is an LA-facing business.
 */

/** One day's open slots, as absolute ISO timestamps. */
export type FreeSlotDay = { date: string; slots: string[] };

/** The response keys that are days; everything else (traceId…) is metadata. */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Open slots between two instants. GHL returns an object keyed by calendar date
 * — ALONGSIDE non-date keys like `traceId`, so the keys must be filtered rather
 * than iterated blindly or a trace id becomes a day with no slots.
 */
export async function fetchFreeSlots(opts: {
  token: string;
  fetch: CrmFetch;
  /** Epoch ms. */
  startDate: number;
  /** Epoch ms. */
  endDate: number;
  calendarId?: string;
}): Promise<CrmResult<FreeSlotDay[]>> {
  const id = opts.calendarId || GHL_CALENDAR_ID;
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/calendars/${encodeURIComponent(id)}/free-slots?startDate=${opts.startDate}&endDate=${opts.endDate}`,
    { method: "GET" },
    (json) =>
      Object.entries(json)
        .filter(([key]) => DATE_KEY.test(key))
        .map(([date, value]) => ({
          date,
          slots: ((value as { slots?: unknown[] })?.slots ?? []).filter(
            (s): s is string => typeof s === "string",
          ),
        }))
        .filter((d) => d.slots.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
  );
}

/**
 * Book a slot for an existing contact.
 *
 * Deliberately NOT passed: `endTime` (the calendar's own 30-minute duration
 * applies), `meetingLocationType` (the calendar is configured for Zoom, and
 * overriding it here would silently drop the conference link), and
 * `ignoreFreeSlotValidation` / `ignoreDateRange` — leaving those false is what
 * makes the CRM reject a double-booking or an out-of-window time rather than
 * accepting it and letting two people arrive for the same slot.
 *
 * `toNotify` defaults to true, which is what runs "A-102-3. Appointment Booked
 * + Reminders" and sends the lead their confirmation. It is a parameter only so
 * a verification booking can be made without emailing a real person.
 */
export async function bookAppointment(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  /** ISO 8601 with offset, exactly as free-slots returned it. */
  startTime: string;
  title: string;
  calendarId?: string;
  /** false suppresses the CRM's confirmation automations. Default true. */
  notify?: boolean;
}): Promise<CrmResult<{ appointmentId: string; startTime: string; endTime: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/calendars/events/appointments",
    {
      method: "POST",
      body: JSON.stringify({
        calendarId: opts.calendarId || GHL_CALENDAR_ID,
        locationId: GHL_LOCATION_ID,
        contactId: opts.contactId,
        startTime: opts.startTime,
        title: opts.title,
        // The calendar auto-confirms, so say so rather than leaving it pending
        // and having the lead's confirmation email contradict the CRM.
        appointmentStatus: "confirmed",
        toNotify: opts.notify !== false,
      }),
    },
    (json) => {
      const e = (json.event ?? json.appointment ?? json) as Record<string, unknown>;
      return {
        appointmentId: String(e.id ?? ""),
        startTime: String(e.startTime ?? opts.startTime),
        endTime: String(e.endTime ?? ""),
      };
    },
  );
}

/** The tag the CRM uses for a booked call. Re-exported so callers need one import. */
export { TAG_SCHEDULED_A_CALL };
