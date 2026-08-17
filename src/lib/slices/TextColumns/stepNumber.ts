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

/**
 * Pragmatica's side bearings at 14px, in px, measured off the live font with
 * canvas `TextMetrics` (`actualBoundingBoxLeft/Right` against `width`).
 *
 * The figures are tabular — every digit gets the same 8.12px slot — and every
 * digit but one is drawn centred in its slot, with ~0.63px of air on each side.
 * `1` is the exception: its ink starts 1.82px in and ends 2.74px short, so it
 * sits 0.46px left of its own slot. That single asymmetry is the whole reason
 * `01` and `02` cannot share a correction.
 */
const BEARING: Record<string, { left: number; right: number }> = {
  "1": { left: 1.82, right: 2.74 },
};
const BEARING_DEFAULT = { left: 0.63, right: 0.61 };

/**
 * How far to nudge a step numeral so it looks centred in its circle.
 *
 * A flex-centred box centres the numerals' ADVANCE — their slots — but the eye
 * centres their INK, and the two differ by the first glyph's left bearing
 * against the last glyph's right bearing. Half that difference is the
 * correction, and it is zero for every numeral that neither starts nor ends in
 * a `1`, which is why `02`-`09` need nothing at all and `01` needs a full pixel.
 *
 * This assumes the caller has already cancelled the trailing letter-spacing
 * (see `.step-num-digits`) — tracking is added after the LAST digit too, which
 * would otherwise widen the box past the ink by another half pixel.
 */
export function numeralNudge(numeral: string): number {
  if (!numeral) return 0;
  const first = BEARING[numeral[0]] ?? BEARING_DEFAULT;
  const last = BEARING[numeral[numeral.length - 1]] ?? BEARING_DEFAULT;
  return Math.round(((last.right - first.left) / 2) * 100) / 100;
}
