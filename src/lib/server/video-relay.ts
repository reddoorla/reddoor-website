import type { DocLike, RelayConfig } from "@reddoorla/maintenance/video-pipeline";
import { VIDEO_MEDIA_BASE, VIDEO_REPO, VIDEO_RULES, VIDEO_SITE } from "../video/pipeline";
import { withTimeout } from "./video-renditions";

/** Each call the relay makes (a manifest read on R2, the dispatch) gets this long. */
const RELAY_FETCH_TIMEOUT_MS = 3_000;
/**
 * The whole webhook gets this long, across every video. The library handles the
 * videos one after another, each with up to two calls, so per-call limits alone
 * add up past Netlify's 10 s synchronous-function limit.
 */
const RELAY_OVERALL_TIMEOUT_MS = 8_000;

/**
 * `work`, or a rejection with the signal's reason as soon as `signal` aborts,
 * whichever comes first. The listener is removed when `work` settles.
 */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/** What the Netlify relay function needs from its environment and from Prismic. */
export type RelayDeps = {
  fetch: typeof fetch;
  getDocuments: (ids: string[]) => Promise<DocLike[]>;
  /** Test seam: the per-call timeout. Defaults to 3 s. */
  fetchTimeoutMs?: number;
  /** Test seam: the overall budget for one webhook. Defaults to 8 s. */
  overallTimeoutMs?: number;
};

/**
 * The relay's configuration: the site's constants, the three secrets and
 * variables read from `env`, and the two effects passed in. Kept out of the
 * `.mts` adapter so a test can run the whole webhook through it. Every fetch
 * the relay makes is aborted after a few seconds, and every fetch of one
 * webhook after the overall budget, so a read that never settles is treated as
 * a failure (the video is not on R2) rather than a hung webhook. Call this once
 * per request: the overall budget starts here.
 */
export function buildRelayConfig(
  env: Record<string, string | undefined>,
  deps: RelayDeps,
): RelayConfig {
  const overall = AbortSignal.timeout(deps.overallTimeoutMs ?? RELAY_OVERALL_TIMEOUT_MS);
  const perCall = withTimeout(deps.fetch, deps.fetchTimeoutMs ?? RELAY_FETCH_TIMEOUT_MS);
  return {
    secret: env.PRISMIC_WEBHOOK_SECRET,
    site: VIDEO_SITE,
    repo: VIDEO_REPO,
    dispatchToken: env.VIDEO_DISPATCH_TOKEN,
    mediaBase: VIDEO_MEDIA_BASE,
    rules: VIDEO_RULES,
    // Prismic's read runs before any bounded call, so it is bounded by the same budget.
    getDocuments: async (ids) => untilAborted(deps.getDocuments(ids), overall),

    fetch: (input, init) =>
      perCall(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([overall, init.signal]) : overall,
      }),
  };
}
