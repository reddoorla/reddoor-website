import { describe, expect, it } from "vitest";
import {
  attributionLines,
  partitionAnswers,
  syncApplicationToCrm,
  syncInquiryToCrm,
  upsertCrmContact,
  writableFieldIds,
} from "./client";
import { DEFAULT_INQUIRY_SURVEY_ID, GHL_LOCATION_ID, INQUIRY_FORM_NAME } from "./constants";
import { SMS_CONSENT } from "./questions";

/** A fetch stub that records calls and replays queued responses. */
function stubFetch(responses: Array<{ status?: number; body?: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init, body: JSON.parse(String(init.body ?? "{}")) });
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(next.body ?? {}), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

const CONTACT_OK = { body: { contact: { id: "C1", new: true } } };
const NOTE_OK = { body: { note: { id: "N1" } } };

describe("writableFieldIds", () => {
  it("covers the survey's custom fields, excluding `website` and consent", () => {
    const ids = writableFieldIds(DEFAULT_INQUIRY_SURVEY_ID);
    expect(ids.has("vlLzA6TsJhHkmvmf6ArR")).toBe(true);
    // `website` names a STANDARD contact field — writing it as a custom field
    // would mint a phantom field id in the CRM.
    expect(ids.has("website")).toBe(false);
    // Consent is a compliance field, written from the request boolean rather
    // than from anything the browser sent.
    expect(ids.has(SMS_CONSENT.tag)).toBe(false);
  });

  it("is empty for a survey this build has no transcription of", () => {
    expect(writableFieldIds("someOtherSurvey").size).toBe(0);
  });
});

describe("partitionAnswers", () => {
  const writable = writableFieldIds(DEFAULT_INQUIRY_SURVEY_ID);

  it("splits standard fields out of the custom-field write", () => {
    const { customFields, standard } = partitionAnswers(
      { website: " https://acme.test ", iRpYADswmWvMc0hnWtrT: "Our Board" },
      writable,
    );
    expect(standard).toEqual({ website: "https://acme.test" });
    expect(customFields).toEqual([{ id: "iRpYADswmWvMc0hnWtrT", value: "Our Board" }]);
  });

  it("preserves array values for checkbox fields", () => {
    const { customFields } = partitionAnswers(
      { vlLzA6TsJhHkmvmf6ArR: ["Outdated sales and marketing materials"] },
      writable,
    );
    expect(customFields).toEqual([
      { id: "vlLzA6TsJhHkmvmf6ArR", value: ["Outdated sales and marketing materials"] },
    ]);
  });

  it("drops a forged field id rather than writing it", () => {
    // The answer map comes from the browser; an id we don't recognise must not
    // reach the CRM, or a bot could write arbitrary fields on the contact.
    const { customFields } = partitionAnswers({ someOtherFieldId: "malicious" }, writable);
    expect(customFields).toEqual([]);
  });

  it("omits empty answers instead of sending blanks", () => {
    const { customFields, standard } = partitionAnswers(
      { iRpYADswmWvMc0hnWtrT: "   ", vlLzA6TsJhHkmvmf6ArR: [], website: "  " },
      writable,
    );
    expect(customFields).toEqual([]);
    expect(standard).toEqual({});
  });
});

describe("attributionLines", () => {
  it("reports the landing page, referrer and ad params", () => {
    const lines = attributionLines(
      "https://reddoorla.com/medtech?utm_source=google&utm_medium=cpc&gclid=abc&nope=1",
      "https://news.example.com/story",
    );
    expect(lines[0]).toBe(
      "Landing page: https://reddoorla.com/medtech?utm_source=google&utm_medium=cpc&gclid=abc&nope=1",
    );
    expect(lines).toContain("Referrer: https://news.example.com/story");
    expect(lines).toContain("utm_source: google");
    expect(lines).toContain("gclid: abc");
    // Non-attribution query junk stays out of the note.
    expect(lines.some((l) => l.startsWith("nope"))).toBe(false);
  });

  it("survives a malformed url and an absent referrer", () => {
    expect(attributionLines("not a url", "")).toEqual(["Landing page: not a url"]);
  });
});

