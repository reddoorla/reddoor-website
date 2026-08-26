import { describe, it, expect, vi } from "vitest";
import { fetchReport, REPORT_TOKEN_PATTERN } from "./fetch";

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

describe("fetchReport", () => {
  it("returns the parsed report on 200", async () => {
    const fetch = respondWith(200, REPORT);
    const report = await fetchReport("aB3-_xY9zQ1rS2tU4vW6xY", { ...OPTS, fetch });
    expect(report).toEqual(REPORT);
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
