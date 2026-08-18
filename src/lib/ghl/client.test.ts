import { describe, expect, it } from "vitest";
import {
  attributionFields,
  attributionLines,
  ensureCrmOpportunity,
  partitionAnswers,
  syncApplicationToCrm,
  syncInquiryToCrm,
  upsertCrmContact,
  writableFieldIds,
} from "./client";
import {
  DEFAULT_INQUIRY_SURVEY_ID,
  GHL_ATTRIBUTION_FIELDS,
  GHL_LOCATION_ID,
  GHL_PIPELINE_ID,
  GHL_STAGE_NEW_INQUIRY,
  INQUIRY_FORM_NAME,
  LEAD_SOURCE,
  TAG_APPLICATION_COMPLETED,
  TAG_APPLICATION_STARTED,
} from "./constants";
import { SMS_CONSENT } from "./questions";

/**
 * Routes by URL rather than replaying a queue: the sync functions call several
 * endpoints in sequence, and a positional queue would make every test brittle to
 * a reordering that changes nothing observable.
 */
function stubCrm(
  overrides: Partial<
    Record<
      "upsert" | "tags" | "search" | "opportunity" | "note",
      { status?: number; body?: unknown }
    >
  > = {},
) {
  const calls: Array<{
    url: string;
    method: string;
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }> = [];
  const reply = (key: keyof typeof overrides, fallback: unknown) => {
    const o = overrides[key];
    return { status: o?.status ?? 200, body: o && "body" in o ? o.body : fallback };
  };
  const fetch = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      url,
      method,
      body: JSON.parse(String(init.body ?? "{}")),
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    let r: { status: number; body: unknown };
    if (url.includes("/contacts/upsert")) r = reply("upsert", { contact: { id: "C1", new: true } });
    else if (url.includes("/tags")) r = reply("tags", { tags: [] });
    else if (url.includes("/opportunities/search"))
      r = reply("search", { opportunities: [], meta: { total: 0 } });
    else if (url.includes("/opportunities/"))
      r = reply("opportunity", { opportunity: { id: "O1" } });
    else if (url.includes("/notes")) r = reply("note", { note: { id: "N1" } });
    else r = { status: 404, body: {} };
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  };
  const find = (fragment: string) => calls.filter((c) => c.url.includes(fragment));
  return { fetch, calls, find };
}

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

describe("attributionFields", () => {
  const byId = (
    fields: { id: string; value: string | string[] }[],
    key: keyof typeof GHL_ATTRIBUTION_FIELDS,
  ) => fields.find((f) => f.id === GHL_ATTRIBUTION_FIELDS[key])?.value;

  it("writes only the two fields that survive", () => {
    const f = attributionFields("medtech");
    expect(byId(f, "lead_source")).toBe(LEAD_SOURCE);
    expect(byId(f, "funnel")).toBe("medtech");
    expect(f).toHaveLength(2);
  });

  // Measured against the live CRM 2026-08-18: GHL accepts a contact.utm_* write
  // and returns it on an immediate read, then blanks it within ~10s by
  // reconciling against `attributionSource`, which an API upsert cannot set.
  // Writing them is a wasted call that makes the record look like it captured
  // attribution when it did not — the note is the real home. See the header
  // comment on attributionFields.
  it("does not write the utm fields, which the CRM silently reverts", () => {
    const f = attributionFields("medtech");
    expect(byId(f, "utm_source")).toBeUndefined();
    expect(byId(f, "utm_medium")).toBeUndefined();
    expect(byId(f, "utm_campaign")).toBeUndefined();
    expect(byId(f, "utm_content")).toBeUndefined();
  });

  it("omits funnel entirely for a cold booking rather than writing it blank", () => {
    const f = attributionFields("");
    expect(byId(f, "funnel")).toBeUndefined();
    expect(byId(f, "lead_source")).toBe(LEAD_SOURCE);
  });
});

describe("attributionLines", () => {
  it("reports the landing page, referrer and ad params", () => {
    const lines = attributionLines(
      "https://reddoorla.com/medtech?utm_source=google&gclid=abc&nope=1",
      "https://news.example.com/story",
    );
    expect(lines).toContain("Referrer: https://news.example.com/story");
    expect(lines).toContain("utm_source: google");
    expect(lines).toContain("gclid: abc");
    expect(lines.some((l) => l.startsWith("nope"))).toBe(false);
  });

  it("survives a malformed url and an absent referrer", () => {
    expect(attributionLines("not a url", "")).toEqual(["Landing page: not a url"]);
  });
});