describe("upsertCrmContact", () => {
  it("sends the documented headers and a location-scoped body", async () => {
    const { fetch, calls } = stubFetch([CONTACT_OK]);
    const res = await upsertCrmContact({
      token: "tok",
      fetch,
      email: "buyer@example.com",
      phone: "(555) 123-4567",
      source: "X",
    });

    expect(res).toEqual({ ok: true, data: { contactId: "C1", isNew: true } });
    expect(calls[0].url).toBe("https://services.leadconnectorhq.com/contacts/upsert");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers.Version).toBe("2021-07-28");
    expect(calls[0].body.locationId).toBe(GHL_LOCATION_ID);
    // Phone is normalised to the +1 shape the CRM stores.
    expect(calls[0].body.phone).toBe("+15551234567");
  });

  it("NEVER sends tags — the API overwrites the whole array", async () => {
    const { fetch, calls } = stubFetch([CONTACT_OK]);
    await upsertCrmContact({ token: "t", fetch, email: "a@b.co" });
    expect("tags" in calls[0].body).toBe(false);
  });

  it("surfaces a validation array as one readable error", async () => {
    const { fetch } = stubFetch([
      { status: 422, body: { message: ["email must be an email", "email must be a string"] } },
    ]);
    const res = await upsertCrmContact({ token: "t", fetch, email: "nope" });
    expect(res).toEqual({
      ok: false,
      status: 422,
      error: "email must be an email; email must be a string",
    });
  });

  it("reports a missing scope rather than throwing", async () => {
    const { fetch } = stubFetch([
      { status: 401, body: { message: "The token is not authorized for this scope." } },
    ]);
    const res = await upsertCrmContact({ token: "t", fetch, email: "a@b.co" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });
});

describe("syncInquiryToCrm", () => {
  it("stamps the first touch with the CRM's own form name", async () => {
    const { fetch, calls } = stubFetch([CONTACT_OK]);
    await syncInquiryToCrm({ token: "t", fetch, email: "a@b.co" });
    // Matching the embed's source verbatim keeps this flow's leads grouped with
    // the widget's in the CRM's source reporting.
    expect(calls[0].body.source).toBe(INQUIRY_FORM_NAME);
  });
});

describe("syncApplicationToCrm", () => {
  const base = {
    token: "t",
    surveyId: DEFAULT_INQUIRY_SURVEY_ID,
    email: "buyer@example.com",
    name: "Dana Buyer",
    phone: "555 123 4567",
    fields: {
      vlLzA6TsJhHkmvmf6ArR: ["Outdated sales and marketing materials"],
      website: "https://acme.test",
    },
    smsConsent: true,
    transcript: 'Landing-page application — opened from "Discover".',
    sourceUrl: "https://reddoorla.com/medtech?utm_source=google",
    referrer: "",
  };

  it("writes answers as custom fields and leaves the first-touch source alone", async () => {
    const { fetch, calls } = stubFetch([CONTACT_OK, NOTE_OK]);
    const res = await syncApplicationToCrm({ ...base, fetch });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual({ contactId: "C1", isNew: true, noteOk: true });

    const body = calls[0].body;
    // `source` is the CRM's first-touch label; the survey submission does not
    // overwrite it, so neither do we.
    expect("source" in body).toBe(false);
    expect(body.name).toBe("Dana Buyer");
    expect(body.website).toBe("https://acme.test");
    expect(body.customFields).toEqual([
      { id: "vlLzA6TsJhHkmvmf6ArR", value: ["Outdated sales and marketing materials"] },
      { id: SMS_CONSENT.tag, value: [SMS_CONSENT.label] },
    ]);
  });

  it("records consent from the request boolean, never from the answer map", async () => {
    // A browser claiming consent via the field id must be ignored…
    const forged = stubFetch([CONTACT_OK, NOTE_OK]);
    await syncApplicationToCrm({
      ...base,
      fetch: forged.fetch,
      smsConsent: false,
      fields: { ...base.fields, [SMS_CONSENT.tag]: [SMS_CONSENT.label] },
    });
    const written = forged.calls[0].body.customFields as Array<{ id: string }>;
    expect(written.some((f) => f.id === SMS_CONSENT.tag)).toBe(false);

    // …while the boolean alone is enough to record it.
    const real = stubFetch([CONTACT_OK, NOTE_OK]);
    await syncApplicationToCrm({ ...base, fetch: real.fetch, smsConsent: true, fields: {} });
    expect(real.calls[0].body.customFields).toEqual([
      { id: SMS_CONSENT.tag, value: [SMS_CONSENT.label] },
    ]);
  });

  it("attaches the transcript and attribution as a note", async () => {
    const { fetch, calls } = stubFetch([CONTACT_OK, NOTE_OK]);
    await syncApplicationToCrm({ ...base, fetch });
    expect(calls[1].url).toBe("https://services.leadconnectorhq.com/contacts/C1/notes");
    const note = String(calls[1].body.body);
    expect(note).toContain('opened from "Discover"');
    expect(note).toContain("Landing page: https://reddoorla.com/medtech?utm_source=google");
    expect(note).toContain("utm_source: google");
  });

  it("still succeeds when only the note fails — the answers are already saved", async () => {
    const { fetch } = stubFetch([CONTACT_OK, { status: 500, body: { message: "boom" } }]);
    const res = await syncApplicationToCrm({ ...base, fetch });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.noteOk).toBe(false);
  });

  it("does not post a note when the contact upsert failed", async () => {
    const { fetch, calls } = stubFetch([{ status: 401, body: { message: "nope" } }]);
    const res = await syncApplicationToCrm({ ...base, fetch });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
