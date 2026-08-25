import { describe, it, expect, vi } from "vitest";

// Prismic is mocked: this covers the caching policy, not the content query.
vi.mock("$lib/prismicio", () => ({
  createClient: () => ({ getByType: async () => ({ results: [] }) }),
}));

const { load } = await import("./+layout.server");

type Evt = Parameters<typeof load>[0];

function run(pathname: string, cookie: string | undefined = undefined) {
  const setHeaders = vi.fn();
  const evt = {
    url: new URL(`https://reddoorla.com${pathname}`),
    fetch: globalThis.fetch,
    cookies: { get: () => cookie },
    setHeaders,
  } as unknown as Evt;
  return { promise: load(evt), setHeaders };
}

function headersFrom(setHeaders: ReturnType<typeof vi.fn>): Record<string, string> {
  return Object.assign({}, ...setHeaders.mock.calls.map((c) => c[0] as Record<string, string>));
}

describe("root layout — durable CDN caching", () => {
  it("caches an ordinary page at the edge", async () => {
    const { promise, setHeaders } = run("/portfolio");
    await promise;
    expect(headersFrom(setHeaders)["Netlify-CDN-Cache-Control"]).toContain("durable");
  });

  it("skips the cache for a Prismic preview session", async () => {
    const { promise, setHeaders } = run("/portfolio", "1");
    await promise;
    expect(headersFrom(setHeaders)["Netlify-CDN-Cache-Control"]).toBeUndefined();
  });

  // A prospect's report must not sit in shared, persistent storage — and
  // `public, durable` here would directly contradict the `private, no-store`
  // the route sets, with the CDN directive winning.
  it("never puts an audit report in the durable CDN", async () => {
    const { promise, setHeaders } = run("/audit/aB3-_xY9zQ1rS2tU4vW6xY");
    await promise;
    const headers = headersFrom(setHeaders);
    expect(headers["Netlify-CDN-Cache-Control"]).toBeUndefined();
    expect(headers["Netlify-Vary"]).toBeUndefined();
  });
});
