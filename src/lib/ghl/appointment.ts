import { GHL_CALENDAR_ID, GHL_WORKFLOW_APPOINTMENT_BOOKED } from "./constants";
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

/**
 * Take a contact out of a workflow. Needs contacts.write.
 *
 * The CRM answers 200 whether or not the contact was enrolled (measured
 * 2026-10-21: the same call twice, both 200), so success here says the request
 * was accepted, not that anything was stopped. Only the message log shows that.
 */
export async function removeFromWorkflow(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  workflowId: string;
}): Promise<CrmResult<null>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/contacts/${encodeURIComponent(opts.contactId)}/workflow/${encodeURIComponent(opts.workflowId)}`,
    { method: "DELETE", body: "{}" },
    () => null,
  );
}

/**
 * When, after a cancel, to take the contact out of A-102-3: each entry is a
 * wait, so the removals land about 6s and 15s after the cancel.
 *
 * The cancel re-enrols the contact 2–4s after it lands, and A-102-3 sends the
 * "Call Confirmation" about 26s after the cancel. Measured on a test contact,
 * 2026-10-21: removed 1s after the cancel, the confirmation still went (the
 * enrolment came after the removal); removed at 7s and at 13s, no
 * confirmation, and Z-002-1's "Cancellation Confirmation & Reschedule Link"
 * arrived instead, which it never did while A-102-3 ran. A removal is a
 * harmless 200 when the contact is not enrolled, so the second one costs
 * nothing and covers an enrolment that comes late under load.
 */
export const CANCEL_GUARD_WAITS_MS = [6_000, 9_000] as const;

/**
 * After a successful cancel, take the contact out of "A-102-3. Appointment
 * Booked + Reminders", so the cancel's re-enrolment sends no "Call
 * Confirmation" and no reminders for a call that is not happening (timing:
 * CANCEL_GUARD_WAITS_MS).
 *
 * A backstop for a trigger the API cannot edit: the real fix is a status
 * filter on A-102-3's trigger in the workflow builder (docs/inquiry-funnel.md
 * §6.21). Once that is in, this removes a contact that is no longer enrolled.
 *
 * Skipped when the contact still has another standing call, because A-102-3 is
 * what reminds them about that one. Never throws, and never touches Z-002-1,
 * the workflow that tries to win the lead back.
 */
export async function stopBookingWorkflowAfterCancel(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  /** The appointment just cancelled. */
  eventId: string;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<void> {
  if (!opts.contactId) {
    console.error("[cancel] guard skipped, the appointment has no contact");
    return;
  }
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    for (const wait of CANCEL_GUARD_WAITS_MS) {
      await sleep(wait);

      // Read each time: a call booked since the last pass must keep A-102-3.
      const events = await listContactAppointments(opts);
      if (!events.ok) {
        // No removal without a good read; the next pass may get one.
        console.error(
          `[cancel] guard pass skipped, appointments unreadable (${events.status}): ${events.error}`,
        );
        continue;
      }
      const now = (opts.now ?? Date.now)();
      if (events.data.some((e) => e.id !== opts.eventId && publicView(e, now).actionable)) return;

      const removed = await removeFromWorkflow({
        token: opts.token,
        fetch: opts.fetch,
        contactId: opts.contactId,
        workflowId: GHL_WORKFLOW_APPOINTMENT_BOOKED,
      });
      if (!removed.ok) {
        console.error(`[cancel] A-102-3 removal failed (${removed.status}): ${removed.error}`);
      }
    }
  } catch (err) {
    console.error(`[cancel] guard threw: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Statuses that mean the appointment is already resolved one way or another. */
const SETTLED = new Set(["cancelled", "noshow", "showed", "invalid"]);

/**
 * The appointment a just-logged call outcome refers to: the most recent one
 * that has already STARTED and has not been settled.
 *
 * "Most recent past" rather than "only appointment" because a lead who
 * rescheduled twice has three events on file, and because someone logging an
 * outcome may already have their NEXT call booked — marking that one no-show
 * would be a genuine mess.
 */
export function appointmentJustHeld(events: Appointment[], now = Date.now()): Appointment | null {
  const past = events
    .filter((e) => {
      const t = Date.parse(e.startTime);
      return Number.isFinite(t) && t <= now && !SETTLED.has(e.status.toLowerCase());
    })
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  return past[0] ?? null;
}

/** Every appointment on a contact. Needs only contacts.readonly. */
export async function listContactAppointments(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
}): Promise<CrmResult<Appointment[]>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/contacts/${encodeURIComponent(opts.contactId)}/appointments`,
    { method: "GET" },
    (json) => {
      const events = (json.events ?? []) as Record<string, unknown>[];
      return events.map((e) => pickAppointment({ event: e }));
    },
  );
}

/**
 * Record whether the call actually happened.
 *
 * Reported by Erik 2026-08-19: the post-call "it was a pleasure chatting with
 * you" text reached him minutes into a live call. That turned out to be a
 * human submitting GHL's form mid-call, not a timer — but tracing it showed
 * that submitting GHL's form ALSO sets this status, and our page did not.
 *
 * `toNotify` is false for both. The salesperson is recording what already
 * happened; a status change is not itself news the lead needs a message about.
 * For a no-show the message they SHOULD get is Z-002-2's, which the status
 * change is what triggers.
 */
function setAttendance(
  opts: { token: string; fetch: CrmFetch; eventId: string },
  status: "showed" | "noshow",
): Promise<CrmResult<{ status: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/calendars/events/appointments/${encodeURIComponent(opts.eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ appointmentStatus: status, toNotify: false }),
    },
    (json) => ({ status: pickAppointment(json).status || status }),
  );
}

/**
 * Mark an appointment as a no-show.
 *
 * Logging "No Show" on /meeting-outcome tagged the CONTACT but left the
 * APPOINTMENT alone, so the CRM's own no-show handling ("Z-002-2. NoShow >
 * Let's Reschedule") never fired and the calendar disagreed with the record.
 */
export function markAppointmentNoShow(opts: {
  token: string;
  fetch: CrmFetch;
  eventId: string;
}): Promise<CrmResult<{ status: string }>> {
  return setAttendance(opts, "noshow");
}

/**
 * Mark an appointment as attended.
 *
 * The counterpart, and the reason `SETTLED` above could read "showed" while
 * nothing wrote it: we settled the missed calls and left every call that DID
 * happen sitting at `confirmed` forever. GHL's own form sets this — observed on
 * a real contact, 2026-08-19, four seconds before the recap SMS went out — so
 * whatever reads the status is already used to seeing it.
 */
export function markAppointmentShowed(opts: {
  token: string;
  fetch: CrmFetch;
  eventId: string;
}): Promise<CrmResult<{ status: string }>> {
  return setAttendance(opts, "showed");
}
