import { TAG_EVENT_BEW } from "./constants";

/**
 * Tags that record WHERE a lead came from when the utm values cannot (they are
 * note text in the CRM, not fields). One entry today: the BEW short link sets
 * utm_source=bew (src/lib/bew.ts). Reads the landing URL the browser reported,
 * the same one attributionLines renders, so the two never disagree.
 */
export function eventTags(sourceUrl: string): string[] {
  let source: string;
  try {
    source = new URL(sourceUrl).searchParams.get("utm_source")?.trim().toLowerCase() ?? "";
  } catch {
    return [];
  }
  return source === "bew" ? [TAG_EVENT_BEW] : [];
}
