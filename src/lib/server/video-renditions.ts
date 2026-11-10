import {
  findStuck,
  findVideos,
  mergeFound,
  resolveVideo,
} from "@reddoorla/maintenance/video-pipeline";
import type { DocLike, Renditions } from "@reddoorla/maintenance/video-pipeline";
import { VIDEO_MEDIA_BASE, VIDEO_RULES, VIDEO_SITE } from "../video/pipeline";

/** How long one build-time resolution serves every page. */
const TTL_MS = 5 * 60 * 1000;

let memo: { at: number; promise: Promise<Record<string, Renditions>> } | null = null;

/** Forget the memo. For tests only. */
export function resetVideoRenditionsCache(): void {
  memo = null;
}

/**
 * The R2 renditions of every video on the site, keyed by the Prismic url the
 * slices hold. Prerender renders every page in one process, so the first call
 * does the work and the rest share it for five minutes.
 *
 * It never throws. A failure logs a warning and gives no renditions, and every
 * slice plays its Prismic file, as it did before R2.
 */
export function loadVideoRenditions(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date = new Date(),
): Promise<Record<string, Renditions>> {
  if (memo !== null && now.getTime() - memo.at < TTL_MS) return memo.promise;
  const promise = build(client, fetchFn, now);
  memo = { at: now.getTime(), promise };
  return promise;
}

async function build(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date,
): Promise<Record<string, Renditions>> {
  try {
    const docs = await client.dangerouslyGetAll();
    const found = mergeFound(docs.flatMap((doc) => findVideos(doc, VIDEO_RULES)));
    const cache = new Map<string, Promise<Renditions>>();
    const resolved = new Map<string, Renditions>();
    await Promise.all(
      found.map(async (video) => {
        const r = await resolveVideo(video.url, {
          site: VIDEO_SITE,
          mediaBase: VIDEO_MEDIA_BASE,
          fetch: fetchFn,
          cache,
        });
        resolved.set(video.url, r);
      }),
    );
    for (const stuck of findStuck(found, resolved, now)) {
      console.warn(
        "[video-pipeline] stuck on Prismic:",
        stuck.url,
        `(document ${stuck.documentId}, published ${stuck.publishedAt ?? "unknown"})`,
      );
    }
    const out: Record<string, Renditions> = {};
    for (const [url, r] of resolved) if (r.onR2) out[url] = r;
    return out;
  } catch (err) {
    console.warn("[video-pipeline] renditions unavailable, playing Prismic files:", err);
    return {};
  }
}
