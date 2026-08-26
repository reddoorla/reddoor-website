import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// vitest.config.js loads no SvelteKit plugin, so `$env` has no resolver and has
// to be hand-mocked — the convention already used by
// src/routes/api/slots/server.test.ts. The module under test is then pulled in
// with a dynamic import, after the mock is registered.
vi.mock("$env/dynamic/private", () => ({
  env: { PROSPECT_REPORT_URL: "https://ops.test" },
}));

const { load, prerender } = await import("./+page.server");

const REPORT = { url: "https://acme.example/", businessName: "Acme Roofing", scores: {} };
const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

function respondWith(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

type Evt = Parameters<typeof load>[0];

function event(token: string, fetchImpl: ReturnType<typeof respondWith>) {
  const setHeaders = vi.fn();
  return {
    evt: { params: { token }, fetch: fetchImpl, setHeaders } as unknown as Evt,
    setHeaders,
    fetchImpl,
  };
}

let ok: ReturnType<typeof respondWith>;
beforeEach(() => {
  ok = respondWith(200, REPORT);
});

describe("/audit/[token] — prerendering", () => {
  // The root layout sets prerender = "auto". This page is one prospect's
  // private report behind an unguessable token: there is nothing to prerender,
  // and a build-time crawl of it would be a bug.
  it("opts out", () => {
    expect(prerender).toBe(false);
  });
});

describe("/audit/[token] — de-indexing", () => {
  it("sets a noindex header on the response itself", async () => {
    const { evt, setHeaders } = event(TOKEN, ok);
    await load(evt);
    const headers = setHeaders.mock.calls[0]![0] as Record<string, string>;
    expect(headers["x-robots-tag"]).toContain("noindex");
  });

  it("tells caches not to store the response", async () => {
    const { evt, setHeaders } = event(TOKEN, ok);
    await load(evt);
    const headers = setHeaders.mock.calls[0]![0] as Record<string, string>;
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["cache-control"]).not.toContain("public");
  });

  // The header travels with the response, so it survives an edit that drops the
  // robots.txt line. That is the point of having both.
  it("has a matching robots.txt rule", () => {
    expect(readFileSync("static/robots.txt", "utf-8")).toMatch(/^Disallow: \/audit\/$/m);
  });
});

describe("/audit/[token] — loading", () => {
  it("returns the report, with the Referer suppressed", async () => {
    const { evt } = event(TOKEN, ok);
    await expect(load(evt)).resolves.toEqual({
      report: REPORT,
      // The URL is the credential — it must not travel in a Referer header.
      meta_referrer: "no-referrer",
    });
  });

  it("404s a malformed token without fetching", async () => {
    const { evt, fetchImpl } = event("../../etc/passwd", ok);
    await expect(load(evt)).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("404s when the report does not exist", async () => {
    const { evt } = event(TOKEN, respondWith(404, { error: "not-found" }));
    await expect(load(evt)).rejects.toMatchObject({ status: 404 });
  });

  // An ops outage must not render as "your report is gone". Let it throw so
  // SvelteKit serves a 500 the visitor can retry, rather than a confident 404.
  it("does not turn an upstream outage into a 404", async () => {
    const { evt } = event(TOKEN, respondWith(503, { error: "unconfigured" }));
    await expect(load(evt)).rejects.not.toMatchObject({ status: 404 });
  });
});
