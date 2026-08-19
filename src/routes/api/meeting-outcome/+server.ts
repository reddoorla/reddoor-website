import { json } from "@sveltejs/kit";
import { timingSafeEqual } from "node:crypto";
import { env } from "$env/dynamic/private";
import { isOutcome, recordMeetingOutcome } from "$lib/ghl/outcome";
import type { RequestHandler } from "./$types";

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = { email: 254, notes: 5000, leadValue: 20 };

/**
 * Constant-time compare, so a wrong key cannot be recovered a character at a
 * time from response timing. Length is checked first because timingSafeEqual
 * throws on a mismatch — that check is not itself constant-time, which leaks
 * only the key's LENGTH, and a length is not worth an allocation to hide.
 */
function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Record what happened on a call.
 *
 * ── Why this endpoint has a key and the others do not ─────────────────────
 *
 * Every other public endpoint here acts on the person submitting: their
 * booking, their consent. This one writes a lead value, internal notes and a
 * sales outcome onto somebody ELSE's record, and it triggers an email to a
 * client. The page it replaces is wide open — anyone with the URL can post to
 * GHL's — and inheriting that on our own domain is not a trade worth making.
 *
 * So it fails CLOSED: no MEETING_OUTCOME_KEY in the environment means the
 * endpoint refuses everything rather than falling back to open. The key rides
 * in the trigger link Tim follows.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
  if (!env.MEETING_OUTCOME_KEY) {
    console.error("[meeting-outcome] MEETING_OUTCOME_KEY not set — refusing");
    return json({ error: "This page is not available." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Malformed request." }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key : "";
  if (!keyMatches(key, env.MEETING_OUTCOME_KEY)) {
    // Deliberately the same answer as a missing page: an authorised user always
    // arrives with the key in the link, so nobody legitimate sees this.
    return json({ error: "This page is not available." }, { status: 404 });
  }

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[meeting-outcome] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json({ error: "The CRM is temporarily unavailable." }, { status: 500 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(body.email);
  const outcome = str(body.outcome);
  // Digits only: the field is MONETORY, and "$12,000" is not a number.
  const leadValue = str(body.leadValue).replace(/[^\d.]/g, "");
  const internalNotes = str(body.internalNotes);
  const recapNotes = str(body.recapNotes);
  const sendRecap = body.sendRecap === true;

  if (!email || !EMAIL.test(email) || email.length > MAX.email) {
    return json({ error: "Please provide the client's email address." }, { status: 400 });
  }
  if (!isOutcome(outcome)) {
    return json({ error: "Please choose an outcome." }, { status: 400 });
  }
  if (
    internalNotes.length > MAX.notes ||
    recapNotes.length > MAX.notes ||
    leadValue.length > MAX.leadValue
  ) {
    return json({ error: "One of the notes fields is too long." }, { status: 400 });
  }
  if (sendRecap && !recapNotes) {
    return json(
      { error: "A recap email needs recap notes — that text is what gets sent." },
      { status: 400 },
    );
  }

  const result = await recordMeetingOutcome({
    token: env.CRM_FUNNEL_ACTIVE_TOKEN,
    fetch,
    input: { email, outcome, leadValue, internalNotes, recapNotes, sendRecap },
  });

  if (!result.ok) {
    console.error(`[meeting-outcome] failed (${result.status}): ${result.error}`);
    return json({ error: "We couldn't save that. Please try again." }, { status: 502 });
  }
  if (!result.data) {
    // This IS surfaced, unlike on the resubscribe form. The user is a colleague
    // who can fix a typo, not a stranger who could enumerate the CRM with it.
    return json({ error: "No contact in the CRM has that email address." }, { status: 404 });
  }
  if (!result.data.taggedOk) {
    console.warn(`[meeting-outcome] contact ${result.data.contactId} saved; tag failed`);
  }

  return json({ success: true, name: result.data.name, sendRecap });
};
