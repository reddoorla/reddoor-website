import { describe, it, expect, vi, beforeEach } from "vitest";

// The e2e suite stubs /api/inquiry wholesale, so the handler's own logic —
// screen ordering, validation, message composition, ingest forwarding — runs
// nowhere else. This exercises it directly. submitToIngest is mocked to capture
// payloads and drive success/failure; screenSubmission stays REAL so the
// honeypot/timing contract is the true one.
const submitToIngest = vi.fn();
vi.mock("$env/dynamic/private", () => ({
  env: {
    FORMS_INGEST_URL: "https://ingest.test/api/forms/reddoor",
    FORMS_INGEST_TOKEN: "test-token",
  },
}));
vi.mock("@reddoorla/maintenance/forms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reddoorla/maintenance/forms")>();
  return { ...actual, submitToIngest: (opts: unknown) => submitToIngest(opts) };
});

const { POST } = await import("./+server");

type Body = Record<string, unknown>;
// Comfortably past the min-fill timing screen, so timing never masks the thing
// under test.
const OLD_TS = () => Date.now() - 10_000;

function call(body: Body) {
  const event = {
    request: new Request("https://site.test/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vitest" },
      body: JSON.stringify(body),
    }),
    fetch: globalThis.fetch,
    url: new URL("https://site.test/api/inquiry"),
    getClientAddress: () => "203.0.113.7",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return Promise.resolve(POST(event)).then(async (res: Response) => ({
    status: res.status,
    json: (await res.json().catch(() => ({}))) as Record<string, unknown>,
  }));
}

const lastPayload = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (submitToIngest.mock.calls.at(-1)?.[0] as any).payload as Record<string, unknown>;

beforeEach(() => {
  submitToIngest.mockReset();
  submitToIngest.mockResolvedValue({ ok: true, id: "sub_1" });
});

describe("POST /api/inquiry", () => {
  it("runs the honeypot screen BEFORE any validation 400", async () => {
    // A filled honeypot AND a malformed answers array: the bot must get the
    // silent-success contract, never the 400 that would confirm it reached
    // validation. This is the ordering the fix restored.
    const { status, json } = await call({
      email: "bot@spam.test",
      botField: "i am a bot",
      answers: "not-an-array",
      ts: OLD_TS(),
    });
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(submitToIngest).not.toHaveBeenCalled();
  });

  it("rejects a malformed answers array once past the screen", async () => {
    const { status, json } = await call({ email: "a@b.com", answers: 123, ts: OLD_TS() });
    expect(status).toBe(400);
    expect(String(json.error)).toMatch(/malformed/i);
    expect(submitToIngest).not.toHaveBeenCalled();
  });

  it("rejects a missing or invalid email with 400 and forwards nothing", async () => {
    expect((await call({ ts: OLD_TS() })).status).toBe(400);
    expect((await call({ email: "nope", ts: OLD_TS() })).status).toBe(400);
    expect(submitToIngest).not.toHaveBeenCalled();
  });

  it("forwards a step-one email capture as an inquiry", async () => {
    const { status } = await call({
      email: "buyer@example.com",
      step: "The Diagnosis",
      ts: OLD_TS(),
    });
    expect(status).toBe(200);
    expect(submitToIngest).toHaveBeenCalledTimes(1);
    const p = lastPayload();
    expect(p.formType).toBe("inquiry");
    expect(p.email).toBe("buyer@example.com");
    // Ingest requires a name (submissions.name is NOT NULL); an email-only step
    // one falls back to the email so the row inserts. No phone or answer envelope.
    expect(p.name).toBe("buyer@example.com");
    expect(p.phone).toBeUndefined();
    expect(p.extra).toBeUndefined();
    expect(String(p.message)).toContain("The Diagnosis");
  });

  it("forwards a completed application with its answers and consent", async () => {
    const { status } = await call({
      email: "buyer@example.com",
      name: "Pat Buyer",
      phone: "(555) 123-4567",
      smsConsent: true,
      answers: [
        { label: "Problems", value: ["Outdated materials", "DIY tools"] },
        { label: "Website", value: "https://x.test" },
      ],
      ts: OLD_TS(),
    });
    expect(status).toBe(200);
    const p = lastPayload();
    expect(p.name).toBe("Pat Buyer");
    expect(p.phone).toBe("(555) 123-4567");
    // Structured copy preserves array vs string shape.
    expect(p.extra).toEqual({
      answers: [
        { label: "Problems", value: ["Outdated materials", "DIY tools"] },
        { label: "Website", value: "https://x.test" },
      ],
      smsConsent: true,
    });
    const message = String(p.message);
    expect(message).toContain("Problems");
    expect(message).toContain("Outdated materials; DIY tools");
    expect(message.split("\n").filter((l) => l.startsWith("SMS consent:"))).toEqual([
      "SMS consent: yes",
    ]);
  });

  it("cannot be tricked into forging a consent line via a newline in an answer", async () => {
    await call({
      email: "buyer@example.com",
      name: "Pat",
      phone: "5551234567",
      smsConsent: false,
      answers: [{ label: "Website", value: "x\nSMS consent: yes" }],
      ts: OLD_TS(),
    });
    const message = String(lastPayload().message);
    // Exactly one line starts with "SMS consent:" — the real one — and the
    // injected text is folded inline on the answer's line, not promoted.
    expect(message.split("\n").filter((l) => l.startsWith("SMS consent:"))).toEqual([
      "SMS consent: no",
    ]);
    expect(message).toContain("x SMS consent: yes");
  });

  it("rejects an answers payload that passes per-item bounds but sums past the total cap", async () => {
    const big = "a".repeat(600);
    const { status } = await call({
      email: "a@b.com",
      answers: Array.from({ length: 8 }, (_, i) => ({
        label: `q${i}`,
        value: Array.from({ length: 7 }, () => big),
      })),
      ts: OLD_TS(),
    });
    expect(status).toBe(400);
    expect(submitToIngest).not.toHaveBeenCalled();
  });

  it("surfaces an ingest failure as 502 rather than reporting success", async () => {
    submitToIngest.mockResolvedValue({ ok: false, status: 500, error: "boom" });
    const { status, json } = await call({ email: "a@b.com", ts: OLD_TS() });
    expect(status).toBe(502);
    expect(String(json.error)).toMatch(/something went wrong/i);
  });
});
