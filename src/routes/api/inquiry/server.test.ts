import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

// The e2e suite stubs /api/inquiry wholesale, so the handler's own logic —
// screen ordering, validation, message composition, ingest forwarding — runs
// nowhere else. This exercises it directly. submitToIngest is mocked to capture
// payloads and drive success/failure; screenSubmission stays REAL so the
// honeypot/timing contract is the true one.
const submitToIngest = vi.fn();
// Mutable per test: the Conversions API token and test code are read at call
// time through getters, so a test can unset the token without re-mocking.
const metaEnv = vi.hoisted(() => ({
  META_CAPI_ACCESS_TOKEN: "test-token" as string | undefined,
  META_CAPI_TEST_EVENT_CODE: undefined as string | undefined,
  // Unset by default, as it was under $env/dynamic: the CRM sync stays off in
  // every test except the ones that set it.
  CRM_FUNNEL_ACTIVE_TOKEN: undefined as string | undefined,
}));
vi.mock("$app/env/private", () => ({
  FORMS_INGEST_URL: "https://ingest.test/api/forms/reddoor",
  FORMS_INGEST_TOKEN: "test-token",
  get CRM_FUNNEL_ACTIVE_TOKEN() {
    return metaEnv.CRM_FUNNEL_ACTIVE_TOKEN;
  },
  get META_CAPI_ACCESS_TOKEN() {
    return metaEnv.META_CAPI_ACCESS_TOKEN;
  },
  get META_CAPI_TEST_EVENT_CODE() {
    return metaEnv.META_CAPI_TEST_EVENT_CODE;
  },
}));
vi.mock("@reddoorla/maintenance/forms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reddoorla/maintenance/forms")>();
  return { ...actual, submitToIngest: (opts: unknown) => submitToIngest(opts) };
});
// The CRM client, replaced whole: each sync resolves to a contact unless a test
// swaps in its own implementation (to make the CRM slow, say).
const crm = vi.hoisted(() => ({
  application: vi.fn(async (_opts: unknown) => ({ ok: true, data: { contactId: "c1" } })),
  inquiry: vi.fn(async (_opts: unknown) => ({ ok: true, data: { contactId: "c1" } })),
}));
vi.mock("$lib/ghl/client", () => ({
  syncApplicationToCrm: (opts: unknown) => crm.application(opts),
  syncInquiryToCrm: (opts: unknown) => crm.inquiry(opts),
}));

// The page's step titles, as Prismic serves them. A rejected lookup stands in
// for an outage, a `page`-type campaign, or an unknown uid.
const getByUID = vi.fn();
vi.mock("$lib/prismicio", () => ({ createClient: () => ({ getByUID }) }));
const industryDoc = (titles: string[]) => ({
  data: {
    slices: [
      {
        slice_type: "text_columns",
        variation: "iconColumns",
        primary: { columns: titles.map((title) => ({ title })) },
      },
    ],
  },
});

const { POST } = await import("./+server");
const { questionsFor } = await import("$lib/ghl/questions");
const { DEFAULT_INQUIRY_SURVEY_ID } = await import("$lib/ghl/constants");

type Body = Record<string, unknown>;
// Comfortably past the min-fill timing screen, so timing never masks the thing
// under test.
const OLD_TS = () => Date.now() - 10_000;

/** Graph is stubbed through the event's fetch; ingest and the CRM never use it. */
let graph: ReturnType<typeof vi.fn>;

function call(
  body: Body,
  opts: {
    cookies?: Record<string, string>;
    /** Replaces the cookie jar outright, for a test that makes reading it throw. */
    cookieJar?: { get: (name: string) => string | undefined };
    userAgent?: string | null;
  } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.userAgent !== null) headers["user-agent"] = opts.userAgent ?? "vitest";
  const event = {
    request: new Request("https://site.test/api/inquiry", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    fetch: graph,
    url: new URL("https://site.test/api/inquiry"),
    getClientAddress: () => "203.0.113.7",
    cookies: opts.cookieJar ?? { get: (name: string) => opts.cookies?.[name] },
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
  getByUID.mockReset();
  getByUID.mockRejectedValue(new Error("no such document"));
  submitToIngest.mockReset();
  submitToIngest.mockResolvedValue({ ok: true, id: "sub_1" });
  metaEnv.META_CAPI_ACCESS_TOKEN = "test-token";
  metaEnv.META_CAPI_TEST_EVENT_CODE = undefined;
  metaEnv.CRM_FUNNEL_ACTIVE_TOKEN = undefined;
  crm.application.mockClear();
  crm.inquiry.mockClear();
  graph = vi.fn(async () => new Response(null, { status: 200 }));
});

