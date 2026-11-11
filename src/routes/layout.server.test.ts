import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { manifestUrl, videoKey } from "@reddoorla/maintenance/video-pipeline";
import { resetVideoRenditionsCache } from "$lib/server/video-renditions";

// Prismic is mocked: the caching tests need no documents, the video tests set
// `docs` to what Prismic would return for the whole site.
const prismic = vi.hoisted(() => ({ docs: [] as unknown[] }));
vi.mock("$lib/prismicio", () => ({
  createClient: () => ({
    getByType: async () => ({ results: [] }),
    dangerouslyGetAll: async () => prismic.docs,
  }),
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

// The build's R2 renditions reach the page's `videos`, through the same client
// the layout reads Prismic with. Fixtures follow pipeline-rules.json: an
// offer_hero slice's video_mp4 is a player.
const ALPHA = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_alpha-1080.mp4";
const ALPHA_KEY = videoKey("reddoor-website", ALPHA) as string;
const ALPHA_DIR = "player-20261110T103000Z";
const MANIFEST = {
  version: 1,
  source: "/reddoor-la/a1_alpha-1080.mp4",
  class: "player",
  key: ALPHA_KEY,
  dir: ALPHA_DIR,
  encodedAt: "2026-11-10T10:30:00Z",
  files: { mp4: "alpha-1080.mp4", poster: "alpha-poster.jpg" },
};

const alphaDoc = {
  id: "alpha-doc",
  last_publication_date: "2026-11-10T10:00:00Z",
  data: {
    body: [
      {
        slice_type: "offer_hero",
        primary: {
          video_mp4: { link_type: "Media", url: ALPHA, name: "alpha-1080.mp4", kind: "file" },
        },
      },
    ],
  },
};

/** R2 holds Alpha's manifest; every other read is a 404 (not encoded). */
function r2Fetch() {
  return vi.fn(async (input: string | URL | Request) => {
    if (String(input) === manifestUrl("https://media.reddoorla.com", ALPHA_KEY)) {
      return new Response(JSON.stringify(MANIFEST), { status: 200 });
    }
    return new Response(null, { status: 404 });
  });
}

describe("root layout — R2 video renditions", () => {
  beforeEach(() => {
    resetVideoRenditionsCache();
    prismic.docs = [alphaDoc];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    prismic.docs = [];
  });

  it("gives the page the R2 file of each video, keyed by its Prismic url", async () => {
    vi.stubGlobal("fetch", r2Fetch());

    const { promise } = run("/portfolio");
    const data = (await promise) as unknown as { videos: Record<string, { mp4: string }> };

    expect(data.videos[ALPHA]?.mp4).toMatch(/^https:\/\/media\.reddoorla\.com\//);
  });

  it("a preview session reads R2 itself and does not reuse the public memo", async () => {
    const fetchFn = r2Fetch();
    vi.stubGlobal("fetch", fetchFn);

    await run("/portfolio").promise;
    const afterPublic = fetchFn.mock.calls.length;
    expect(afterPublic).toBeGreaterThan(0);

    await run("/portfolio", "1").promise;
    const afterPreview = fetchFn.mock.calls.length;
    expect(afterPreview).toBeGreaterThan(afterPublic);

    // The public memo is still there for the next visitor.
    await run("/portfolio").promise;
    expect(fetchFn.mock.calls.length).toBe(afterPreview);
  });
});
