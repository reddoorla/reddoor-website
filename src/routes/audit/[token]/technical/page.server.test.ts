import { describe, it, expect, vi } from "vitest";
import { TECHNICAL_REPORT } from "$lib/report/fixtures/technical";

// The same hand-mocked env as the parent route's test: the unit config has no
// SvelteKit plugin. A fake token, fake origin.
vi.mock("$app/env/private", () => ({ PROSPECT_REPORT_URL: "https://ops.test" }));

const { load, prerender } = await import("./+page.server");
const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";

type Evt = Parameters<typeof load>[0];
const event = (body: unknown, status = 200) => {
  const setHeaders = vi.fn();
  return {
    evt: {
      params: { token: TOKEN },
      fetch: vi.fn(async () => new Response(JSON.stringify(body), { status })),
      setHeaders,
    } as unknown as Evt,
    setHeaders,
  };
};

describe("/audit/[token]/technical", () => {
  it("is never prerendered", () => {
    expect(prerender).toBe(false);
  });

  it("sends the view and a short reference, never the row or the token", async () => {
    const { evt } = event({ report: TECHNICAL_REPORT, overrides: {} });
    const data = (await load(evt)) as Record<string, unknown>;
    expect(data).not.toHaveProperty("report");
    expect(data).toHaveProperty("view");
    expect(data.reference).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(data)).not.toContain(TOKEN);
    expect(JSON.stringify(data)).not.toContain("A model wrote this sentence.");
  });

  it("keeps the parent route's guards: noindex and no-store", async () => {
    const { evt, setHeaders } = event({ report: TECHNICAL_REPORT, overrides: {} });
    await load(evt);
    const headers = Object.assign({}, ...setHeaders.mock.calls.map((c) => c[0]));
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["cache-control"]).toContain("no-store");
  });
});
