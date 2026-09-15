import { describe, it, expect, vi, beforeEach } from "vitest";

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock("$env/dynamic/private", () => ({ env }));

import { POST } from "./+server";

const TOKEN = "aB3-_xY9zQ1rS2tU4vW6xY";
const MAP = { "composed:headlineFinding": { original: "a", text: "b" } };

function evt(opts: { cookie?: string; body?: unknown; fetch?: typeof globalThis.fetch }) {
  return {
    request: new Request("https://reddoorla.com/api/audit-edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts.body ?? { token: TOKEN, overrides: MAP }),
    }),
    cookies: { get: vi.fn(() => opts.cookie) },
    fetch: opts.fetch ?? ((async () => new Response("{}", { status: 200 })) as never),
  };
}

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  env.REPORT_EDIT_KEY = "s3cret";
  env.PROSPECT_REPORT_URL = "https://ops.test";
  env.PROSPECT_EDIT_TOKEN = "shared";
});

describe("POST /api/audit-edit", () => {
  it("forwards to maintenance with the shared token", async () => {
    let seenUrl = "";
    let seenAuth = "";
    let seenBody = "";
    const res = await POST(
      evt({
        cookie: "s3cret",
        fetch: (async (url: string, init: RequestInit) => {
          seenUrl = url;
          seenAuth = new Headers(init.headers).get("authorization") ?? "";
          seenBody = String(init.body);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }) as never,
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(seenUrl).toBe(`https://ops.test/api/audit-report/${TOKEN}/overrides`);
    expect(seenAuth).toBe("Bearer shared");
    expect(JSON.parse(seenBody)).toEqual({ overrides: MAP });
  });

  it("refuses without the edit cookie, and does not call upstream", async () => {
    const upstream = vi.fn();
    const res = await POST(evt({ fetch: upstream as never }) as never);
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a wrong cookie", async () => {
    const res = await POST(evt({ cookie: "wrong" }) as never);
    expect(res.status).toBe(404);
  });

  it("fails closed when PROSPECT_EDIT_TOKEN is unset", async () => {
    delete env.PROSPECT_EDIT_TOKEN;
    const res = await POST(evt({ cookie: "s3cret" }) as never);
    expect(res.status).toBe(503);
  });

  it("fails closed when REPORT_EDIT_KEY is unset", async () => {
    delete env.REPORT_EDIT_KEY;
    const upstream = vi.fn();
    const res = await POST(evt({ cookie: "s3cret", fetch: upstream as never }) as never);
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects a malformed report token before calling upstream", async () => {
    const upstream = vi.fn();
    const res = await POST(
      evt({
        cookie: "s3cret",
        body: { token: "../etc", overrides: MAP },
        fetch: upstream as never,
      }) as never,
    );
    expect(res.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("surfaces an upstream refusal rather than reporting success", async () => {
    const res = await POST(
      evt({
        cookie: "s3cret",
        fetch: (async () => new Response('{"ok":false}', { status: 400 })) as never,
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  // The half-working state a divergence between this route and the edit route
  // would produce: an editor that opens and accepts typing, and saves that all
  // 404. Both read the key through `configuredEditKey`, so a pasted newline is
  // survivable in the same way on both sides.
  it("survives a pasted newline in REPORT_EDIT_KEY, like the edit route does", async () => {
    env.REPORT_EDIT_KEY = "s3cret\n";
    const res = await POST(evt({ cookie: "s3cret" }) as never);
    expect(res.status).toBe(200);
  });

  it("treats a whitespace-only REPORT_EDIT_KEY as unset", async () => {
    env.REPORT_EDIT_KEY = "   ";
    const upstream = vi.fn();
    const res = await POST(evt({ cookie: "   ", fetch: upstream as never }) as never);
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
