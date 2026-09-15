import { BEW_UTM } from "../bew";
import { TAG_EVENT_BEW } from "./constants";

/**
 * Tags that record WHERE a lead came from when the utm values cannot (they are
 * note text in the CRM, not fields). One entry today: a lead who arrived
 * through the BEW short link (src/lib/bew.ts). The link sets utm_source=bew
 * and utm_campaign=bew-2026, and collateral may override either one, since
 * bewTarget lets any incoming utm_* win, so the tag fires on either match.
 * Reads the landing URL the browser reported on this touch; on the second
 * touch that is also the input attributionLines renders into the note.
 */
export function eventTags(sourceUrl: string): string[] {
  try {
    const params = new URL(sourceUrl).searchParams;
    const isBew =
      utm(params, "utm_source") === BEW_UTM.utm_source ||
      utm(params, "utm_campaign") === BEW_UTM.utm_campaign;
    return isBew ? [TAG_EVENT_BEW] : [];
  } catch {
    return [];
  }
}

function utm(params: URLSearchParams, key: string): string {
  return params.get(key)?.trim().toLowerCase() ?? "";
}
