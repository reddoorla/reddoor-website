import { json } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { submitToIngest, screenSubmission } from "@reddoorla/maintenance/forms";
import { upsertCrmContact, addCrmTags, attributionFields, phoneWasDropped } from "$lib/ghl/client";
import { normalizeZone } from "$lib/schedule/timezone";
import { bookAppointment, TAG_SCHEDULED_A_CALL } from "$lib/ghl/booking";
import type { RequestHandler } from "./$types";

export const prerender = false;

const MAX_LEN = { email: 254, name: 200, phone: 40, sourceUrl: 500, campaign: 100, startTime: 40 };

/**
 * Booking differs from /api/inquiry in one important way: there, ingest is the
 * source of record and the CRM is a sync on top, so the CRM is called last and
 * never fails the request. Here the CRM call IS the outcome — if the
 * appointment does not exist in their calendar, nothing was booked, and
 * telling the visitor otherwise would be a lie they only discover when nobody
 * joins the call. So the appointment is made FIRST and a failure is surfaced;
 * ingest is notified afterwards so a booking is never invisible to the team.
 */
export const POST: RequestHandler = async ({ request, fetch, url, getClientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Malformed request." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const email = str(body.email);
  const name = str(body.name);
  const phone = str(body.phone);
  const startTime = str(body.startTime);
  const sourceUrl = str(body.sourceUrl);
  const campaign = str(body.campaign);
  // Dropped rather than rejected when unrecognised: the booking is what matters
  // here, and an absent zone only costs the visitor the Mountain-time rendering
  // they were already getting.
  const timezone = normalizeZone(body.timezone);

  // Bot screen ahead of every validation error, as on /api/inquiry: a filled
  // honeypot is silently accepted so a bot learns nothing from the difference
  // between an accepted and a rejected payload.
  const ts = Number(body.ts);
  const screen = screenSubmission({
    botField: str(body.botField) || null,
    elapsedMs: Number.isFinite(ts) && ts > 0 ? Date.now() - ts : null,
  });
  if (!screen.ok) return json({ success: true });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please provide a valid email address." }, { status: 400 });
  }
  if (!name) {
    return json({ error: "Please tell us your name." }, { status: 400 });
  }
  // A time we cannot parse is a bug or a bot — no visitor can produce one by
  // filling the form, so there is nothing for them to correct.
  if (!startTime || Number.isNaN(Date.parse(startTime))) {
    return json({ error: "Please choose a time." }, { status: 400 });
  }
  if (
    email.length > MAX_LEN.email ||
    name.length > MAX_LEN.name ||
    phone.length > MAX_LEN.phone ||
    sourceUrl.length > MAX_LEN.sourceUrl ||
    campaign.length > MAX_LEN.campaign ||
    startTime.length > MAX_LEN.startTime
  ) {
    return json({ error: "One of the fields is too long — please shorten it." }, { status: 400 });
  }

  if (!env.CRM_FUNNEL_ACTIVE_TOKEN) {
    console.error("[book] CRM_FUNNEL_ACTIVE_TOKEN not set");
    return json(
      { error: "Booking is temporarily unavailable. Please email info@reddoorla.com." },
      { status: 500 },
    );
  }

  // The contact must exist before an appointment can reference it. Upsert
  // rather than assume: this page is reachable cold, so the person booking may
  // never have filled in the application.
  const contact = await upsertCrmContact({
    token: env.CRM_FUNNEL_ACTIVE_TOKEN,
    fetch,
    email,
    name,
    phone,
    timezone,
    customFields: attributionFields(campaign),
  });
  if (!contact.ok) {
    console.error(`[book] contact upsert failed (${contact.status}): ${contact.error}`);
    return json(
      { error: "Something went wrong. Please try again or email info@reddoorla.com." },
      { status: 502 },
    );
  }

  // Same conflict as on the application path (see phoneWasDropped): a number
  // already sitting on another contact is dropped on an otherwise clean 200.
  // Nothing to correct here — the appointment matters more than the reminder,
  // and ingest has the number — but it must not pass unrecorded.
  if (phoneWasDropped(phone, contact.data.storedPhone)) {
    console.warn(
      `[book] contact ${contact.data.contactId}: submitted phone NOT stored (already on another contact)`,
    );
  }

  const appointment = await bookAppointment({
    token: env.CRM_FUNNEL_ACTIVE_TOKEN,
    fetch,
    contactId: contact.data.contactId,
    startTime,
    title: `Intro call — ${name}`,
  });
  if (!appointment.ok) {
    console.error(`[book] appointment failed (${appointment.status}): ${appointment.error}`);
    // Slot validation is left ON in bookAppointment, so the CRM rejects a time
    // that was taken between page load and submit. That is the likely 4xx here
    // and the visitor CAN fix it, by choosing again — so say so, and tell the
    // page to refresh its slots.
    const taken = appointment.status >= 400 && appointment.status < 500;
    return json(
      {
        error: taken
          ? "That time was just taken. Please choose another."
          : "We couldn't confirm that booking. Please try again or email info@reddoorla.com.",
        refreshSlots: taken,
      },
      { status: taken ? 409 : 502 },
    );
  }

  // Best-effort from here — the appointment is real and confirmed, so nothing
  // below may turn a successful booking into a failure the visitor sees.
  const tagged = await addCrmTags({
    token: env.CRM_FUNNEL_ACTIVE_TOKEN,
    fetch,
    contactId: contact.data.contactId,
    tags: [TAG_SCHEDULED_A_CALL],
  });
  if (!tagged.ok) console.warn(`[book] tag failed: ${tagged.error}`);

  if (env.FORMS_INGEST_URL && env.FORMS_INGEST_TOKEN && body.testMode !== true) {
    const userAgent = request.headers.get("user-agent")?.trim();
    let clientIp: string | undefined;
    try {
      clientIp = getClientAddress();
    } catch {
      /* some adapters expose no client address */
    }
    const result = await submitToIngest({
      url: env.FORMS_INGEST_URL,
      token: env.FORMS_INGEST_TOKEN,
      fetch,
      payload: {
        formType: "booking",
        email,
        name,
        ...(phone ? { phone } : {}),
        message: `Intro call booked for ${appointment.data.startTime}.`,
        sourceUrl: sourceUrl || `${url.origin}${url.pathname}`,
        extra: {
          startTime: appointment.data.startTime,
          appointmentId: appointment.data.appointmentId,
          // Carried so the team notification says which zone the visitor read
          // the time in. `startTime` is absolute and unambiguous; the human
          // reading it is not.
          ...(timezone ? { timezone } : {}),
        },
        ...(clientIp || userAgent
          ? { _meta: { ...(clientIp ? { clientIp } : {}), ...(userAgent ? { userAgent } : {}) } }
          : {}),
      },
    });
    if (!result.ok) console.error(`[book] ingest failed (${result.status}): ${result.error}`);
  }

  return json({ success: true, startTime: appointment.data.startTime });
};
