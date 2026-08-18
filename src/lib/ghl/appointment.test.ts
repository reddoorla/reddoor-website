import { describe, expect, it } from "vitest";
import {
  publicView,
  fetchAppointment,
  rescheduleAppointment,
  cancelAppointment,
} from "./appointment";
import { GHL_CALENDAR_ID } from "./constants";

/** The event as the CRM actually returns it — read from a live booking. */
const RAW = {
  id: "yeNIKuJ12o9bnPIUweNV",
  calendarId: GHL_CALENDAR_ID,
  contactId: "Bghx5CoBig84k6RBUcro",
  startTime: "2026-08-21T11:00:00-06:00",
  endTime: "2026-08-21T11:30:00-06:00",
  appointmentStatus: "confirmed",
  title: "Intro call — Tucker Lemos",
  address: "https://us06web.zoom.us/j/3922707667?pwd=secret",
  assignedUserId: "YaTIau1dtcRXPKlOpi20",
};

const BEFORE = Date.parse("2026-08-20T00:00:00Z");
const AFTER = Date.parse("2026-08-25T00:00:00Z");

function stub(body: unknown, status = 200) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: JSON.parse(String(init.body ?? "{}")),
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

const appointment = {
  id: RAW.id,
  calendarId: RAW.calendarId,
  contactId: RAW.contactId,
  startTime: RAW.startTime,
  endTime: RAW.endTime,
  status: "confirmed",
  title: RAW.title,
  address: RAW.address,
};

describe("publicView", () => {
  it("drops everything a stranger with the link has no business reading", () => {
    const view = publicView(appointment, BEFORE);
    // The id travels in an email. What it must NOT unlock is the meeting.
    expect(JSON.stringify(view)).not.toContain("zoom.us");
    expect(JSON.stringify(view)).not.toContain(RAW.contactId);
    expect(JSON.stringify(view)).not.toContain(RAW.assignedUserId);
    expect(Object.keys(view).sort()).toEqual(["actionable", "endTime", "startTime", "status"]);
  });

  it("is actionable while it is still standing and still ahead", () => {
    expect(publicView(appointment, BEFORE).actionable).toBe(true);
  });

  it("is not actionable once it has passed", () => {
    // The window closes on its own — nobody reschedules yesterday.
    expect(publicView(appointment, AFTER).actionable).toBe(false);
  });

  it.each(["cancelled", "Cancelled", "noshow", "invalid"])(
    "is not actionable when the status is %s",
    (status) => {
      expect(publicView({ ...appointment, status }, BEFORE).actionable).toBe(false);
    },
  );

  it("is not actionable when the start time is unparseable", () => {
    // Defaulting to "yes, act on it" on a value we cannot read would offer a
    // reschedule that the CRM then rejects for reasons we cannot explain.
    expect(publicView({ ...appointment, startTime: "" }, BEFORE).actionable).toBe(false);
  });
});

describe("fetchAppointment", () => {
  it("reads the correct status field despite the API's misspelled twin", async () => {
    // Observed together on a live read, 2026-08-18: the payload ships BOTH
    // `appointmentStatus` and `appoinmentStatus`. Picking the typo would break
    // the day they fix it.
    const { fetch } = stub({ event: { ...RAW, appoinmentStatus: "cancelled" } });
    const r = await fetchAppointment({ token: "t", fetch, eventId: RAW.id });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("confirmed");
  });

  it("falls back to the misspelling when it is the only one present", async () => {
    const { appointmentStatus: _drop, ...noCorrect } = RAW;
    const { fetch } = stub({ event: { ...noCorrect, appoinmentStatus: "cancelled" } });
    const r = await fetchAppointment({ token: "t", fetch, eventId: RAW.id });
    if (r.ok) expect(r.data.status).toBe("cancelled");
  });
});

describe("rescheduleAppointment", () => {
  it("moves the start and lets the calendar's own duration apply", async () => {
    const { fetch, calls } = stub({ event: { ...RAW, startTime: "2026-08-24T15:00:00-06:00" } });
    const r = await rescheduleAppointment({
      token: "t",
      fetch,
      eventId: RAW.id,
      startTime: "2026-08-24T15:00:00-06:00",
    });
    expect(r.ok).toBe(true);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toContain(`/calendars/events/appointments/${RAW.id}`);
    expect(calls[0].body.startTime).toBe("2026-08-24T15:00:00-06:00");
    // Sending a computed end is how a reschedule quietly changes the length of
    // a 30-minute call.
    expect("endTime" in calls[0].body).toBe(false);
    // Leaving these unset is what makes the CRM refuse a double-booking.
    expect("ignoreFreeSlotValidation" in calls[0].body).toBe(false);
    expect("ignoreDateRange" in calls[0].body).toBe(false);
  });

  it("notifies by default, since a moved call nobody was told about is worse", async () => {
    const { fetch, calls } = stub({ event: RAW });
    await rescheduleAppointment({ token: "t", fetch, eventId: RAW.id, startTime: RAW.startTime });
    expect(calls[0].body.toNotify).toBe(true);
  });
});

describe("cancelAppointment", () => {
  it("sets the status rather than deleting the record", async () => {
    // A DELETE takes the CRM's own "Cancelled Meeting > Let's Reschedule"
    // follow-up with it — the one thing that might win the lead back.
    const { fetch, calls } = stub({ event: { ...RAW, appointmentStatus: "cancelled" } });
    const r = await cancelAppointment({ token: "t", fetch, eventId: RAW.id });
    expect(r.ok).toBe(true);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body.appointmentStatus).toBe("cancelled");
  });

  it("reports a failure rather than claiming a cancel that did not happen", async () => {
    const { fetch } = stub({ message: "nope" }, 422);
    const r = await cancelAppointment({ token: "t", fetch, eventId: RAW.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });
});
