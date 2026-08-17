import { describe, expect, it } from "vitest";
import { attributionParams, buildGhlFormData, normalizePhone } from "./payload";

const page = {
  url: "https://reddoorla.com/medtech",
  title: "MedTech — Red Door",
  referrer: "",
  hostname: "reddoorla.com",
  search: "",
};

describe("attributionParams", () => {
  it("fills our defaults on a bare visit", () => {
    expect(attributionParams("", "medtech")).toEqual({
      utm_source: "reddoorla-website",
      utm_medium: "industry-lp",
      utm_campaign: "medtech",
    });
  });

  it("never overwrites params the visitor actually arrived with", () => {
    const params = attributionParams("?utm_source=google&utm_medium=cpc&gclid=abc", "medtech");
    // The ad click's attribution survives…
    expect(params.utm_source).toBe("google");
    expect(params.utm_medium).toBe("cpc");
    expect(params.gclid).toBe("abc");
    // …and our campaign still fills the gap the URL left.
    expect(params.utm_campaign).toBe("medtech");
  });
});

describe("buildGhlFormData", () => {
  const base = {
    id: "FORM123",
    locationId: "LOC456",
    fields: { email: "buyer@example.com" },
    campaign: "medtech",
    page,
    now: 1_700_000_000_000,
    fbEventId: "uuid-1",
    timeSpentSeconds: 12.5,
    timezone: "America/Los_Angeles",
  };

  it("assembles the widget contract for a form", () => {
    const fd = buildGhlFormData({ ...base, kind: "form" });
    expect(fd.email).toBe("buyer@example.com");
    expect(fd.formId).toBe("FORM123");
    expect(fd.location_id).toBe("LOC456");
    expect(fd.surveyId).toBeUndefined();
    expect(fd.Timezone).toBe("America/Los_Angeles");
    expect(fd.timeSpent).toBe(12.5);

    const ev = fd.eventData as Record<string, unknown>;
    expect(ev.medium).toBe("form");
    expect(ev.mediumId).toBe("FORM123");
    expect(ev.source).toBe("Direct traffic");
    expect(ev.page).toEqual({ url: page.url, title: page.title });
    expect(ev.domain).toBe("reddoorla.com");
    expect(ev.fbEventId).toBe("uuid-1");
    expect((ev.url_params as Record<string, string>).utm_campaign).toBe("medtech");
  });

  it("marks a referred visit as such", () => {
    const fd = buildGhlFormData({
      ...base,
      kind: "form",
      page: { ...page, referrer: "https://news.example.com/story" },
    });
    expect((fd.eventData as Record<string, unknown>).source).toBe("Referral");
  });

  it("a survey carries surveyId and survey medium", () => {
    const fd = buildGhlFormData({ ...base, kind: "survey", id: "SURV789" });
    expect(fd.surveyId).toBe("SURV789");
    expect(fd.formId).toBe("SURV789");
    const ev = fd.eventData as Record<string, unknown>;
    expect(ev.medium).toBe("survey");
    expect(ev.mediumId).toBe("SURV789");
  });
});

describe("normalizePhone", () => {
  it("normalizes ten US digits however they're dressed", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("555.123.4567")).toBe("+15551234567");
    expect(normalizePhone("1 555 123 4567")).toBe("+15551234567");
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("passes anything else through untouched rather than guessing", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(normalizePhone("  12345  ")).toBe("12345");
  });

  it("never re-stamps an explicit non-US country code as +1", () => {
    // Ten total digits behind a + must stay put — the old code slapped +1 on
    // the front and produced a bogus number.
    expect(normalizePhone("+351 12 345 678")).toBe("+351 12 345 678");
    expect(normalizePhone("+30 21 012 3456")).toBe("+30 21 012 3456");
    // …but a +1 US number still normalizes.
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
  });
});
