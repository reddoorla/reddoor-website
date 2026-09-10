import { describe, it, expect, vi } from "vitest";
import { fetchReport, REPORT_TOKEN_PATTERN } from "./fetch";
import { ALL_PASS_REPORT } from "./fixtures/all-pass";

const REPORT = {
  url: "https://acme.example/",
  businessName: "Acme Roofing",
  generatedAt: "2026-08-25T19:00:00.000Z",
  scores: { findability: 91 },
};

// Typed with the input parameter so `mock.calls[0][0]` is the requested URL —
// a zero-arg mock gives an empty tuple and the assertions below cannot index it.
function respondWith(status: number, body: unknown) {
  return vi.fn(
    async (_input: RequestInfo | URL) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

const OPTS = { baseUrl: "https://ops.test" };
const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

describe("fetchReport", () => {
  it("returns the parsed report on 200", async () => {
    const fetch = respondWith(200, REPORT);
    const fetched = await fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", { ...OPTS, fetch });
    expect(fetched).toEqual({ report: REPORT, overrides: {} });
  });

  it("calls the audit-report endpoint for the token", async () => {
    const fetch = respondWith(200, REPORT);
    await fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", { ...OPTS, fetch });
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://ops.test/api/audit-report/aB3-_xY9zQ1rS2tU4vW6xY",
    );
  });

  it("tolerates a trailing slash on the base URL rather than doubling it", async () => {
    const fetch = respondWith(200, REPORT);
    await fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", { baseUrl: "https://ops.test/", fetch });
    expect(fetch.mock.calls[0]![0]).toBe(
      "https://ops.test/api/audit-report/aB3-_xY9zQ1rS2tU4vW6xY",
    );
  });

  it("returns null on 404 — a dead link is not an outage", async () => {
    const report = await fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", {
      ...OPTS,
      fetch: respondWith(404, { error: "not-found" }),
    });
    expect(report).toBeNull();
  });

  // The distinction that matters: "this report does not exist" is final and
  // correct; "our ops app is down" is temporary. Collapsing the second into the
  // first tells a prospect their report was deleted when it was not.
  it("throws on 5xx rather than reporting the report missing", async () => {
    await expect(
      fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", {
        ...OPTS,
        fetch: respondWith(503, { error: "unconfigured" }),
      }),
    ).rejects.toThrow(/upstream/i);
  });

  it("throws on an unexpected 4xx too", async () => {
    await expect(
      fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", {
        ...OPTS,
        fetch: respondWith(429, { error: "rate-limited" }),
      }),
    ).rejects.toThrow(/upstream/i);
  });

  // Without a base URL the fetch would resolve as a relative path against the
  // marketing site and 404 there, which would render as "report not found".
  it("throws when the base URL is unset, naming the variable to set", async () => {
    await expect(
      fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", { baseUrl: "", fetch: respondWith(200, REPORT) }),
    ).rejects.toThrow(/PROSPECT_REPORT_URL/);
  });

  it("refuses a malformed token without fetching", async () => {
    const fetch = respondWith(200, REPORT);
    await expect(fetchReport("../../etc/passwd", { ...OPTS, fetch })).rejects.toThrow(/token/i);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("REPORT_TOKEN_PATTERN", () => {
  it("accepts the base64url shape the audit generates", () => {
    expect(REPORT_TOKEN_PATTERN.test("aB3-_xY9zQ1rS2tU4vW6xY")).toBe(true);
  });

  it("rejects path traversal, slashes and anything too short", () => {
    expect(REPORT_TOKEN_PATTERN.test("../../etc/passwd")).toBe(false);
    expect(REPORT_TOKEN_PATTERN.test("abc/def")).toBe(false);
    expect(REPORT_TOKEN_PATTERN.test("short")).toBe(false);
    expect(REPORT_TOKEN_PATTERN.test("")).toBe(false);
  });

  // Anchored at both ends, or a valid-looking prefix would smuggle a path.
  it("is anchored, so a valid prefix cannot carry a suffix", () => {
    expect(REPORT_TOKEN_PATTERN.test("aB3-_xY9zQ1rS2tU4vW6xY/../../secrets")).toBe(false);
  });
});

describe("fetchReport — response shapes", () => {
  const opts = (body: unknown) => ({ ...OPTS, fetch: respondWith(200, body) });

  it("reads a bare report body, the shape served before overrides existed", async () => {
    const got = await fetchReport(TOKEN, opts({ url: "https://acme.test/", scores: {} }));
    expect(got).toEqual({ report: { url: "https://acme.test/", scores: {} }, overrides: {} });
  });

  // The two-key stub above cannot detect the discriminator colliding, which is
  // the whole risk `unwrap` is defending against. This runs it over the real
  // fixture the narrative tests use, so the day a stored report grows a
  // top-level `report` key, this fails instead of the prospect's page.
  it("reads a real report body as bare — no stored report has a top-level `report` key", async () => {
    const got = await fetchReport(TOKEN, opts(ALL_PASS_REPORT));
    expect(got).toEqual({ report: ALL_PASS_REPORT, overrides: {} });
  });

  it("reads a wrapped body and returns its overrides", async () => {
    const got = await fetchReport(
      TOKEN,
      opts({
        report: { url: "https://acme.test/" },
        overrides: { "composed:headlineFinding": { original: "a", text: "b" } },
        editedAt: "2026-09-09T00:00:00.000Z",
        openedAt: null,
      }),
    );
    expect(got).toEqual({
      report: { url: "https://acme.test/" },
      overrides: { "composed:headlineFinding": { original: "a", text: "b" } },
    });
  });

  it("treats a wrapped body with null overrides as no overrides", async () => {
    const got = await fetchReport(
      TOKEN,
      opts({ report: { url: "https://acme.test/" }, overrides: null }),
    );
    expect(got).toEqual({ report: { url: "https://acme.test/" }, overrides: {} });
  });

  // `typeof [] === "object"`, so an object test alone lets an array through as
  // an OverrideMap. Nothing renders overrides yet; the next commit does.
  it("treats an array of overrides as no overrides", async () => {
    const got = await fetchReport(
      TOKEN,
      opts({ report: { url: "https://acme.test/" }, overrides: [] }),
    );
    expect(got).toEqual({ report: { url: "https://acme.test/" }, overrides: {} });
  });

  it("refuses a 200 that carries no report, in either shape", async () => {
    await expect(fetchReport(TOKEN, opts(null))).rejects.toThrow(/no report/i);
    await expect(fetchReport(TOKEN, opts({ report: null, overrides: {} }))).rejects.toThrow(
      /no report/i,
    );
  });
});
