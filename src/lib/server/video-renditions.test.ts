import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { videoKey } from "@reddoorla/maintenance/video-pipeline";
import type { DocLike } from "@reddoorla/maintenance/video-pipeline";
import { loadVideoRenditions, resetVideoRenditionsCache } from "./video-renditions";

const ALPHA = "https://reddoor-la.cdn.prismic.io/reddoor-la/a1_alpha-1080.mp4";
const BETA = "https://reddoor-la.cdn.prismic.io/reddoor-la/b2_beta-1080.mp4";
const NOW = new Date("2026-11-10T12:00:00Z");
/** Alpha's R2 key, from the library, so the test follows the key format rather than restating it. */
const ALPHA_KEY = videoKey("reddoor-website", ALPHA) as string;
const ALPHA_DIR = "player-20261110T103000Z";

const media = (url: string) => ({
  link_type: "Media",
  url,
  name: url.split("/").pop(),
  kind: "file",
});

/** A document with one offer_hero slice (a player) whose video is `url`. */
const doc = (id: string, url: string, publishedAt: string): DocLike => ({
  id,
  last_publication_date: publishedAt,
  data: {
    body: [{ slice_type: "offer_hero", primary: { video_mp4: media(url) } }],
  },
});

const MANIFEST = {
  version: 1,
  source: "/reddoor-la/a1_alpha-1080.mp4",
  class: "player",
  key: ALPHA_KEY,
  dir: ALPHA_DIR,
  encodedAt: "2026-11-10T10:30:00Z",
  files: { mp4: "alpha-1080.mp4", poster: "alpha-poster.jpg" },
};

/** A background-class manifest for Alpha, as the encoder writes it for a background slot. */
const BACKGROUND_MANIFEST = {
  ...MANIFEST,
  class: "background",
  dir: "background-20261110T103000Z",
};