describe("upsertCrmContact", () => {
  it("sends the documented headers and a location-scoped body", async () => {
    const { fetch, calls } = stubCrm();
    const res = await upsertCrmContact({
      token: "tok",
      fetch,
      email: "buyer@example.com",
      phone: "(555) 123-4567",
      source: "X",
    });

    expect(res).toEqual({ ok: true, data: { contactId: "C1", isNew: true } });
    expect(calls[0].url).toBe("https://services.leadconnectorhq.com/contacts/upsert");
    // The dated Version header is not optional — LeadConnector pins request
    // behaviour to it, and omitting it changes the response shape.
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(calls[0].headers.Version).toBe("2021-07-28");
    expect(calls[0].body.locationId).toBe(GHL_LOCATION_ID);
    // Phone normalised to the +1 shape the CRM stores.
    expect(calls[0].body.phone).toBe("+15551234567");
  });

  it("NEVER sends tags — the API overwrites the whole array", async () => {
    const { fetch, calls } = stubCrm();
    await upsertCrmContact({ token: "t", fetch, email: "a@b.co" });
    expect("tags" in calls[0].body).toBe(false);
  });

  it("surfaces a validation array as one readable error", async () => {
    const { fetch } = stubCrm({
      upsert: {
        status: 422,
        body: { message: ["email must be an email", "email must be a string"] },
      },
    });
    const res = await upsertCrmContact({ token: "t", fetch, email: "nope" });
    expect(res).toEqual({
      ok: false,
      status: 422,
      error: "email must be an email; email must be a string",
    });
  });
});

describe("syncInquiryToCrm", () => {
  const base = {
    token: "t",
    email: "a@b.co",
    campaign: "medtech",
    sourceUrl: "https://reddoorla.com/medtech",
  };

  it("stamps the first touch with the CRM's own form name and records attribution", async () => {
    const { fetch, find } = stubCrm();
    const res = await syncInquiryToCrm({ ...base, fetch });
    expect(res.ok).toBe(true);

    const upsert = find("/contacts/upsert")[0];
    // Matching the embed's source verbatim keeps this flow's leads grouped with
    // the widget's in the CRM's source reporting.
    expect(upsert.body.source).toBe(INQUIRY_FORM_NAME);
    const fields = upsert.body.customFields as { id: string }[];
    expect(fields.some((f) => f.id === GHL_ATTRIBUTION_FIELDS.funnel)).toBe(true);
  });

  it("adds the started tag without sending it on the upsert", async () => {
    const { fetch, find } = stubCrm();
    await syncInquiryToCrm({ ...base, fetch });
    const tag = find("/tags")[0];
    expect(tag.method).toBe("POST");
    expect(tag.url).toContain("/contacts/C1/tags");
    expect(tag.body).toEqual({ tags: [TAG_APPLICATION_STARTED] });
  });

  it("still succeeds when only the tag fails — the lead is already recorded", async () => {
    const { fetch } = stubCrm({ tags: { status: 500, body: { message: "boom" } } });
    const res = await syncInquiryToCrm({ ...base, fetch });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.taggedOk).toBe(false);
  });
});

