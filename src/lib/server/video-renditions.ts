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
const FETCH_TIMEOUT_MS = 2_000;
/** The whole build gets this long; past it every video plays its Prismic file. */
// Under Netlify's 10 s synchronous-function limit, so an SSR request still renders the Prismic fallback.
const OVERALL_TIMEOUT_MS = 4_000;
/** A degraded build (a stalled, failed or unparseable manifest read) is remembered this briefly, so a sustained R2 stall does not re-run the fan-out on every request. */
const DEGRADED_TTL_MS = 30 * 1000;

export type RenditionsOptions = {
  /** A Prismic preview session: neither read nor write the memo, so drafts are never shared. */
  preview?: boolean;
  /** Test seams. Defaults are 2 s per manifest read and 4 s for the whole build. */
  fetchTimeoutMs?: number;
  overallTimeoutMs?: number;
};

let memo: { at: number; ttlMs: number; promise: Promise<Record<string, Renditions>> } | null = null;

/** Forget the memo. For tests only. */
export function resetVideoRenditionsCache(): void {
  memo = null;
}

/**
 * The R2 renditions of every video on the site, keyed by the Prismic url the
 * slices hold. Prerender renders every page in one process, so the first call
 * does the work and the rest share it for five minutes (thirty seconds when the
 * build was degraded).
 *
 * It never throws. A failure logs a warning and gives no renditions, and every
 * slice plays its Prismic file, as it did before R2. Nor does it hang: each
 * manifest read is cut off after two seconds, and the whole build after four.
 */
export function loadVideoRenditions(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date = new Date(),
  opts: RenditionsOptions = {},
): Promise<Record<string, Renditions>> {
  const preview = opts.preview === true;
  if (!preview && memo !== null && now.getTime() - memo.at < memo.ttlMs) return memo.promise;
  const work = build(client, fetchFn, now, opts);
  const promise = work.then((built) => built.out);
  if (!preview) {
    const entry = { at: now.getTime(), ttlMs: TTL_MS, promise };
    memo = entry;
    // A failed or timed-out build is not remembered at all; a degraded one only briefly.
    void work.then((built) => {
      if (memo !== entry) return;
      if (built.keep === "none") memo = null;
      else if (built.keep === "degraded") entry.ttlMs = DEGRADED_TTL_MS;
    });
  }
  return promise;
}

/** `fetchFn` with every call aborted after `ms`, keeping any signal the call already has. */
export function withTimeout(fetchFn: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetchFn(input, { ...init, signal });
  };
}

/**
 * `fetchFn` as the build sees it: a read that rejects, or answers with
 * anything but 200 or 404, marks the build degraded. A 404 is the normal "not
 * encoded yet" answer; a 5xx, a network error or a timeout is a read whose
 * answer should not be remembered. A 200 is read here, not by the caller, so a
 * body that stalls, errors or is not JSON (a proxy's error page) also marks the
 * build degraded; the caller gets the body back as a fresh Response.
 */
function observed(fetchFn: typeof fetch, onDegraded: () => void): typeof fetch {
  return async (input, init) => {
    let res: Response;
    try {
      res = await fetchFn(input, init);
    } catch (err) {
      onDegraded();
      throw err;
    }
    if (res.status === 404) return res;
    if (res.status !== 200) {
      onDegraded();
      return res;
    }
    let text: string;
    try {
      text = await res.text();
    } catch (err) {
      onDegraded();
      throw err;
    }
    try {
      JSON.parse(text);
    } catch {
      onDegraded();
    }
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

/**
 * The resolved renditions, and how long they may be remembered (`keep`): a
 * healthy build for the full TTL, a degraded one for thirty seconds, and a
 * timed-out or failed build not at all. Every outcome is still returned to the
 * caller.
 */
async function build(
  client: { dangerouslyGetAll(): Promise<DocLike[]> },
  fetchFn: typeof fetch,
  now: Date,
  opts: RenditionsOptions,
): Promise<{ out: Record<string, Renditions>; keep: "healthy" | "degraded" | "none" }> {
  let degraded = false;
  const watched = observed(withTimeout(fetchFn, opts.fetchTimeoutMs ?? FETCH_TIMEOUT_MS), () => {
    degraded = true;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const overall = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), opts.overallTimeoutMs ?? OVERALL_TIMEOUT_MS);
  });
  try {
    const work = resolveAll(client, watched, now);
    const out = await Promise.race([work, overall]);
    if (out === null) {
      console.warn("[video-pipeline] renditions timed out, playing Prismic files");
      return { out: {}, keep: "none" };
    }
    return { out, keep: degraded ? "degraded" : "healthy" };
  } catch (err) {
    console.warn("[video-pipeline] renditions unavailable, playing Prismic files:", err);
    return { out: {}, keep: "none" };
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
