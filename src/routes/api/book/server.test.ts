import { describe, it, expect, vi, beforeEach } from "vitest";

// The booking handler's own logic runs nowhere else — the smoke suite stubs
// /api/book wholesale. This drives it directly against a fetch stub standing in
// for the CRM, so the ordering (contact → appointment → tag → ingest) and the
// phone-conflict handling are exercised for real. screenSubmission stays REAL.
const submitToIngest = vi.fn();
vi.mock("$env/dynamic/private", () => ({
  env: {
    CRM_FUNNEL_ACTIVE_TOKEN: "crm-token",
    FORMS_INGEST_URL: "https://ingest.test/api/forms/reddoor",
    FORMS_INGEST_TOKEN: "test-token",
  },
}));
vi.mock("@reddoorla/maintenance/forms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reddoorla/maintenance/forms")>();
  return { ...actual, submitToIngest: (opts: unknown) => submitToIngest(opts) };
});

const { POST } = await import("./+server");

type Call = { url: string; method: string; body: Record<string, unknown> };

/**
 * A CRM whose contact upsert returns whatever phone we tell it to. Returning an
 * EMPTY phone is the case under test: GHL does exactly that, on a clean 200,
 * when the number already sits on a different contact.
 */
function crm(opts: { storedPhone?: string; noteOk?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchStub = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let body: Record<string, unknown> = {};
    try {
      body = init?.body ? JSON.parse(String(init.body)) : {};
    } catch {
      /* not json */
    }
    calls.push({ url, method, body });

    // Order matters: /notes is a sub-path of /contacts, so it is matched first.
    if (url.includes("/notes")) {
      return new Response(JSON.stringify({ note: { id: "note_1" } }), {
        status: opts.noteOk === false ? 500 : 201,
      });
    }
    if (url.includes("/tags")) return new Response(JSON.stringify({ tags: [] }), { status: 200 });
    if (url.includes("/calendars/events/appointments")) {
      return new Response(JSON.stringify({ id: "appt_1", startTime: "2026-08-21T15:30:00Z" }), {
        status: 201,
      });
    }
    if (url.includes("/contacts/upsert")) {
      return new Response(
        JSON.stringify({
          contact: { id: "contact_1", ...(opts.storedPhone ? { phone: opts.storedPhone } : {}) },
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof globalThis.fetch;
  return { fetchStub, calls };
}

function call(body: Record<string, unknown>, fetchStub: typeof globalThis.fetch) {
  const event = {
    request: new Request("https://site.test/api/book", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
    fetch: fetchStub,
    url: new URL("https://site.test/api/book"),
    getClientAddress: () => "203.0.113.7",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return Promise.resolve(POST(event)).then(async (res: Response) => ({
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  }));
}

const BOOKING = () => ({
  email: "pat@example.com",
  name: "Pat Buyer",
  phone: "(310) 555-0101",
  startTime: "2026-08-21T15:30:00Z",
  ts: Date.now() - 10_000,
  testMode: true,
});

beforeEach(() => {
  submitToIngest.mockReset();
  submitToIngest.mockResolvedValue({ ok: true, id: "sub_1" });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a phone the CRM silently refuses to store", () => {
  it("writes the number into a note so the record a human opens still has it", async () => {
    // Measured on a real staging booking: the visitor typed a phone, the
    // contact saved without one, and the CRM's reminder note read "Phone:  |
    // Email: …". A console line was the whole response, so the person Tim
    // would ring before the call had nothing to ring.
    const { fetchStub, calls } = crm({ storedPhone: "" });
    const { status } = await call(BOOKING(), fetchStub);
    expect(status).toBe(200);

    const note = calls.find((c) => c.url.includes("/notes"));
    expect(note, "a note should have been written").toBeDefined();
    expect(String(note?.body.body)).toContain("(310) 555-0101");
    expect(String(note?.body.body)).toContain("already on another record");
  });

  it("writes no note when the number did land", async () => {
    const { fetchStub, calls } = crm({ storedPhone: "+13105550101" });
    await call(BOOKING(), fetchStub);
    expect(calls.find((c) => c.url.includes("/notes"))).toBeUndefined();
  });

  it("writes no note when no number was given at all", async () => {
    // phoneWasDropped is false for an empty submission — nothing was lost, so a
    // note saying so would be noise on every phone-less booking.
    const { fetchStub, calls } = crm({ storedPhone: "" });
    await call({ ...BOOKING(), phone: "" }, fetchStub);
    expect(calls.find((c) => c.url.includes("/notes"))).toBeUndefined();
  });

  it("still books when the note itself fails", async () => {
    // The appointment is what the visitor came for. A note that will not write
    // is not a reason to fail it.
    const { fetchStub, calls } = crm({ storedPhone: "", noteOk: false });
    const { status, json } = await call(BOOKING(), fetchStub);
    expect(status).toBe(200);
    expect(json.error).toBeUndefined();
    expect(calls.some((c) => c.url.includes("/calendars/events/appointments"))).toBe(true);
  });

  it("books the appointment even so, and in the right order", async () => {
    // The contact must exist before an appointment can reference it, and the
    // note must not come between them.
    const { fetchStub, calls } = crm({ storedPhone: "" });
    await call(BOOKING(), fetchStub);
    const at = (frag: string) => calls.findIndex((c) => c.url.includes(frag));
    expect(at("/contacts/upsert")).toBeLessThan(at("/calendars/events/appointments"));
    expect(at("/calendars/events/appointments")).toBeGreaterThan(-1);
  });
});
