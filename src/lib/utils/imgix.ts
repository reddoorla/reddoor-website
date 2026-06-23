// Helpers for right-sizing Prismic images that are rendered as a raw <img> (so
// they can't take @prismicio/svelte's <PrismicImage> props).
//
// Prismic serves images through an imgix-backed CDN and its field `.url` already
// carries `?auto=format,compress` (so next-gen format + compression are handled).
// What the raw <img> usages were missing is a responsive `srcset` — without it the
// browser downloads the full-resolution master into a small card. These build a
// width-stepped srcset by appending `&w=<n>` to the existing imgix URL.

/** A sensible default ladder covering mobile → retina-desktop card widths. */
export const CARD_WIDTHS = [400, 640, 800, 1200, 1600];

/**
 * Build an imgix `srcset` from a Prismic image URL by appending a width param for
 * each step. Returns "" for an empty/missing URL so it can be bound directly.
 */
export function imgixSrcset(
  url: string | null | undefined,
  widths: number[] = CARD_WIDTHS,
): string {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return widths.map((w) => `${url}${sep}w=${w} ${w}w`).join(", ");
}
