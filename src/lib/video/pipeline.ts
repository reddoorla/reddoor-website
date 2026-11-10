import type { VideoRules } from "@reddoorla/maintenance/video-pipeline";
import rules from "./pipeline-rules.json";

/** The site's name in the R2 key space: keys are `reddoor-website/<slug>/…`. */
export const VIDEO_SITE = "reddoor-website";
/** The GitHub repository the `video-encode` workflow runs in. */
export const VIDEO_REPO = "reddoorla/reddoor-website";
/** The public origin the R2 bucket is served on. */
export const VIDEO_MEDIA_BASE = "https://media.reddoorla.com";
/** Which Prismic fields hold videos, and whether each plays as background or player. */
// The JSON types its class values as plain strings; the cast names them.
export const VIDEO_RULES = rules as VideoRules;
