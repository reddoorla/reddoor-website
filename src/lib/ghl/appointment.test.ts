import { describe, expect, it } from "vitest";
import {
  appointmentJustHeld,
  cancelAppointment,
  fetchAppointment,
  publicView,
  rescheduleAppointment,
  stopBookingWorkflowAfterCancel,
} from "./appointment";
import { GHL_CALENDAR_ID, GHL_WORKFLOW_APPOINTMENT_BOOKED } from "./constants";

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

describe("appointmentJustHeld", () => {
  const NOW = Date.parse("2026-08-19T18:00:00Z");
  const ev = (id: string, start: string, status = "confirmed") => ({
    id,
    calendarId: "cal",
    contactId: "C1",
    startTime: start,
    endTime: start,
    status,
    title: "",
    address: "",
  });

  it("picks the most recent appointment that has already started", () => {
    // A lead who rescheduled twice has three events on file. Only the one the
    // salesperson just sat through (or did not) should be marked.
    const chosen = appointmentJustHeld(
      [
        ev("old", "2026-08-05T18:00:00Z"),
        ev("held", "2026-08-19T17:00:00Z"),
        ev("older", "2026-07-01T18:00:00Z"),
      ],
      NOW,
    );
    expect(chosen?.id).toBe("held");
  });

  it("never reaches forward to an appointment that has not happened", () => {
    // The dangerous case: someone logs a missed call while their NEXT call is
    // already booked. Marking that one no-show would cancel a live lead.
    const chosen = appointmentJustHeld([ev("future", "2026-08-26T18:00:00Z")], NOW);
    expect(chosen).toBeNull();
  });

  it("leaves already-settled appointments alone", () => {
    for (const status of ["cancelled", "noshow", "showed", "invalid"]) {
      const chosen = appointmentJustHeld([ev("done", "2026-08-19T17:00:00Z", status)], NOW);
      expect(chosen, status).toBeNull();
    }
  });

  it("returns null when there is nothing on file", () => {
    // An outcome can be logged for a call that was never in the calendar.
    expect(appointmentJustHeld([], NOW)).toBeNull();
  });

  it("ignores an unparseable start rather than treating it as the epoch", () => {
    // Date.parse("") is NaN; a naive comparison would sort it to the front and
    // mark an appointment nobody can date.
    const chosen = appointmentJustHeld([ev("broken", ""), ev("held", "2026-08-19T17:00:00Z")], NOW);
    expect(chosen?.id).toBe("held");
  });
});

describe("stopBookingWorkflowAfterCancel", () => {
  const NOW = Date.parse("2026-10-21T19:00:00Z");
  /** A CRM whose appointment list and workflow removal answer as told. */
  function crm(opts: { events?: unknown[]; listStatus?: number; removeStatus?: number } = {}) {
    const calls: Array<{ url: string; method: string }> = [];
    const fetch = async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ url, method });
      if (url.includes("/appointments")) {
        return new Response(JSON.stringify({ events: opts.events ?? [] }), {
          status: opts.listStatus ?? 200,
        });
      }
      return new Response(JSON.stringify({ succeeded: true }), {
        status: opts.removeStatus ?? 200,
      });
    };
    return { fetch, calls };
  }
  const cancelled = { ...RAW, id: "cancelled_1", appointmentStatus: "cancelled" };
  const run = (fetch: ReturnType<typeof crm>["fetch"]) =>
    stopBookingWorkflowAfterCancel({
      token: "t",
      fetch,
      contactId: "contact_1",
      eventId: "cancelled_1",
      sleep: async () => {},
      now: () => NOW,
    });

  it("removes the contact from A-102-3 and from nothing else", async () => {
    const { fetch, calls } = crm({ events: [cancelled] });
    await run(fetch);
    const removals = calls.filter((c) => c.method === "DELETE");
    expect(removals).toHaveLength(1);
    expect(removals[0]?.url).toContain(
      `/contacts/contact_1/workflow/${GHL_WORKFLOW_APPOINTMENT_BOOKED}`,
    );
  });

  it("is A-102-3's id, the confirmation workflow, not Z-002-1's", () => {
    // Z-002-1 (81c7e65a-…) is the cancel's win-back email. Removing a lead
    // from it would silence the one message a cancel should send.
    expect(GHL_WORKFLOW_APPOINTMENT_BOOKED).toBe("16c2a705-040c-49ae-9c96-3bfe7f8dbbb9");
  });

  it("waits before removing, so it lands after the cancel's re-enrolment", async () => {
    const { fetch, calls } = crm({ events: [cancelled] });
    const waited: number[] = [];
    await stopBookingWorkflowAfterCancel({
      token: "t",
      fetch,
      contactId: "contact_1",
      eventId: "cancelled_1",
      sleep: async (ms) => {
        waited.push(ms);
        expect(calls).toHaveLength(0);
      },
      now: () => NOW,
    });
    // Removed 1s after a live cancel, the confirmation still went (2026-10-21).
    expect(waited[0]).toBeGreaterThanOrEqual(5_000);
  });

  it("leaves A-102-3 alone while another call is still booked", async () => {
    // A-102-3 is what sends that call's reminders.
    const other = { ...RAW, id: "other_1", startTime: "2026-10-29T13:30:00-07:00" };
    const { fetch, calls } = crm({ events: [cancelled, other] });
    await run(fetch);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("removes when the only other call is already in the past", async () => {
    const past = { ...RAW, id: "past_1", appointmentStatus: "showed" };
    const { fetch, calls } = crm({ events: [cancelled, past] });
    await run(fetch);
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });

  it("does not remove when the appointment list is unreadable", async () => {
    const { fetch, calls } = crm({ listStatus: 500 });
    await run(fetch);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("never throws, whatever the CRM does", async () => {
    await expect(
      run(crm({ events: [cancelled], removeStatus: 500 }).fetch),
    ).resolves.toBeUndefined();
    const broken = async () => {
      throw new Error("network down");
    };
    await expect(run(broken)).resolves.toBeUndefined();
  });
});