describe("ensureCrmOpportunity", () => {
  it("opens one at New Inquiry when the contact has none", async () => {
    const { fetch, find } = stubCrm();
    const res = await ensureCrmOpportunity({ token: "t", fetch, contactId: "C1", name: "Dana" });
    expect(res).toEqual({ ok: true, data: { opportunityId: "O1", created: true } });

    const created = find("/opportunities/").filter((c) => c.method === "POST")[0];
    expect(created.body.pipelineId).toBe(GHL_PIPELINE_ID);
    expect(created.body.pipelineStageId).toBe(GHL_STAGE_NEW_INQUIRY);
    expect(created.body.contactId).toBe("C1");
    expect(created.body.status).toBe("open");
  });

  it("creates nothing when one already exists", async () => {
    // A-102-2 opens this opportunity too once it is finished; the guard is what
    // stops the two from racing into duplicates in a live pipeline.
    const { fetch, find } = stubCrm({
      search: { body: { opportunities: [{ id: "EXISTING" }], meta: { total: 1 } } },
    });
    const res = await ensureCrmOpportunity({ token: "t", fetch, contactId: "C1", name: "Dana" });
    expect(res).toEqual({ ok: true, data: { opportunityId: "", created: false } });
    expect(find("/opportunities/").filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("creates nothing when the lookup itself fails", async () => {
    // Creating on an unknown state risks a duplicate in someone's live pipeline;
    // skipping only risks a missing card a human can add. Cheaper mistake wins.
    const { fetch, find } = stubCrm({ search: { status: 500, body: { message: "down" } } });
    const res = await ensureCrmOpportunity({ token: "t", fetch, contactId: "C1", name: "Dana" });
    expect(res.ok).toBe(false);
    expect(find("/opportunities/").filter((c) => c.method === "POST")).toHaveLength(0);
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
    campaign: "medtech",
  };

  it("writes answers as custom fields and leaves the first-touch source alone", async () => {
    const { fetch, find } = stubCrm();
    const res = await syncApplicationToCrm({ ...base, fetch });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.contactId).toBe("C1");
      expect(res.data.taggedOk).toBe(true);
      expect(res.data.opportunityOk).toBe(true);
      expect(res.data.noteOk).toBe(true);
    }

    const body = find("/contacts/upsert")[0].body;
    // `source` is the CRM's first-touch label; the survey submission does not
    // overwrite it, so neither do we.
    expect("source" in body).toBe(false);
    expect(body.name).toBe("Dana Buyer");
    expect(body.website).toBe("https://acme.test");

    const cf = body.customFields as { id: string; value: unknown }[];
    expect(cf).toContainEqual({
      id: "vlLzA6TsJhHkmvmf6ArR",
      value: ["Outdated sales and marketing materials"],
    });
    expect(cf).toContainEqual({ id: SMS_CONSENT.tag, value: [SMS_CONSENT.label] });
    // The attribution that survives rides along as real fields; the utm params
    // reach the CRM only through the note, because GHL reverts utm_* writes on
    // an API-created contact (see attributionFields).
    expect(cf).toContainEqual({ id: GHL_ATTRIBUTION_FIELDS.funnel, value: "medtech" });
    expect(cf).toContainEqual({ id: GHL_ATTRIBUTION_FIELDS.lead_source, value: LEAD_SOURCE });
    expect(cf.some((x) => x.id === GHL_ATTRIBUTION_FIELDS.utm_source)).toBe(false);
  });

  it("records consent from the request boolean, never from the answer map", async () => {
    const forged = stubCrm();
    await syncApplicationToCrm({
      ...base,
      fetch: forged.fetch,
      smsConsent: false,
      fields: { ...base.fields, [SMS_CONSENT.tag]: [SMS_CONSENT.label] },
    });
    const cf = forged.find("/contacts/upsert")[0].body.customFields as { id: string }[];
    expect(cf.some((f) => f.id === SMS_CONSENT.tag)).toBe(false);
  });

  it("marks the process state and opens the pipeline card", async () => {
    const { fetch, find } = stubCrm();
    await syncApplicationToCrm({ ...base, fetch });
    expect(find("/tags")[0].body).toEqual({ tags: [TAG_APPLICATION_COMPLETED] });
    expect(find("/opportunities/").filter((c) => c.method === "POST")[0].body.name).toBe(
      "Dana Buyer",
    );
  });

  it("names the opportunity by email when no name was given", async () => {
    const { fetch, find } = stubCrm();
    await syncApplicationToCrm({ ...base, fetch, name: "   " });
    expect(find("/opportunities/").filter((c) => c.method === "POST")[0].body.name).toBe(
      "buyer@example.com",
    );
  });

  it("attaches the transcript and attribution as a note", async () => {
    const { fetch, find } = stubCrm();
    await syncApplicationToCrm({ ...base, fetch });
    const note = find("/notes")[0];
    expect(note.url).toContain("/contacts/C1/notes");
    expect(String(note.body.body)).toContain('opened from "Discover"');
    expect(String(note.body.body)).toContain("utm_source: google");
  });

  it("reports partial failure without failing the submission", async () => {
    const { fetch } = stubCrm({
      tags: { status: 500, body: { message: "a" } },
      note: { status: 500, body: { message: "b" } },
    });
    const res = await syncApplicationToCrm({ ...base, fetch });
    // The answers are already on the contact, so the visitor is not told this failed.
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.taggedOk).toBe(false);
      expect(res.data.noteOk).toBe(false);
      expect(res.data.opportunityOk).toBe(true);
    }
  });

  it("does nothing further when the contact upsert failed", async () => {
    const { fetch, calls } = stubCrm({ upsert: { status: 401, body: { message: "nope" } } });
    const res = await syncApplicationToCrm({ ...base, fetch });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
