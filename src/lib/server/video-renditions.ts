import {
  findStuck,
  findVideos,
  mergeFound,
  needsEncode,
  resolveVideo,
} from "@reddoorla/maintenance/video-pipeline";
import type { DocLike, Renditions } from "@reddoorla/maintenance/video-pipeline";
import { VIDEO_MEDIA_BASE, VIDEO_RULES, VIDEO_SITE } from "../video/pipeline";

/** How long one build-time resolution serves every page. */
const TTL_MS = 5 * 60 * 1000;
/** Each manifest read gets this long before it counts as no rendition. */
const FETCH_TIMEOUT_MS = 3000;
/** The whole build gets this long; past it every video plays its Prismic file. */
const OVERALL_TIMEOUT_MS = 10 * 1000;

export type RenditionsOptions = {
  /** A Prismic preview session: neither read nor write the memo, so drafts are never shared. */
  preview?: boolean;
  /** Test seams. Defaults are 3 s per manifest read and 10 s for the whole build. */
  fetchTimeoutMs?: number;
  overallTimeoutMs?: number;
};

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
 * slice plays its Prismic file, as it did before R2. Nor does it hang: each
 * manifest read is cut off after a few seconds, and the whole build after ten.
 */
export function loadVideoRenditions(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date = new Date(),
  opts: RenditionsOptions = {},
): Promise<Record<string, Renditions>> {
  const preview = opts.preview === true;
  if (!preview && memo !== null && now.getTime() - memo.at < TTL_MS) return memo.promise;
  const promise = build(client, fetchFn, now, opts);
  if (!preview) memo = { at: now.getTime(), promise };
  return promise;
}

/** `fetchFn` with every call aborted after `ms`, keeping any signal the call already has. */
function withTimeout(fetchFn: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetchFn(input, { ...init, signal });
  };
}

async function build(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date,
  opts: RenditionsOptions,
): Promise<Record<string, Renditions>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const overall = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), opts.overallTimeoutMs ?? OVERALL_TIMEOUT_MS);
  });
  try {
    const work = resolveAll(
      client,
      withTimeout(fetchFn, opts.fetchTimeoutMs ?? FETCH_TIMEOUT_MS),
      now,
    );
    const out = await Promise.race([work, overall]);
    if (out === null) {
      console.warn("[video-pipeline] renditions timed out, playing Prismic files");
      return {};
    }
    return out;
  } catch (err) {
    console.warn("[video-pipeline] renditions unavailable, playing Prismic files:", err);
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAll(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date,
): Promise<Record<string, Renditions>> {
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
  // A slice plays its R2 copy only when that copy is the class the slice asks for.
  const out: Record<string, Renditions> = {};
  for (const video of found) {
    const r = resolved.get(video.url);
    if (r && r.onR2 && !needsEncode(video, r)) out[video.url] = r;
  }
  return out;
}
