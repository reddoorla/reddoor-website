import { describe, it, expect, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: { PROSPECT_REPORT_URL: "https://ops.test" },
}));

const { loadReport } = await import("./load");

const REPORT = { url: "https://acme.example/", businessName: "Acme Roofing", scores: {} };
const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

function respondWith(status: number, body: unknown) {
  return vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(body), { status }));
}

function event(token: string, fetchImpl: ReturnType<typeof respondWith>) {
  const setHeaders = vi.fn();
  return {
    evt: { params: { token }, fetch: fetchImpl, setHeaders },
    setHeaders,
    fetchImpl,
  };
}

describe("loadReport — the guards both routes share", () => {
  it("returns the report", async () => {
    const { evt } = event(TOKEN, respondWith(200, REPORT));
    await expect(loadReport(evt)).resolves.toEqual({
      report: REPORT,
      // The URL is the credential; it must not travel in a Referer header.
      meta_referrer: "no-referrer",
    });
  });

  it("404s a malformed token without fetching", async () => {
    const { evt, fetchImpl } = event("../../etc/passwd", respondWith(200, REPORT));
    await expect(loadReport(evt)).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("404s when the report does not exist", async () => {
    const { evt } = event(TOKEN, respondWith(404, { error: "not-found" }));
    await expect(loadReport(evt)).rejects.toMatchObject({ status: 404 });
  });

  // An ops outage must not render as "your report is gone". A prospect told
  // their report was deleted does not come back and check later.
  it("does not turn an upstream outage into a 404", async () => {
    const { evt } = event(TOKEN, respondWith(503, { error: "unconfigured" }));
    await expect(loadReport(evt)).rejects.not.toMatchObject({ status: 404 });
  });

  it("sets noindex and no-store", async () => {
    const { evt, setHeaders } = event(TOKEN, respondWith(200, REPORT));
    await loadReport(evt);
    const headers = setHeaders.mock.calls[0]![0] as Record<string, string>;
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["cache-control"]).not.toContain("public");
  });
});

// The guards are the part that must not drift. Both routes serve the same
// confidential document to the same audience in different formats, so a
// difference in what either accepts is a security difference, not a stylistic
// one. Sharing the loader is what makes that structural rather than a promise —
// this pins that they really do share it.
describe("both routes use the shared loader", () => {
  it("the page and the print route load through loadReport", async () => {
    const [page, print] = await Promise.all([
      import("../../routes/audit/[token]/+page.server"),
      import("../../routes/audit/[token]/print/+page.server"),
    ]);

    for (const route of [page, print]) {
      expect(route.prerender).toBe(false);

      const { evt, setHeaders } = event(TOKEN, respondWith(200, REPORT));
      // Both routes must carry no-referrer — the print route is fetched by our
      // own runner, but it is served on the same public token.
      await expect(route.load(evt as never)).resolves.toEqual({
        report: REPORT,
        meta_referrer: "no-referrer",
      });
      const headers = setHeaders.mock.calls[0]![0] as Record<string, string>;
      expect(headers["x-robots-tag"]).toContain("noindex");
    }
  });

  it("both refuse a malformed token", async () => {
    const [page, print] = await Promise.all([
      import("../../routes/audit/[token]/+page.server"),
      import("../../routes/audit/[token]/print/+page.server"),
    ]);

    for (const route of [page, print]) {
      const { evt } = event("short", respondWith(200, REPORT));
      await expect(route.load(evt as never)).rejects.toMatchObject({ status: 404 });
    }
  });
});
