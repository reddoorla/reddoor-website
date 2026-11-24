import { HEALTH_FIXES } from "./narrative";

/**
 * The sentence that points from the problem rows under "Does it work" to
 * "what to fix" (DES-04). It used to promise "Each of these has a matching
 * item" whenever a row alerted, and most site-check rows have no fix spec.
 *
 * "Each" is printed only when every problem row has a spec in `HEALTH_FIXES`,
 * the map the health fixes are written from. Otherwise the sentence makes no
 * count: the audit's own measured fixes are keyed differently from the rows
 * (`headings-h1` against `h1-present`), so a number here would be a guess.
 * "The ones we would act on first" is true whenever the report has any fix,
 * and nothing is printed when it has none.
 *
 * Returns the text either side of the "what to fix" link, or null.
 */
export function fixLinkSentence(
  problemKeys: readonly string[],
  reportHasFixes: boolean,
): { before: string; after: string } | null {
  if (problemKeys.length === 0 || !reportHasFixes) return null;
  if (problemKeys.every((key) => Object.hasOwn(HEALTH_FIXES, key))) {
    return { before: "Each of these has a matching item in ", after: "." };
  }
  return { before: "The ones we would act on first are in ", after: "." };
}