/** Calls the Conversions API (Graph) made by this request, if any. */
const graphCalls = () =>
  graph.mock.calls.filter(([u]) => String(u).startsWith("https://graph.facebook.com/"));
/** The one event Meta received. */
const sentEvent = () => {
  expect(graphCalls()).toHaveLength(1);
  const init = graphCalls()[0][1] as RequestInit;
  return JSON.parse(String(init.body)).data[0];
};

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
    // one falls back to the email so the row inserts. No phone or answers.
    expect(p.name).toBe("buyer@example.com");
    expect(p.phone).toBeUndefined();
    expect(p.extra).not.toHaveProperty("answers");
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
      composedMessage: true,
      visitorText: expect.any(String),
    });
    const message = String(p.message);
    expect(message).toContain("Problems");
    expect(message).toContain("Outdated materials; DIY tools");
    expect(message.split("\n").filter((l) => l.startsWith("SMS consent:"))).toEqual([
      "SMS consent: yes",
    ]);
  });

  // Step one is the same sentence for every visitor and every application
  // repeats the same question labels, so central ingest's fleet duplicate-body
  // scan read every lead after the first in 30 days as a spray. The flag says
  // the message is this endpoint's template; ingest honours it only on a
  // Turnstile-gated site with a passing token (2026-11-03).
  it("marks both submits' message as site-composed, so ingest skips the duplicate scan", async () => {
    await call({ email: "a@b.com", step: "The Diagnosis", ts: OLD_TS() });
    expect((lastPayload().extra as Record<string, unknown>).composedMessage).toBe(true);
    await call({
      email: "a@b.com",
      name: "Ada",
      phone: "5551234567",
      answers: [{ label: "Q", value: "A" }],
      ts: OLD_TS(),
    });
    expect((lastPayload().extra as Record<string, unknown>).composedMessage).toBe(true);
    expect(submitToIngest).toHaveBeenCalledTimes(2);
  });

  // On the verified path ingest scans only what the visitor typed, so this is
  // the spray check's whole input: the survey's own headings and options must
  // stay out of it (they repeat for everyone), everything else must be in it.
  it("sends what the visitor typed as visitorText, never the survey's own wording", async () => {
    const q = questionsFor(DEFAULT_INQUIRY_SURVEY_ID)!;
    const problems = q.find((x) => x.kind === "checkbox")!;
    const website = q.find((x) => x.kind === "text")!;
    const option = problems.kind === "checkbox" ? problems.options[0]! : "";
    await call({
      email: "a@b.com",
      name: "Ada",
      phone: "5551234567",
      step: "The Diagnosis",
      answers: [
        { label: problems.heading, value: [option] },
        { label: website.heading, value: "https://ada.example" },
      ],
      ts: OLD_TS(),
    });
    const visitorText = String((lastPayload().extra as Record<string, unknown>).visitorText);
    expect(visitorText.split("\n")).toEqual(["The Diagnosis", "https://ada.example"]);
    expect(String(lastPayload().message)).toContain(option);
  });

  it("puts a forged label or option into visitorText, where ingest scans it", async () => {
    const q = questionsFor(DEFAULT_INQUIRY_SURVEY_ID)!;
    await call({
      email: "a@b.com",
      name: "Bot",
      answers: [
        { label: q[0]!.heading, value: ["Buy ten thousand backlinks today"] },
        { label: "Cheap SEO, reply now", value: "x" },
      ],
      ts: OLD_TS(),
    });
    const visitorText = String((lastPayload().extra as Record<string, unknown>).visitorText);
    expect(visitorText).toContain("Buy ten thousand backlinks today");
    expect(visitorText).toContain("Cheap SEO, reply now");
  });

  // A step title is the page's own text, the same for every visitor. If it were
  // counted as typed, a title of 40+ characters would make every lead on that
  // page an exact duplicate of the last (review round 2).
  // Prismic holds every live title with a trailing colon ("The Diagnosis:"), and
  // the modal sends it without (InquiryModal's stepLabel). Round 3 found the
  // check compared the two raw and so never matched production content.
  it("leaves a step that is one of the page's own step titles out of visitorText", async () => {
    const title = "Diagnose what is really holding your brand back";
    getByUID.mockResolvedValue(industryDoc([`${title}:`, "The Rollout:"]));
    await call({ email: "a@b.com", step: title, campaign: "medtech", ts: OLD_TS() });
    expect(getByUID).toHaveBeenCalledWith("industry", "medtech");
    expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("");
    expect(String(lastPayload().message)).toContain(title);
  });

  it("leaves the production step titles out of visitorText, colon or not", async () => {
    // "The Rollout: " — a stray space after the colon, as a content edit leaves it.
    getByUID.mockResolvedValue(industryDoc(["The Diagnosis:", "The Rebuild:", "The Rollout: "]));
    for (const step of ["The Diagnosis", "The Rebuild:", " The Rollout "]) {
      await call({ email: "a@b.com", step, campaign: "medtech", ts: OLD_TS() });
      expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("");
    }
  });

  it("reads step titles only from the icon-columns slice", async () => {
    getByUID.mockResolvedValue({
      data: {
        slices: [
          {
            slice_type: "text_columns",
            variation: "default",
            primary: { columns: [{ title: "Buy backlinks now:" }] },
          },
        ],
      },
    });
    await call({ email: "a@b.com", step: "Buy backlinks now", campaign: "medtech", ts: OLD_TS() });
    expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("Buy backlinks now");
  });

  it("puts no blank line in visitorText for an unanswered question", async () => {
    await call({
      email: "a@b.com",
      name: "Ada",
      surveyId: "no-such-survey",
      answers: [
        { label: "Q1", value: "" },
        { label: "Q2", value: ["", "A"] },
      ],
      ts: OLD_TS(),
    });
    expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("Q1\nQ2\nA");
  });

  it("counts a step the page does not have as typed", async () => {
    getByUID.mockResolvedValue(industryDoc(["The Diagnosis"]));
    await call({ email: "a@b.com", step: "Buy backlinks now", campaign: "medtech", ts: OLD_TS() });
    expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("Buy backlinks now");
  });

  it("counts the step as typed when the page's steps cannot be read, and still forwards the lead", async () => {
    await call({ email: "a@b.com", step: "The Diagnosis", campaign: "medtech", ts: OLD_TS() });
    expect(submitToIngest).toHaveBeenCalledTimes(1);
    expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("The Diagnosis");
  });

  it("forwards a lead whose surveyId is an Object prototype key, instead of a 500", async () => {
    for (const surveyId of ["constructor", "__proto__", "toString"]) {
      const { status } = await call({
        email: "a@b.com",
        name: "Ada",
        surveyId,
        answers: [{ label: "Q", value: "A" }],
        ts: OLD_TS(),
      });
      expect(status).toBe(200);
      expect((lastPayload().extra as Record<string, unknown>).visitorText).toBe("Q\nA");
    }
  });

  it("counts every answer as typed when the survey id has no question list", async () => {
    await call({
      email: "a@b.com",
      name: "Ada",
      surveyId: "no-such-survey",
      answers: [{ label: "What problems are you experiencing?", value: "Outdated materials" }],
      ts: OLD_TS(),
    });
    const visitorText = String((lastPayload().extra as Record<string, unknown>).visitorText);
    expect(visitorText).toBe("What problems are you experiencing?\nOutdated materials");
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

  // The reddoor site row requires Turnstile, so central ingest stores a
  // submission with no token as spam and emails nobody. /contact forwards its
  // token in `_meta`; this endpoint must do the same or every landing-page lead
  // is lost while the visitor sees success (2026-11-03 forms review).
  it("forwards the Turnstile token in _meta, as /contact does", async () => {
    await call({ email: "a@b.com", turnstileToken: "  0.tok-abc  ", ts: OLD_TS() });
    expect(lastPayload()._meta).toEqual({
      turnstileToken: "0.tok-abc",
      clientIp: "203.0.113.7",
      userAgent: "vitest",
    });
  });

  it("forwards the token on the completed application too", async () => {
    await call({
      email: "a@b.com",
      name: "Ada",
      phone: "5551234567",
      answers: [{ label: "Q", value: "A" }],
      turnstileToken: "0.tok-second",
      ts: OLD_TS(),
    });
    expect((lastPayload()._meta as Record<string, unknown>).turnstileToken).toBe("0.tok-second");
  });

  it("sends no token key when there is none, or when it is absurdly long", async () => {
    await call({ email: "a@b.com", ts: OLD_TS() });
    expect(lastPayload()._meta).not.toHaveProperty("turnstileToken");
    await call({ email: "a@b.com", turnstileToken: "x".repeat(2049), ts: OLD_TS() });
    expect(submitToIngest).toHaveBeenCalledTimes(2);
    expect(lastPayload()._meta).not.toHaveProperty("turnstileToken");
  });
});

