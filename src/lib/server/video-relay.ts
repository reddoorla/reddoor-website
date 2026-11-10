import type { DocLike, RelayConfig } from "@reddoorla/maintenance/video-pipeline";
import { VIDEO_MEDIA_BASE, VIDEO_REPO, VIDEO_RULES, VIDEO_SITE } from "../video/pipeline";

/** What the Netlify relay function needs from its environment and from Prismic. */
export type RelayDeps = {
  fetch: typeof fetch;
  getDocuments: (ids: string[]) => Promise<DocLike[]>;
};

/**
 * The relay's configuration: the site's constants, the three secrets and
 * variables read from `env`, and the two effects passed in. Kept out of the
 * `.mts` adapter so a test can run the whole webhook through it.
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
    fetch: deps.fetch,
  };
}
