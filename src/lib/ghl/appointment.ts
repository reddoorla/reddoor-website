import { GHL_CALENDAR_ID } from "./constants";
import { crmCall, type CrmFetch, type CrmResult } from "./client";

/**
 * Reading, moving and cancelling an existing appointment — the half of the
 * calendar the booking flow does not touch.
 *
 * This exists so the reschedule and cancel links in the CRM's own emails can
 * point at reddoorla.com instead of the hosted widget on
 * `links.reddoorla.com`, which is unstyled, unbranded, and framed by a CSP that
 * does not allow it anyway (see booking.ts).
 *
 * ── The security shape of this module ──────────────────────────────────────
 *
 * An appointment id in a URL is a BEARER TOKEN. It arrives in an email, and
 * emails get forwarded, land in shared inboxes, and leak through Referer. So
 * anyone holding the id can act on the appointment — that is true of the CRM's
 * own links and cannot be fixed without asking a lead to log in, which would
 * cost more bookings than it saves.
 *
 * What CAN be fixed is how much the id READS. The CRM returns the full event:
 *
 *   address         the Zoom join URL, with its password in the query string
 *   contactId       a handle onto the person
 *   assignedUserId  which of our people it is with
 *
 * `publicView` deliberately drops all of it. A stranger with a forwarded link
 * sees a time and a status, which is what they need to move or cancel it, and
 * nothing that lets them join a meeting they were not invited to. The Zoom link
 * still reaches the real attendee — through the calendar invite the CRM already
 * sends, and through the add-to-calendar route, which redirects server-side so
 * the URL never lands in our HTML.
 */

/** Everything the CRM knows. Server-side only — never serialise this outward. */
export type Appointment = {
  id: string;
  calendarId: string;
  contactId: string;
  startTime: string;
  endTime: string;
  status: string;
  title: string;
  /** The Zoom join URL. Treated as a secret; see the module comment. */
  address: string;
};

/** What a browser holding the id is allowed to see. */
export type PublicAppointment = {
  startTime: string;
  endTime: string;
  status: string;
  /** False once it is cancelled or in the past — the pages branch on this. */
  actionable: boolean;
};

/** Statuses the CRM uses for an appointment that is no longer standing. */
const DEAD = new Set(["cancelled", "noshow", "invalid"]);

export function publicView(a: Appointment, now = Date.now()): PublicAppointment {
  const starts = Date.parse(a.startTime);
  return {
    startTime: a.startTime,
    endTime: a.endTime,
    status: a.status,
    actionable: !DEAD.has(a.status.toLowerCase()) && Number.isFinite(starts) && starts > now,
  };
}

function pickAppointment(json: Record<string, unknown>): Appointment {
  const e = (json.event ?? json.appointment ?? json) as Record<string, unknown>;
  return {
    id: String(e.id ?? ""),
    calendarId: String(e.calendarId ?? ""),
    contactId: String(e.contactId ?? ""),
    startTime: String(e.startTime ?? ""),
    endTime: String(e.endTime ?? ""),
    // The API ships BOTH `appointmentStatus` and a misspelled
    // `appoinmentStatus` — observed together on a live read, 2026-08-18. Read
    // the correct one first and fall back, rather than picking the typo and
    // breaking the day they fix it.
    status: String(e.appointmentStatus ?? e.appoinmentStatus ?? ""),
    title: String(e.title ?? ""),
    address: String(e.address ?? ""),
  };
}

/** Read one appointment. Verified to work on the deployed five-scope token. */
export async function fetchAppointment(opts: {
  token: string;
  fetch: CrmFetch;
  eventId: string;
}): Promise<CrmResult<Appointment>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/calendars/events/appointments/${encodeURIComponent(opts.eventId)}`,
    { method: "GET" },
    pickAppointment,
  );
}

/**
 * Move an appointment to a new time.
 *
 * `endTime` is deliberately omitted so the calendar's own 30-minute duration
 * applies, exactly as on the original booking — sending a computed end is how
 * a reschedule quietly turns a 30-minute call into something else.
 *
 * Slot validation stays ON for the same reason it does when booking: without
 * it the CRM will happily move two people onto the same slot.
 */
export async function rescheduleAppointment(opts: {
  token: string;
  fetch: CrmFetch;
  eventId: string;
  /** ISO 8601 with offset, exactly as free-slots returned it. */
  startTime: string;
  calendarId?: string;
  notify?: boolean;
}): Promise<CrmResult<{ startTime: string; endTime: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/calendars/events/appointments/${encodeURIComponent(opts.eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        calendarId: opts.calendarId || GHL_CALENDAR_ID,
        startTime: opts.startTime,
        appointmentStatus: "confirmed",
        toNotify: opts.notify !== false,
      }),
    },
    (json) => {
      const a = pickAppointment(json);
      return { startTime: a.startTime || opts.startTime, endTime: a.endTime };
    },
  );
}

/**
 * Cancel an appointment.
 *
 * A status change rather than DELETE. Deleting destroys the record, and the
 * CRM's cancellation workflows ("Z-002-1. Cancelled Meeting > Let's
 * Reschedule") are keyed to the status — a deleted event just vanishes, taking
 * the follow-up that might win the lead back with it.
 */
export async function cancelAppointment(opts: {
  token: string;
  fetch: CrmFetch;
  eventId: string;
  notify?: boolean;
}): Promise<CrmResult<{ status: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/calendars/events/appointments/${encodeURIComponent(opts.eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        appointmentStatus: "cancelled",
        toNotify: opts.notify !== false,
      }),
    },
    (json) => ({ status: pickAppointment(json).status || "cancelled" }),
  );
}
