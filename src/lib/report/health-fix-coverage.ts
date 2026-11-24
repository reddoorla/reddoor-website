import { HEALTH_FIXES } from "./narrative";

/**
 * The sentence that points from the problem rows under "Does it work" to
 * "what to fix". A row has a matching item when it has a fix spec: healthFixes
 * writes one for it, or the audit already wrote one that the spec covers. So
 * the claim is decided by the same key map the fixes are written from.
 *
 * Returns the text either side of the "what to fix" link, or null when no
 * problem row has an item and the sentence should not print at all.
 */
export function fixLinkSentence(
  problemKeys: readonly string[],
): { before: string; after: string } | null {
  const total = problemKeys.length;
  const covered = problemKeys.filter((key) => key in HEALTH_FIXES).length;
  if (total === 0 || covered === 0) return null;
  if (covered === total) {
    return { before: "Each of these has a matching item in ", after: "." };
  }
  return {
    before: `${covered} of these have a matching item in `,
    after: "; the rest are listed here so you can check them.",
  };
}
