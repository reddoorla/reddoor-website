import type { DocLike, RelayConfig } from "@reddoorla/maintenance/video-pipeline";
import { VIDEO_MEDIA_BASE, VIDEO_REPO, VIDEO_RULES, VIDEO_SITE } from "../video/pipeline";
import { withTimeout } from "./video-renditions";

/** Each call the relay makes (a manifest read on R2, the dispatch) gets this long. */
const RELAY_FETCH_TIMEOUT_MS = 3_000;

/** What the Netlify relay function needs from its environment and from Prismic. */
export type RelayDeps = {
  fetch: typeof fetch;
  getDocuments: (ids: string[]) => Promise<DocLike[]>;
  /** Test seam: the per-call timeout. Defaults to 3 s. */
  fetchTimeoutMs?: number;
};

/**
 * The relay's configuration: the site's constants, the three secrets and
 * variables read from `env`, and the two effects passed in. Kept out of the
 * `.mts` adapter so a test can run the whole webhook through it. Every fetch
 * the relay makes is aborted after a few seconds, so a read that never settles
 * is treated as a failure (the video is not on R2) rather than a hung webhook.
 */
export function buildRelayConfig(
  env: Record<string, string | undefined>,
  deps: RelayDeps,
): RelayConfig {
  return {
    secret: env.PRISMIC_WEBHOOK_SECRET,
    site: VIDEO_SITE,
    repo: VIDEO_REPO,
    dispatchToken: env.VIDEO_DISPATCH_TOKEN,
    mediaBase: VIDEO_MEDIA_BASE,
    rules: VIDEO_RULES,
    getDocuments: deps.getDocuments,
    fetch: withTimeout(deps.fetch, deps.fetchTimeoutMs ?? RELAY_FETCH_TIMEOUT_MS),
  };
}