/** Alpha has a manifest on R2 (`manifest` by default); every other url is a 404. */
function fakeFetch(manifest: object = MANIFEST) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url === `https://media.reddoorla.com/${ALPHA_KEY}/manifest.json`) {
      return new Response(JSON.stringify(manifest), { status: 200 });
    }
    return new Response(null, { status: 404 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("loadVideoRenditions", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetVideoRenditionsCache();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("returns only the videos whose manifest is on R2", async () => {
    const client = {
      dangerouslyGetAll: async () => [
        doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z"),
        doc("beta-doc", BETA, "2026-11-10T11:50:00Z"),
      ],
    };

    const out = await loadVideoRenditions(client, fakeFetch(), NOW);

    expect(Object.keys(out)).toEqual([ALPHA]);
    expect(out[ALPHA]).toMatchObject({
      mp4: `https://media.reddoorla.com/${ALPHA_KEY}/${ALPHA_DIR}/alpha-1080.mp4`,
      poster: `https://media.reddoorla.com/${ALPHA_KEY}/${ALPHA_DIR}/alpha-poster.jpg`,
      onR2: true,
    });
  });

  it("gives {} rather than throwing when the Prismic read fails", async () => {
    const client = {
      dangerouslyGetAll: () => Promise.reject(new Error("Prismic is down")),
    };

    await expect(loadVideoRenditions(client, fakeFetch(), NOW)).resolves.toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it("does not keep a timed-out build for the five-minute memo", async () => {
    const slow = {
      dangerouslyGetAll: () =>
        new Promise<DocLike[]>((resolve) =>
          setTimeout(() => resolve([doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")]), 50),
        ),
    };

    const first = await loadVideoRenditions(slow, fakeFetch(), NOW, { overallTimeoutMs: 20 });
    expect(first).toEqual({});

    const fast = {
      dangerouslyGetAll: async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")],
    };
    const second = await loadVideoRenditions(fast, fakeFetch(), new Date(NOW.getTime() + 60_000));

    expect(Object.keys(second)).toEqual([ALPHA]);
  });

  it("does not keep a failed Prismic read for the five-minute memo", async () => {
    let reads = 0;
    const flaky = {
      dangerouslyGetAll: async () => {
        reads += 1;
        if (reads === 1) throw new Error("503");
        return [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")];
      },
    };

    const first = await loadVideoRenditions(flaky, fakeFetch(), NOW);
    expect(first).toEqual({});

    const second = await loadVideoRenditions(flaky, fakeFetch(), new Date(NOW.getTime() + 60_000));

    expect(reads).toBe(2);
    expect(Object.keys(second)).toEqual([ALPHA]);
  });

  it("reads Prismic once for two calls within five minutes", async () => {
    const dangerouslyGetAll = vi.fn(async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")]);
    const client = { dangerouslyGetAll };

    const first = await loadVideoRenditions(client, fakeFetch(), NOW);
    const second = await loadVideoRenditions(client, fakeFetch(), new Date(NOW.getTime() + 60_000));

    expect(dangerouslyGetAll).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it("warns that a video published two hours ago is stuck on Prismic", async () => {
    const client = {
      dangerouslyGetAll: async () => [doc("beta-doc", BETA, "2026-11-10T10:00:00Z")],
    };

    await loadVideoRenditions(client, fakeFetch(), NOW);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[video-pipeline] stuck"),
      BETA,
      expect.any(String),
    );
  });

  it("gives no entry for a player slot whose R2 copy is a background rendition", async () => {
    const client = {
      dangerouslyGetAll: async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")],
    };

    const out = await loadVideoRenditions(client, fakeFetch(BACKGROUND_MANIFEST), NOW);

    expect(out).not.toHaveProperty([ALPHA]);
  });

  it("keeps a background slot's URL when its R2 copy is a player rendition", async () => {
    const client = {
      dangerouslyGetAll: async () => [
        {
          id: "alpha-doc",
          last_publication_date: "2026-11-10T10:00:00Z",
          data: {
            body: [{ slice_type: "case_study", primary: { video_mp4: media(ALPHA) } }],
          },
        },
      ],
    };

    const out = await loadVideoRenditions(client, fakeFetch(MANIFEST), NOW);

    expect(Object.keys(out)).toEqual([ALPHA]);
  });

  it("gives {} and does not hang when a manifest fetch never settles unless its signal aborts", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const hangingFetch = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          seen.push(init?.signal ?? undefined);
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ) as unknown as typeof fetch;
    const client = {
      dangerouslyGetAll: async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")],
    };

    const out = await loadVideoRenditions(client, hangingFetch, NOW, { fetchTimeoutMs: 20 });

    expect(out).toEqual({});
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((signal) => signal instanceof AbortSignal)).toBe(true);
  });

  it("gives {} with the timeout warning when Prismic never answers", async () => {
    const client = { dangerouslyGetAll: () => new Promise<DocLike[]>(() => {}) };

    const out = await loadVideoRenditions(client, fakeFetch(), NOW, { overallTimeoutMs: 20 });

    expect(out).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      "[video-pipeline] renditions timed out, playing Prismic files",
    );
  });

  it("gives {} with the timeout warning when a fetch ignores its signal", async () => {
    const client = {
      dangerouslyGetAll: async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")],
    };
    const deafFetch = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;

    const out = await loadVideoRenditions(client, deafFetch, NOW, {
      fetchTimeoutMs: 10_000,
      overallTimeoutMs: 20,
    });

    expect(out).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      "[video-pipeline] renditions timed out, playing Prismic files",
    );
  });

  it("a preview call neither reads nor writes the memo", async () => {
    const dangerouslyGetAll = vi.fn(async () => [doc("alpha-doc", ALPHA, "2026-11-10T10:00:00Z")]);
    const client = { dangerouslyGetAll };

    await loadVideoRenditions(client, fakeFetch(), NOW);
    await loadVideoRenditions(client, fakeFetch(), NOW, { preview: true });
    expect(dangerouslyGetAll).toHaveBeenCalledTimes(2);

    await loadVideoRenditions(client, fakeFetch(), NOW);
    expect(dangerouslyGetAll).toHaveBeenCalledTimes(2);
  });
});
