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
    expect(JSON.stringify(data)).not.toContain("An assistant said this about the business.");
  });

  it("keeps the parent route's guards: noindex and no-store", async () => {
    const { evt, setHeaders } = event({ report: TECHNICAL_REPORT, overrides: {} });
    await load(evt);
    const headers = Object.assign({}, ...setHeaders.mock.calls.map((c) => c[0]));
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["cache-control"]).toContain("no-store");
  });

  it("a check the operator hid on the report is off the Technical page too", async () => {
    const hide = {
      "siteChecks.data[1]": {
        original: "Not advertising your software versions",
        text: "",
        hidden: true,
      },
    };
    const shown = (await load(event({ report: TECHNICAL_REPORT, overrides: {} }).evt)) as {
      view: unknown;
    };
    expect(JSON.stringify(shown.view)).toContain("Software version in headers");
    const data = (await load(event({ report: TECHNICAL_REPORT, overrides: hide }).evt)) as {
      view: unknown;
    };
    expect(JSON.stringify(data.view)).not.toContain("Software version in headers");
    expect(JSON.stringify(data.view)).not.toContain("announces which software version");
  });

  it("opens a row from a --technical run, whose paid stages were never run", async () => {
    const skipped = { ok: false, error: "skipped (--technical)" };
    const {
      goalFit: _goalFit,
      analyze: _analyze,
      probes: _probes,
      accuracy: _accuracy,
      ...rest
    } = TECHNICAL_REPORT as Record<string, unknown>;
    const technicalRun = { ...rest, analyze: skipped, probes: skipped, accuracy: skipped };
    const { evt } = event({ report: technicalRun, overrides: {} });
    const data = (await load(evt)) as { view: unknown };
    const full = (await load(event({ report: TECHNICAL_REPORT, overrides: {} }).evt)) as {
      view: unknown;
    };
    expect(data.view).toEqual(full.view);
  });
});
