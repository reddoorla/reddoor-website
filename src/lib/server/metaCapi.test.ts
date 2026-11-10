import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Conversions API sender ($lib/server/metaCapi). What Meta receives is the
// contract: the request is asserted as Meta would read it, against a stubbed
// Graph endpoint, so nothing here reaches facebook.com.

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const EVENT = {
  eventName: "PageView",
  eventId: "4f1c2a9e-7b1d-4c55-9a0e-1f2e3d4c5b6a",
  eventSourceUrl: "https://reddoorla.com/medtech",
  eventTime: 1_794_000_000,
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 (test)",
  fbp: "fb.1.1794000000000.123456789",
};

function graphStub(status = 200) {
  return vi.fn(async (..._args: unknown[]) => new Response('{"events_received":1}', { status }));
}

/** A fresh module, so the "log once" state starts clean in every test. */
async function load() {
  vi.resetModules();
  return import("./metaCapi");
}

const log = { warn: vi.fn(), error: vi.fn() };
beforeEach(() => {
  log.warn.mockReset();
  log.error.mockReset();
});

describe("customer data normalisation and hashing", () => {
  it("hashes the email after trimming and lower-casing it", async () => {
    const { buildPayload } = await load();
    const { data } = buildPayload({ ...EVENT, email: "  Tim.Person@Example.COM " });
    expect(data[0].user_data.em).toEqual([sha("tim.person@example.com")]);
  });

  it("hashes the phone as digits only, with the US country code when none is given", async () => {
    const { buildPayload } = await load();
    expect(buildPayload({ ...EVENT, phone: "(310) 555-0142" }).data[0].user_data.ph).toEqual([
      sha("13105550142"),
    ]);
    expect(buildPayload({ ...EVENT, phone: "+1 310.555.0142" }).data[0].user_data.ph).toEqual([
      sha("13105550142"),
    ]);
    expect(buildPayload({ ...EVENT, phone: "+44 20 7946 0958" }).data[0].user_data.ph).toEqual([
      sha("442079460958"),
    ]);
  });

  it("drops a phone whose country it cannot tell rather than hash a wrong number", async () => {
    const { buildPayload } = await load();
    // A UK number written domestically: stripping its 0 would leave ten digits
    // that read as a (wrong) US number.
    const ud = buildPayload({ ...EVENT, phone: "020 7946 0958" }).data[0].user_data;
    expect(ud).not.toHaveProperty("ph");
    expect(buildPayload({ ...EVENT, phone: "1 310 555 0142" }).data[0].user_data.ph).toEqual([
      sha("13105550142"),
    ]);
  });

  it("never sends the raw email or phone, and sends neither when there is none", async () => {
    const { buildPayload } = await load();
    const withPii = JSON.stringify(
      buildPayload({ ...EVENT, email: "tim@example.com", phone: "3105550142" }),
    );
    expect(withPii).not.toContain("tim@example.com");
    expect(withPii).not.toContain("3105550142");

    const ud = buildPayload(EVENT).data[0].user_data;
    expect(ud).not.toHaveProperty("em");
    expect(ud).not.toHaveProperty("ph");
  });

  it("passes IP, user agent and the _fbp/_fbc cookies unhashed, as Meta requires", async () => {
    const { buildPayload } = await load();
    const ud = buildPayload({ ...EVENT, fbc: "fb.1.1794000000000.AbCdEf" }).data[0].user_data;
    expect(ud).toMatchObject({
      client_ip_address: EVENT.ip,
      client_user_agent: EVENT.userAgent,
      fbp: EVENT.fbp,
      fbc: "fb.1.1794000000000.AbCdEf",
    });
  });
});

describe("sendMetaEvent", () => {
  it("posts one website event to Tim's pixel with the caller's event_id", async () => {
    const { sendMetaEvent, GRAPH_API_VERSION } = await load();
    const { META_PIXEL_ID } = await import("$lib/consent/metaPixel");
    const fetch = graphStub();

    const result = await sendMetaEvent(EVENT, { fetch, token: "tkn", log });

    expect(result).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`,
    );
    // In the body, not the URL, so no log of request URLs can ever hold it.
    expect(u.search).toBe("");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init.body));
    expect(body.access_token).toBe("tkn");
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      event_name: "PageView",
      event_id: EVENT.eventId,
      event_time: EVENT.eventTime,
      action_source: "website",
      event_source_url: EVENT.eventSourceUrl,
    });
    expect(body).not.toHaveProperty("test_event_code");
  });

  it("adds test_event_code at the top level only when one is set", async () => {
    const { sendMetaEvent } = await load();
    const fetch = graphStub();
    await sendMetaEvent(EVENT, { fetch, token: "tkn", testEventCode: "TEST123", log });
    const body = JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.test_event_code).toBe("TEST123");
  });

  it.each([undefined, ""])(
    "with no token (%j) it makes no call, does not throw, and logs once",
    async (token) => {
      const { sendMetaEvent } = await load();
      const fetch = graphStub();
      await expect(sendMetaEvent(EVENT, { fetch, token, log })).resolves.toBe("skipped");
      await expect(sendMetaEvent(EVENT, { fetch, token, log })).resolves.toBe("skipped");
      expect(fetch).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledTimes(1);
    },
  );

  it("never throws when Meta errors or the network fails; it logs instead", async () => {
    const { sendMetaEvent } = await load();
    await expect(sendMetaEvent(EVENT, { fetch: graphStub(400), token: "tkn", log })).resolves.toBe(
      "failed",
    );
    const down = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(sendMetaEvent(EVENT, { fetch: down, token: "tkn", log })).resolves.toBe("failed");
    expect(log.error).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("tkn");
  });
});
