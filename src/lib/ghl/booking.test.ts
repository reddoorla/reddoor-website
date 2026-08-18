import { describe, expect, it } from "vitest";
import { bookAppointment, fetchFreeSlots } from "./booking";
import { GHL_CALENDAR_ID, GHL_LOCATION_ID } from "./constants";

function stub(status: number, body: unknown) {
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

describe("fetchFreeSlots", () => {
  it("keeps only date-shaped keys, so metadata is not read as a day", async () => {
    // `traceId` rides alongside the dates in every response. Iterating the
    // object blindly would turn it into a day with no slots.
    const { fetch, calls } = stub(200, {
      "2026-08-20": { slots: ["2026-08-20T09:30:00-06:00", "2026-08-20T10:00:00-06:00"] },
      "2026-08-19": { slots: ["2026-08-19T09:30:00-06:00"] },
      traceId: "abc-123",
    });
    const res = await fetchFreeSlots({ token: "t", fetch, startDate: 1, endDate: 2 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map((d) => d.date)).toEqual(["2026-08-19", "2026-08-20"]);
      expect(res.data[1].slots).toHaveLength(2);
    }
    expect(calls[0].url).toContain(`/calendars/${GHL_CALENDAR_ID}/free-slots`);
    expect(calls[0].url).toContain("startDate=1");
  });

  it("drops days with no open slots rather than rendering an empty column", async () => {
    const { fetch } = stub(200, {
      "2026-08-19": { slots: [] },
      "2026-08-20": { slots: ["2026-08-20T09:30:00-06:00"] },
    });
    const res = await fetchFreeSlots({ token: "t", fetch, startDate: 1, endDate: 2 });
    if (res.ok) expect(res.data.map((d) => d.date)).toEqual(["2026-08-20"]);
  });

  it("survives a day whose slots are missing or malformed", async () => {
    const { fetch } = stub(200, {
      "2026-08-19": {},
      "2026-08-20": { slots: [null, 42, "2026-08-20T09:30:00-06:00"] },
    });
    const res = await fetchFreeSlots({ token: "t", fetch, startDate: 1, endDate: 2 });
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].slots).toEqual(["2026-08-20T09:30:00-06:00"]);
    }
  });

  it("reports a failure rather than pretending the calendar is empty", async () => {
    // An empty slot list and a broken request must not look the same — one
    // means "fully booked", the other means "we don't know".
    const { fetch } = stub(401, { message: "The token is not authorized for this scope." });
    const res = await fetchFreeSlots({ token: "t", fetch, startDate: 1, endDate: 2 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });
});

describe("bookAppointment", () => {
  const base = {
    token: "t",
    contactId: "C1",
    startTime: "2026-08-20T09:30:00-06:00",
    title: "Intro call — Dana Buyer",
  };

  it("sends every required field, scoped to this location and calendar", async () => {
    const { fetch, calls } = stub(201, {
      event: { id: "A1", startTime: base.startTime, endTime: "x" },
    });
    const res = await bookAppointment({ ...base, fetch });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.appointmentId).toBe("A1");
    const body = calls[0].body;
    expect(body.calendarId).toBe(GHL_CALENDAR_ID);
    expect(body.locationId).toBe(GHL_LOCATION_ID);
    expect(body.contactId).toBe("C1");
    expect(body.startTime).toBe(base.startTime);
    // The calendar auto-confirms; saying so keeps the CRM and the lead's
    // confirmation email from disagreeing.
    expect(body.appointmentStatus).toBe("confirmed");
  });

  it("leaves slot and date-range validation ON so the CRM can refuse a clash", async () => {
    const { fetch, calls } = stub(201, { event: { id: "A1" } });
    await bookAppointment({ ...base, fetch });
    // Passing these as true would let two people book the same slot, or let
    // someone book outside the five-day window.
    expect("ignoreFreeSlotValidation" in calls[0].body).toBe(false);
    expect("ignoreDateRange" in calls[0].body).toBe(false);
    // endTime omitted so the calendar's own 30-minute duration applies, and
    // meetingLocationType omitted so its Zoom config is not overridden away.
    expect("endTime" in calls[0].body).toBe(false);
    expect("meetingLocationType" in calls[0].body).toBe(false);
  });

  it("notifies by default, which is what runs the CRM's reminder automations", async () => {
    const { fetch, calls } = stub(201, { event: { id: "A1" } });
    await bookAppointment({ ...base, fetch });
    expect(calls[0].body.toNotify).toBe(true);
  });

  it("can suppress notifications for a verification booking", async () => {
    const { fetch, calls } = stub(201, { event: { id: "A1" } });
    await bookAppointment({ ...base, fetch, notify: false });
    expect(calls[0].body.toNotify).toBe(false);
  });

  it("surfaces a rejected slot as an error the caller can show", async () => {
    const { fetch } = stub(422, { message: ["startTime must be a valid ISO 8601 date string"] });
    const res = await bookAppointment({ ...base, fetch, startTime: "nonsense" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("ISO 8601");
  });
});
