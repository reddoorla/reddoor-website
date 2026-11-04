import { describe, it, expect, vi, beforeEach } from "vitest";

// The e2e suite stubs /api/inquiry wholesale, so the handler's own logic —
// screen ordering, validation, message composition, ingest forwarding — runs
// nowhere else. This exercises it directly. submitToIngest is mocked to capture
// payloads and drive success/failure; screenSubmission stays REAL so the
// honeypot/timing contract is the true one.
const submitToIngest = vi.fn();
vi.mock("$app/env/private", () => ({
  FORMS_INGEST_URL: "https://ingest.test/api/forms/reddoor",
  FORMS_INGEST_TOKEN: "test-token",
  // Unset, as it was under $env/dynamic: the CRM sync stays off in this suite.
  CRM_FUNNEL_ACTIVE_TOKEN: undefined,
}));
vi.mock("@reddoorla/maintenance/forms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@reddoorla/maintenance/forms")>();
  return { ...actual, submitToIngest: (opts: unknown) => submitToIngest(opts) };
});

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
    cookies: { get: () => undefined },
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
