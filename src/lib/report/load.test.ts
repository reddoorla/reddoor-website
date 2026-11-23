import { describe, it, expect, vi } from "vitest";

vi.mock("$app/env/private", () => ({
  PROSPECT_REPORT_URL: "https://ops.test",
  // W1: read only when an edit cookie is present, to decide whether to send
  // the edit token upstream.
  REPORT_EDIT_KEY: "the-edit-key",
  PROSPECT_EDIT_TOKEN: "the-edit-token",
}));

const { loadReport } = await import("./load");
import { EDIT_COOKIE } from "./edit-auth";

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
      // Always an object, never absent, so no caller has to branch on it.
      overrides: {},
      approved: true,
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

  // A 200 carrying no report is the upstream contradicting itself: it has a 404
  // to say "gone" with, so an empty body is a fault on our side of the wire and
  // must not be laundered into "your report was deleted" either.
  it("does not turn a 200 carrying no report into a 404", async () => {
    const { evt } = event(TOKEN, respondWith(200, null));
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

    for (const [route, own] of [
      [page, {}],
      [print, { siteChrome: false }],
    ] as const) {
      expect(route.prerender).toBe(false);

      const { evt, setHeaders } = event(TOKEN, respondWith(200, REPORT));
      // Both routes must carry no-referrer — the print route is fetched by our
      // own runner, but it is served on the same public token.
      await expect(route.load(evt as never)).resolves.toEqual({
        report: REPORT,
        overrides: {},
        approved: true,
        meta_referrer: "no-referrer",
        // Every report shares the static audit card.
        meta_image: "/og/site/audit.png",
        ...own,
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

describe("loadReport — edit sessions are not readers", () => {
  /** Captures the headers sent upstream, and every cookie name asked for. */
  function spyEvent(cookieValue: string | undefined) {
    const seen: Record<string, string> = {};
    const asked: string[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      Object.assign(seen, Object.fromEntries(new Headers(init?.headers).entries()));
      return new Response(JSON.stringify({ report: REPORT, overrides: null }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    return {
      evt: {
        params: { token: TOKEN },
        fetch: fetchImpl,
        setHeaders: () => {},
        cookies: {
          get: (name: string) => {
            asked.push(name);
            return cookieValue;
          },
        },
      },
      seen,
      asked,
    };
  }

  it("declares an edit session upstream when the edit cookie is present", async () => {
    const { evt, seen } = spyEvent("s3cret");
    await loadReport(evt as never);
    expect(seen["x-reddoor-edit-session"]).toBe("1");
  });

  // The obvious version of the test above hands back a value for ANY cookie
  // name, so it passes just as well against an implementation reading the wrong
  // one — and the symptom of that bug is `opened_at` silently recording every
  // operator preview as a prospect read, which nothing else would catch.
  it("asks for the edit cookie by name, not just for some cookie", async () => {
    const { evt, asked } = spyEvent("s3cret");
    await loadReport(evt as never);
    expect(asked).toContain(EDIT_COOKIE);
  });

  it("sends no such header for an ordinary reader", async () => {
    const { evt, seen } = spyEvent(undefined);
    await loadReport(evt as never);
    expect(seen["x-reddoor-edit-session"]).toBeUndefined();
  });

  // A real SvelteKit event always carries `cookies`, but `loadReport` is called
  // in tests without one and must take the ordinary-reader path rather than
  // throwing on a missing property.
  it("treats a caller with no cookies at all as an ordinary reader", async () => {
    const seen: Record<string, string> = {};
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      Object.assign(seen, Object.fromEntries(new Headers(init?.headers).entries()));
      return new Response(JSON.stringify({ report: REPORT, overrides: null }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    await loadReport({
      params: { token: TOKEN },
      fetch: fetchImpl,
      setHeaders: () => {},
    } as never);
    expect(seen["x-reddoor-edit-session"]).toBeUndefined();
  });
});

describe("W1: drafts reach only a verified editor; superseded links redirect", () => {
  function captured(cookieValue: string | undefined, res: Response, pathname = `/audit/${TOKEN}`) {
    const seen: Record<string, string>[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ ...(init?.headers as Record<string, string>) });
      return res;
    });
    return {
      seen,
      evt: {
        params: { token: TOKEN },
        url: new URL(`https://reddoorla.test${pathname}`),
        fetch: fetchImpl,
        setHeaders: vi.fn(),
        cookies: { get: (n: string) => (n === EDIT_COOKIE ? cookieValue : undefined) },
      },
    };
  }
  const ok = () =>
    new Response(JSON.stringify({ report: REPORT, overrides: null, approvedAt: null }));

  it("sends the edit token only when the cookie matches REPORT_EDIT_KEY", async () => {
    const good = captured("the-edit-key", ok());
    await loadReport(good.evt);
    expect(good.seen[0]!.authorization).toBe("Bearer the-edit-token");

    const forged = captured("not-the-key", ok());
    await loadReport(forged.evt);
    expect(forged.seen[0]!.authorization).toBeUndefined();

    const reader = captured(undefined, ok());
    await loadReport(reader.evt);
    expect(reader.seen[0]!.authorization).toBeUndefined();
  });

  it("marks a draft as not approved", async () => {
    const { evt } = captured("the-edit-key", ok());
    await expect(loadReport(evt)).resolves.toMatchObject({ approved: false });
  });

  it("redirects a superseded link to the newer report, keeping /print", async () => {
    const NEXT = "zZ9-_yX8wQ0rS2tU4vW6xY";
    const gone = new Response(JSON.stringify({ error: "superseded", supersededBy: NEXT }), {
      status: 410,
    });
    const { evt } = captured(undefined, gone, `/audit/${TOKEN}/print`);
    await expect(loadReport(evt)).rejects.toMatchObject({
      status: 307,
      location: `/audit/${NEXT}/print`,
    });
  });

  it("404s a 410 whose pointer is not a token", async () => {
    const gone = new Response(JSON.stringify({ supersededBy: "../../etc" }), { status: 410 });
    const { evt } = captured(undefined, gone);
    await expect(loadReport(evt)).rejects.toMatchObject({ status: 404 });
  });
});

describe("W1 review round 1: a hidden row never reaches a reader's page data", () => {
  const HIDDEN_TITLE = "A finding the reviewer judged wrong";
  const body = {
    report: {
      url: "https://acme.example/",
      analyze: { ok: true, data: { fixes: [{ title: HIDDEN_TITLE }, { title: "Keep me" }] } },
    },
    overrides: {
      "analyze.data.fixes[0]": { original: HIDDEN_TITLE, text: "", hidden: true },
      "composed:headlineFinding": { original: "Generated.", text: "Edited." },
    },
    approvedAt: "2026-11-23T20:00:00.000Z",
  };

  it("the reader's load carries neither the hidden row nor its override", async () => {
    const { evt } = event(TOKEN, respondWith(200, body));
    const data = await loadReport(evt);
    expect(JSON.stringify(data)).not.toContain(HIDDEN_TITLE);
    // The composed rewording still reaches the renderer, which matches it.
    expect(data.overrides).toEqual({
      "composed:headlineFinding": { original: "Generated.", text: "Edited." },
    });
  });

  it("the editor's load keeps the stored payload and the whole map, to put a row back", async () => {
    const { evt } = event(TOKEN, respondWith(200, body));
    const data = await loadReport(evt, { forEditor: true });
    expect(JSON.stringify(data.report)).toContain(HIDDEN_TITLE);
    expect(Object.keys(data.overrides)).toHaveLength(2);
  });
});
