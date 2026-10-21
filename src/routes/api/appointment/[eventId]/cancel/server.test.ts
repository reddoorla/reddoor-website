import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GHL_WORKFLOW_APPOINTMENT_BOOKED } from "$lib/ghl/constants";

// The cancel handler, driven against a fetch stub standing in for the CRM, for
// the order that matters here: the cancel first, then (and only then) the
// guard that takes the contact out of A-102-3. screenSubmission stays REAL.
vi.mock("$app/env/private", () => ({ CRM_FUNNEL_ACTIVE_TOKEN: "crm-token" }));

const { POST } = await import("./+server");

const EVENT_ID = "test_event_000001";

type Call = { url: string; method: string };

function crm(opts: { cancelStatus?: number; removeStatus?: number } = {}) {
  const calls: Call[] = [];
  const event = {
    id: EVENT_ID,
    calendarId: "kNRHivTnovXd07knBgu1",
    contactId: "contact_1",
    startTime: "2099-10-29T13:30:00-07:00",
    endTime: "2099-10-29T14:00:00-07:00",
    appointmentStatus: "confirmed",
  };
  const fetchStub = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.includes("/workflow/")) {
      return new Response(JSON.stringify({ succeeded: true }), {
        status: opts.removeStatus ?? 200,
      });
    }
    if (url.includes("/contacts/") && url.endsWith("/appointments")) {
      return new Response(
        JSON.stringify({ events: [{ ...event, appointmentStatus: "cancelled" }] }),
      );
    }
    if (method === "PUT") {
      return new Response(JSON.stringify({ ...event, appointmentStatus: "cancelled" }), {
        status: opts.cancelStatus ?? 200,
      });
    }
    return new Response(JSON.stringify(event));
  }) as unknown as typeof globalThis.fetch;
  return { fetchStub, calls };
}

/** Calls the handler with a Netlify-shaped platform whose waitUntil is recorded. */
async function cancel(fetchStub: typeof globalThis.fetch) {
  const pending: Promise<unknown>[] = [];
  const event = {
    params: { eventId: EVENT_ID },
    request: new Request(`https://site.test/api/appointment/${EVENT_ID}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ botField: "", ts: Date.now() - 10_000 }),
    }),
    fetch: fetchStub,
    platform: { context: { waitUntil: (p: Promise<unknown>) => pending.push(p) } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const res: Response = await POST(event);
  return { status: res.status, json: await res.json(), pending };
}

/** Lets the guard's delay elapse and waits for everything handed to waitUntil. */
async function settle(pending: Promise<unknown>[]) {
  await vi.runAllTimersAsync();
  await Promise.all(pending);
}

const isRemoval = (c: Call) => c.method === "DELETE" && c.url.includes("/workflow/");

describe("POST /api/appointment/[eventId]/cancel", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout"] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cancels, then takes the contact out of A-102-3 after the response", async () => {
    const { fetchStub, calls } = crm();
    const { status, json, pending } = await cancel(fetchStub);
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });
    // Nothing removed yet: the response does not wait on the guard.
    expect(calls.some(isRemoval)).toBe(false);

    await settle(pending);
    const cancelAt = calls.findIndex((c) => c.method === "PUT");
    const removeAt = calls.findIndex(isRemoval);
    expect(cancelAt).toBeGreaterThanOrEqual(0);
    expect(removeAt).toBeGreaterThan(cancelAt);
    expect(calls[removeAt]?.url).toContain(
      `/contacts/contact_1/workflow/${GHL_WORKFLOW_APPOINTMENT_BOOKED}`,
    );
  });

  it("does not run the guard when the cancel fails", async () => {
    // The appointment is still standing, so A-102-3 must keep reminding them.
    const { fetchStub, calls } = crm({ cancelStatus: 500 });
    const { status, pending } = await cancel(fetchStub);
    expect(status).toBe(502);
    await settle(pending);
    expect(calls.some(isRemoval)).toBe(false);
  });

  it("keeps the cancel a success when the removal fails, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchStub } = crm({ removeStatus: 500 });
    const { status, json, pending } = await cancel(fetchStub);
    await settle(pending);
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(
      error.mock.calls.some((args) => String(args[0]).includes("A-102-3 removal failed")),
    ).toBe(true);
  });
});