describe("Meta Lead (Conversions API)", () => {
  const EVENT_ID = "4f1c2a9e-7b1d-4c55-9a0e-1f2e3d4c5b6a";
  const metaLead = { eventId: EVENT_ID, consent: "accepted" };
  const SOURCE = "https://site.test/medtech?utm_source=x&email=a@b.c";
  const application = (over: Body = {}): Body => ({
    email: " Ann@Example.COM ",
    name: "Ann Example",
    phone: "(310) 555-0123",
    smsConsent: true,
    answers: [{ label: "Problems", value: "Outdated materials" }],
    sourceUrl: SOURCE,
    metaLead,
    turnstileToken: "0.tok",
    ts: OLD_TS(),
    ...over,
  });
  const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

  it("sends one Lead for a completed application, hashed, with no query in the source URL", async () => {
    const { status, json } = await call(application());
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });

    const ev = sentEvent();
    expect(ev).toMatchObject({
      event_name: "Lead",
      event_id: EVENT_ID,
      event_source_url: "https://site.test/medtech",
      action_source: "website",
    });
    expect(ev.user_data.em).toEqual([sha("ann@example.com")]);
    expect(ev.user_data.ph).toEqual([sha("13105550123")]);

    // Neither the raw email nor the raw phone appears anywhere in what Meta gets.
    const wire = String((graphCalls()[0][1] as RequestInit).body);
    for (const raw of ["Ann@Example.COM", "ann@example.com", "(310) 555-0123", "3105550123"]) {
      expect(wire).not.toContain(raw);
    }
  });

  it("sends nothing when metaLead is absent or is not an accepted, well-formed tag", async () => {
    const bad: unknown[] = [
      undefined,
      { eventId: EVENT_ID, consent: "rejected" },
      { eventId: EVENT_ID },
      { eventId: EVENT_ID, consent: "true" },
    ];
    for (const tag of bad) {
      const { status, json } = await call(application({ metaLead: tag }));
      expect(status).toBe(200);
      expect(json).toEqual({ success: true });
    }
    expect(graphCalls()).toHaveLength(0);
  });

  it("sends no Lead for a step-one email capture, even with a valid metaLead", async () => {
    // From a funnel page, so the funnel check passes and only the step-one rule
    // stands between this post and a Lead.
    await call({
      email: "buyer@example.com",
      step: "The Diagnosis",
      sourceUrl: SOURCE,
      metaLead,
      ts: OLD_TS(),
    });
    expect(submitToIngest).toHaveBeenCalledTimes(1);
    expect(graphCalls()).toHaveLength(0);
  });

  it("sends no Lead without a user agent, which Meta requires for website events", async () => {
    await call(application(), { userAgent: null });
    expect(submitToIngest).toHaveBeenCalledTimes(1);
    expect(graphCalls()).toHaveLength(0);
  });

  it("sends no Lead when the source is off the funnel or on another origin", async () => {
    await call(application({ sourceUrl: "https://site.test/boise?x=1" }));
    await call(application({ sourceUrl: "https://evil.test/medtech" }));
    expect(graphCalls()).toHaveLength(0);
  });

  it("sends no Lead for a test-mode submission", async () => {
    await call(application({ testMode: true }));
    expect(submitToIngest).toHaveBeenCalledTimes(1);
    expect(graphCalls()).toHaveLength(0);
  });

  it("sends nothing and still succeeds when the token is unset", async () => {
    metaEnv.META_CAPI_ACCESS_TOKEN = undefined;
    const { status, json } = await call(application());
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(graphCalls()).toHaveLength(0);
  });

  it("still answers success when Graph refuses or the request throws", async () => {
    graph.mockResolvedValueOnce(new Response('{"error":{"code":1}}', { status: 500 }));
    const refused = await call(application());
    expect(refused).toEqual({ status: 200, json: { success: true } });

    graph.mockRejectedValueOnce(new Error("socket hang up"));
    const thrown = await call(application());
    expect(thrown).toEqual({ status: 200, json: { success: true } });
    expect(graphCalls()).toHaveLength(2);
  });

  it("sends no Lead when ingest failed", async () => {
    submitToIngest.mockResolvedValueOnce({ ok: false, status: 500, error: "boom" });
    const { status } = await call(application());
    expect(status).toBe(502);
    expect(graphCalls()).toHaveLength(0);
  });

  it.each([["x"], ["a".repeat(65)]])(
    "ignores a malformed event id (%s) without a 400",
    async (id) => {
      const { status, json } = await call(
        application({ metaLead: { eventId: id, consent: "accepted" } }),
      );
      expect(status).toBe(200);
      expect(json).toEqual({ success: true });
      expect(graphCalls()).toHaveLength(0);
    },
  );

  it("forwards the browser's _fbp and _fbc, and drops a malformed one", async () => {
    await call(application(), {
      cookies: { _fbp: "fb.1.1794000000000.123456789", _fbc: "fb.1.1794000000000.AbCdEf" },
    });
    expect(sentEvent().user_data).toMatchObject({
      fbp: "fb.1.1794000000000.123456789",
      fbc: "fb.1.1794000000000.AbCdEf",
    });

    graph.mockClear();
    await call(application(), { cookies: { _fbp: "not-meta" } });
    expect(sentEvent().user_data).not.toHaveProperty("fbp");
  });

  // The browser retries a post whose response was lost, and the modal keeps one
  // Lead id per wizard session, so a retry carries the same metaLead. The server
  // forwards that id unchanged: Meta counts an event_id once within 48 hours.
  it("forwards the same event id on a retried application, so Meta can dedupe it", async () => {
    await call(application());
    await call(application());
    expect(graphCalls()).toHaveLength(2);
    const ids = graphCalls().map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)).data[0].event_id,
    );
    expect(ids).toEqual([EVENT_ID, EVENT_ID]);
  });

  // Central ingest stores a tokenless submission as spam, so a Lead for one was
  // never a real applicant. Requiring the token here also means a bare curl
  // forgery of the endpoint needs a token string to get a Lead out.
  it("sends no Lead without a Turnstile token, and still answers success", async () => {
    for (const turnstileToken of [undefined, ""]) {
      const { status, json } = await call(application({ turnstileToken }));
      expect(status).toBe(200);
      expect(json).toEqual({ success: true });
    }
    expect(submitToIngest).toHaveBeenCalledTimes(2);
    expect(graphCalls()).toHaveLength(0);
  });

  // The Lead is started right after ingest and the CRM sync runs beside it, so
  // the response waits for the longer of the two, not their sum. The CRM here is
  // slow until the Graph call has begun (or a second has passed): a Lead that
  // waits for the CRM would finish after it, and the order would say so.
  it("starts the Lead before the CRM sync finishes, and answers after both", async () => {
    metaEnv.CRM_FUNNEL_ACTIVE_TOKEN = "crm-token";
    const order: string[] = [];
    let graphStarted!: () => void;
    const started = new Promise<void>((resolve) => (graphStarted = resolve));
    crm.application.mockImplementationOnce(async () => {
      await Promise.race([started, new Promise((resolve) => setTimeout(resolve, 1000))]);
      order.push("crm");
      return { ok: true, data: { contactId: "c1" } };
    });
    graph.mockImplementation(async () => {
      order.push("graph");
      graphStarted();
      return new Response(null, { status: 200 });
    });

    const { status, json } = await call(application());
    expect(status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(crm.application).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["graph", "crm"]);
  });

  // sendLead itself throws (the cookie jar is read inside it), which is not the
  // same as Graph refusing: this proves the handler's own catch is what keeps
  // the visitor's success, with the lead already in ingest.
  it("still answers success and keeps the ingest copy when sendLead itself throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { status, json } = await call(application(), {
        cookieJar: {
          get: () => {
            throw new Error("boom");
          },
        },
      });
      expect(status).toBe(200);
      expect(json).toEqual({ success: true });
      expect(submitToIngest).toHaveBeenCalledTimes(1);
      expect(graphCalls()).toHaveLength(0);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining("Lead not sent: boom"));
    } finally {
      logged.mockRestore();
    }
  });

  it("sends the test event code when one is configured", async () => {
    metaEnv.META_CAPI_TEST_EVENT_CODE = "TEST12345";
    await call(application());
    expect(JSON.parse(String((graphCalls()[0][1] as RequestInit).body)).test_event_code).toBe(
      "TEST12345",
    );
  });
});
