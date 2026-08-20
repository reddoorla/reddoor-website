import { addCrmTags, type CrmFetch, type CrmResult } from "./client";
import {
  appointmentJustHeld,
  listContactAppointments,
  markAppointmentNoShow,
  markAppointmentShowed,
} from "./appointment";
import { findContactByEmail, updateContact } from "./lookup";

/**
 * Logging what happened on a call — the internal replacement for
 * go.reddoorla.com/update, reached from the "Client Meeting Status Update"
 * trigger link.
 *
 * ── The option strings are DATA, not copy ─────────────────────────────────
 *
 * Every value below was read from the location's own custom-field definitions
 * on 2026-08-18 and is reproduced byte for byte, punctuation and all — the
 * stray space in "Not Interested/ Not Yet Ready", the exclamation mark on
 * "Sold!", the apostrophe in "No (don't send email)". GHL matches a submitted
 * option against its picklist exactly; an option "tidied up" here silently
 * unmaps the answer from the record, and the salesperson sees a blank field
 * rather than an error. `outcome.test.ts` pins them for that reason, the same
 * way questions.test.ts pins the survey's.
 *
 * ── The trigger gap, again ────────────────────────────────────────────────
 *
 * Writing these fields by API does not fire GHL's form-submitted trigger, so
 * whatever the hosted page's submission used to start — the conversation recap
 * email, and anything keyed to "Sold!" — will not run until someone adds
 * `Contact Tag Added` triggers in the CRM. That is the same gap A-102 has, and
 * it is why every outcome also applies a tag: the hook is ready and waiting, so
 * the CRM-side fix is one trigger per workflow rather than a rebuild.
 */

/** Field ids, from GET /locations/{id}/customFields. */
export const OUTCOME_FIELDS = {
  status: "ecxAtBgBCtua0mCmwOjT", // contact.appointment_status
  leadValue: "hgIqPAD8nfqQ7fOIGMxU", // contact.if_sold_lead_value
  internalNotes: "rKaJuZQUqDcqq1VZOoZ5", // contact.internal_notes_not_sent_to_client
  sendRecap: "OvwDdKei8MjYXxXu1WVf", // contact.send_conversation_recap_email
  recapNotes: "zPcu05nFBM9gzqIbpxZb", // contact.conversation_recap_notes_...
} as const;

/**
 * The five outcomes, in the CRM's own order, with the tag each one applies.
 *
 * Tags are namespaced `outcome …` deliberately. The location already uses bare
 * lower-case tags (`application started`, `scheduled a call`) and the CRM has
 * its own no-show handling keyed to appointment STATUS — an unprefixed
 * "no show" tag would sit ambiguously between the two.
 */
export const OUTCOMES = [
  { value: "No Show", tag: "outcome no show" },
  { value: "Unqualified - Not A Good Fit (Do Not Follow Up)", tag: "outcome unqualified" },
  { value: "Not Interested/ Not Yet Ready", tag: "outcome not ready" },
  { value: "Offer Made (pending)", tag: "outcome offer made" },
  { value: "Sold!", tag: "outcome sold" },
] as const;

export type OutcomeValue = (typeof OUTCOMES)[number]["value"];

/** The recap radio's two options, byte for byte. */
export const RECAP_YES = "Yes (send email)";
export const RECAP_NO = "No (don't send email)";

export function isOutcome(v: unknown): v is OutcomeValue {
  return typeof v === "string" && OUTCOMES.some((o) => o.value === v);
}

export function tagFor(value: OutcomeValue): string {
  return OUTCOMES.find((o) => o.value === value)!.tag;
}

export type OutcomeInput = {
  email: string;
  outcome: OutcomeValue;
  /** Digits only by the time it gets here; "" when not sold. */
  leadValue?: string;
  internalNotes?: string;
  recapNotes?: string;
  sendRecap: boolean;
};

/**
 * Record the outcome against an existing contact.
 *
 * Looks up rather than upserts, and refuses when there is no match. A call
 * outcome invented onto a contact that did not exist is worse than a failed
 * submission: it is a lead in the pipeline that nobody ever spoke to.
 */
