import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/meta-event: the server half of the MedTech funnel's Meta Pixel. The
// browser posts here once per pixel event it tracks; this forwards it to the
// Conversions API. Graph is stubbed through the event's `fetch`, so what Meta
// would receive is what these assertions read.

const env = vi.hoisted(() => ({
  META_CAPI_ACCESS_TOKEN: "test-token" as string | undefined,
  META_CAPI_TEST_EVENT_CODE: undefined as string | undefined,
}));
vi.mock("$app/env/private", () => env);

const { POST } = await import("./+server");

const EVENT_ID = "4f1c2a9e-7b1d-4c55-9a0e-1f2e3d4c5b6a";
const ORIGIN = "https://reddoorla.com";

const good = () => ({
  event_name: "PageView",
  event_id: EVENT_ID,
  event_source_url: `${ORIGIN}/medtech`,
  consent: "accepted",
});

let graph: ReturnType<typeof vi.fn>;

function call(body: unknown, cookies: Record<string, string> = {}) {
  const event = {
    request: new Request(`${ORIGIN}/api/meta-event`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "Mozilla/5.0 (vitest)" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    url: new URL(`${ORIGIN}/api/meta-event`),
    fetch: graph,
    getClientAddress: () => "203.0.113.7",
    cookies: { get: (name: string) => cookies[name] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return Promise.resolve(POST(event));
}

/** The one event Meta received. */
function sentEvent() {
  expect(graph).toHaveBeenCalledTimes(1);
  const init = graph.mock.calls[0][1] as RequestInit;
  return JSON.parse(String(init.body)).data[0];
}

beforeEach(() => {
  env.META_CAPI_ACCESS_TOKEN = "test-token";
  env.META_CAPI_TEST_EVENT_CODE = undefined;
  graph = vi.fn(async () => new Response('{"events_received":1}', { status: 200 }));
});

describe("POST /api/meta-event", () => {
  it("forwards a consented PageView with the browser's event_id, request data and Meta cookies", async () => {
    const res = await call(good(), {
      _fbp: "fb.1.1794000000000.123456789",
      _fbc: "fb.1.1794000000000.AbCdEf",
    });
    expect(res.status).toBe(204);
    const ev = sentEvent();
    expect(ev.event_id).toBe(EVENT_ID);
    expect(ev).toMatchObject({
      event_name: "PageView",
      action_source: "website",
      event_source_url: `${ORIGIN}/medtech`,
      user_data: {
        client_ip_address: "203.0.113.7",
        client_user_agent: "Mozilla/5.0 (vitest)",
        fbp: "fb.1.1794000000000.123456789",
        fbc: "fb.1.1794000000000.AbCdEf",
      },
    });
    expect(Math.abs(ev.event_time - Date.now() / 1000)).toBeLessThan(60);
  });

  it.each([["rejected"], [null], [undefined], ["true"]])(
    "sends nothing to Meta when consent is %j",
    async (consent) => {
      const res = await call({ ...good(), consent });
      expect(res.status).toBe(204);
      expect(graph).not.toHaveBeenCalled();
    },
  );

  it("sends nothing and does not throw when the access token is unset", async () => {
    env.META_CAPI_ACCESS_TOKEN = undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await call(good());
    expect(res.status).toBe(204);
    expect(graph).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes the Test Events code through when it is set", async () => {
    env.META_CAPI_TEST_EVENT_CODE = "TEST123";
    await call(good());
    const init = graph.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).test_event_code).toBe("TEST123");
  });

  it("ignores any email or phone in the body: a PageView carries no customer data", async () => {
    await call({ ...good(), email: "tim@example.com", phone: "3105550142" });
    const ud = sentEvent().user_data;
    expect(ud).not.toHaveProperty("em");
    expect(ud).not.toHaveProperty("ph");
  });

  it.each([
    ["an event the browser pixel does not send", { event_name: "Purchase" }],
    ["a missing event_id", { event_id: undefined }],
    ["a malformed event_id", { event_id: "<script>" }],
    ["a page off the funnel", { event_source_url: `${ORIGIN}/boise` }],
    ["another site's page", { event_source_url: "https://evil.test/medtech" }],
    ["a URL that does not parse", { event_source_url: "not a url" }],
  ])("refuses %s and sends nothing", async (_label, patch) => {
    const res = await call({ ...good(), ...patch });
    expect(res.status).toBe(400);
    expect(graph).not.toHaveBeenCalled();
  });

  it("refuses a body that is not JSON", async () => {
    const res = await call("{nope");
    expect(res.status).toBe(400);
    expect(graph).not.toHaveBeenCalled();
  });

  it("drops a cookie that is not Meta's format instead of forwarding it", async () => {
    await call(good(), { _fbp: "x".repeat(500), _fbc: "fb.1.1794000000000.AbCdEf" });
    const ud = sentEvent().user_data;
    expect(ud).not.toHaveProperty("fbp");
    expect(ud.fbc).toBe("fb.1.1794000000000.AbCdEf");
  });

  it("still answers 204 when Meta is down", async () => {
    graph = vi.fn(async () => {
      throw new Error("down");
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(good());
    expect(res.status).toBe(204);
    error.mockRestore();
  });
});
