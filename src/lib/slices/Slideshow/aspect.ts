import type { ImageField } from "@prismicio/client";

/**
 * The aspect ratio a slideshow's box should take, derived from the slides
 * themselves.
 *
 * The box used to be a hardcoded `aspect-video`, which is a guess that happens
 * to be wrong for every slideshow on this site: the published sets run 1.29 to
 * 1.62, never 1.78. Every slide was therefore pillarboxed inside a box wider
 * than any of its content — /portfolio/champion spent 27% of its width on empty
 * side bars — and because `object-contain` centres what it cannot fill, slides
 * of differing ratios also painted at different sizes and stepped as the
 * carousel advanced.
 *
 * Sizing the box to the content fixes the dead space outright and removes the
 * step between every slide that shares the majority ratio. It deliberately does
 * NOT hide a genuine outlier: that slide still letterboxes, and
 * scripts/audit/slideshow-aspect.mjs still reports it, because the only way to
 * make a mismatched slide fill this box is to crop it — a call for whoever owns
 * the artwork, not for a layout default.
 *
 * @param images - Slide rows, as authored (`{ image }` per row).
 * @param tolerance - Fractional ratio difference still treated as "the same
 *   shape". 1% is the same threshold the audit uses; below that it is rounding
 *   in the export rather than a design difference.
 * @returns The ratio (width / height), or null when nothing is filled — in
 *   which case the caller should keep its own default.
 */
export function slideshowAspect(
  images: readonly { image?: ImageField | null }[] | null | undefined,
  tolerance = 0.01,
): number | null {
  const ratios = (images ?? [])
    .map((row) => row?.image?.dimensions)
    .filter((d): d is { width: number; height: number } => !!d && d.width > 0 && d.height > 0)
    .map((d) => d.width / d.height);

  if (!ratios.length) return null;

  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  // Compare fractionally, not by rounding to N decimals: 1.5013 and 1.5000 are
  // the same shape to the eye (0.09% apart) but land either side of any fixed
  // rounding boundary.
  const sameShape = (a: number, b: number) => Math.abs(a - b) / Math.min(a, b) <= tolerance;

  const overallMedian = median(ratios);

  // Largest cluster wins — that is the ratio the set was cut to, and the odd
  // slide out is the mistake. Ties break toward whichever cluster sits closest
  // to the overall median, so a set with no majority at all (three slides, three
  // shapes) still lands on its middle shape rather than an extreme.
  let best: { count: number; ratio: number } | null = null;
  for (const candidate of ratios) {
    const members = ratios.filter((other) => sameShape(other, candidate));
    const ratio = median(members);
    if (
      !best ||
      members.length > best.count ||
      (members.length === best.count &&
        Math.abs(ratio - overallMedian) < Math.abs(best.ratio - overallMedian))
    ) {
      best = { count: members.length, ratio };
    }
  }

  // Four decimals is finer than a pixel on any realistic box and keeps the
  // inline style readable.
  return Math.round((best?.ratio ?? ratios[0]) * 10_000) / 10_000;
}
