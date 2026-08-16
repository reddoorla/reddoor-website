/**
 * The visible step number for an `iconColumns` step, derived from its position
 * in the group rather than authored in Prismic. Reordering or inserting a step
 * in the CMS renumbers the rest for free, and there is no way for the label to
 * disagree with the actual order.
 *
 * Zero-padded to two digits because the board sets them as `01 / 02 / 03`; past
 * nine the pad would misalign the circles, so it stops at that point rather than
 * padding to three.
 */
export function stepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}
