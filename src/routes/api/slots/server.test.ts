import { describe, it, expect, vi, beforeEach } from "vitest";

// This endpoint had no test, and the gap cost something real: the no-param
// default resolved to ONE day instead of fourteen, because `Number(null)` is 0
// rather than NaN and the lower clamp made that look like data. /schedule
// therefore only ever offered today's remaining slots. These pin the window
// arithmetic; fetchFreeSlots itself is covered in $lib/ghl/booking.test.ts.
const fetchFreeSlots = vi.fn();
vi.mock("$env/dynamic/private", () => ({ env: { CRM_FUNNEL_ACTIVE_TOKEN: "test-token" } }));
vi.mock("$lib/ghl/booking", () => ({ fetchFreeSlots: (o: unknown) => fetchFreeSlots(o) }));

const { GET } = await import("./+server");

const DAY_MS = 86_400_000;

function call(query = "") {
  const event = {
    fetch: globalThis.fetch,
    url: new URL(`https://site.test/api/slots${query}`),
    setHeaders: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return Promise.resolve(GET(event)).then(async (res: Response) => ({
    status: res.status,
    body: await res.json(),
  }));
}

/** The window width the handler asked the CRM for, in whole days. */
function requestedDays() {
  const { startDate, endDate } = fetchFreeSlots.mock.calls[0][0];
  return Math.round((endDate - startDate) / DAY_MS);
}

beforeEach(() => {
  fetchFreeSlots.mockReset();
  fetchFreeSlots.mockResolvedValue({ ok: true, data: [] });
});

describe("/api/slots window", () => {
  it("defaults to a fourteen-day window when no param is given", async () => {
    await call();
    expect(requestedDays()).toBe(14);
  });

  it("treats an empty or non-numeric days param as absent", async () => {
    await call("?days=");
    expect(requestedDays()).toBe(14);
    fetchFreeSlots.mockClear();
    await call("?days=soon");
    expect(requestedDays()).toBe(14);
  });

  it("honours an explicit window", async () => {
    await call("?days=3");
    expect(requestedDays()).toBe(3);
  });

  it("rejects nonsense low values by falling back rather than asking for zero days", async () => {
    await call("?days=0");
    expect(requestedDays()).toBe(14);
    fetchFreeSlots.mockClear();
    await call("?days=-5");
    expect(requestedDays()).toBe(14);
  });

  it("caps an absurd window rather than asking the CRM for a year", async () => {
    await call("?days=9999");
    expect(requestedDays()).toBe(31);
  });

  it("starts the window now, so slots already past today are gone", async () => {
    const before = Date.now();
    await call();
    const { startDate } = fetchFreeSlots.mock.calls[0][0];
    expect(startDate).toBeGreaterThanOrEqual(before);
    expect(startDate).toBeLessThanOrEqual(Date.now());
  });
});

describe("/api/slots response", () => {
  it("flattens days into one list sorted by instant, not by string", async () => {
    // Two slots whose lexical order disagrees with their real order, which is
    // what happens either side of a DST change.
    fetchFreeSlots.mockResolvedValue({
      ok: true,
      data: [
        { date: "2026-08-19", slots: ["2026-08-19T09:00:00-06:00"] },
        { date: "2026-08-18", slots: ["2026-08-18T23:30:00-05:00"] },
      ],
    });
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.slots).toEqual(["2026-08-18T23:30:00-05:00", "2026-08-19T09:00:00-06:00"]);
  });

  it("reports a CRM failure as a 502 rather than an empty calendar", async () => {
    // An empty list would render as "nothing open", quietly telling a visitor
    // there are no times when in fact the lookup failed.
    fetchFreeSlots.mockResolvedValue({ ok: false, status: 500, error: "boom" });
    const { status, body } = await call();
    expect(status).toBe(502);
    expect(body.error).toMatch(/couldn't load/i);
  });
});