export async function recordMeetingOutcome(opts: {
  token: string;
  fetch: CrmFetch;
  input: OutcomeInput;
}): Promise<
  CrmResult<{
    contactId: string;
    name: string;
    taggedOk: boolean;
    /** true marked, false tried and failed, null nothing to mark. */
    attendanceSynced: boolean | null;
  } | null>
> {
  const found = await findContactByEmail({
    token: opts.token,
    fetch: opts.fetch,
    email: opts.input.email,
  });
  if (!found.ok) return found;
  if (!found.data) return { ok: true, data: null };

  const { input } = opts;
  const customFields: Array<{ id: string; value: string }> = [
    { id: OUTCOME_FIELDS.status, value: input.outcome },
    { id: OUTCOME_FIELDS.sendRecap, value: input.sendRecap ? RECAP_YES : RECAP_NO },
  ];
  // Empty values are omitted rather than written blank, so re-logging a call
  // cannot wipe notes an earlier submission recorded.
  if (input.leadValue?.trim()) {
    customFields.push({ id: OUTCOME_FIELDS.leadValue, value: input.leadValue.trim() });
  }
  if (input.internalNotes?.trim()) {
    customFields.push({ id: OUTCOME_FIELDS.internalNotes, value: input.internalNotes.trim() });
  }
  if (input.recapNotes?.trim()) {
    customFields.push({ id: OUTCOME_FIELDS.recapNotes, value: input.recapNotes.trim() });
  }

  const updated = await updateContact({
    token: opts.token,
    fetch: opts.fetch,
    contactId: found.data.id,
    body: { customFields },
  });
  if (!updated.ok) return updated;

  // Best-effort, and through the tags endpoint rather than the update body:
  // `tags` on a contact write REPLACES the whole array, which would drop
  // `application completed` and every tag a workflow has added since.
  const tagged = await addCrmTags({
    token: opts.token,
    fetch: opts.fetch,
    contactId: found.data.id,
    tags: [tagFor(input.outcome)],
  });

  const attendance = await syncAttendance(opts, found.data.id, input.outcome);

  return {
    ok: true,
    data: {
      contactId: found.data.id,
      name: found.data.name,
      taggedOk: tagged.ok,
      attendanceSynced: attendance,
    },
  };
}

/**
 * Tell the CALENDAR what the contact record now says.
 *
 * Without this, an outcome tagged the contact and left the appointment sitting
 * at `confirmed`, so the CRM's own no-show follow-up never ran and the two
 * halves of the CRM disagreed about the same meeting.
 *
 * Every outcome except "No Show" means the call happened, so four of the five
 * settle as `showed` and one as `noshow`. That is not a nicety — `Z-002-2.
 * NoShow > Let's Reschedule` keys off this status, and sending a reschedule
 * invitation to someone you just made an offer to would be worse than silence.
 *
 * Best-effort throughout, and returns null rather than throwing: the outcome is
 * already safely on the record by the time this runs, and a salesperson who has
 * just logged a call should not be shown a failure about a calendar field.
 */
async function syncAttendance(
  opts: { token: string; fetch: CrmFetch },
  contactId: string,
  outcome: OutcomeValue,
): Promise<boolean | null> {
  const events = await listContactAppointments({ ...opts, contactId });
  if (!events.ok) {
    console.error(`[outcome] could not list appointments (${events.status}): ${events.error}`);
    return false;
  }
  const held = appointmentJustHeld(events.data);
  if (!held) {
    // Not a failure: an outcome can be logged for a call that was never in the
    // calendar at all, and a lead whose only appointment is still in the future
    // must not have it settled. Re-logging the same call lands here too, since
    // `SETTLED` already contains both statuses this writes.
    console.warn(`[outcome] contact ${contactId}: no past unsettled appointment to settle`);
    return null;
  }
  const mark = outcome === "No Show" ? markAppointmentNoShow : markAppointmentShowed;
  const marked = await mark({ ...opts, eventId: held.id });
  if (!marked.ok) {
    console.error(`[outcome] attendance mark failed (${marked.status}): ${marked.error}`);
    return false;
  }
  return true;
}
