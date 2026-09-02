import { MAX_IMAGE_W } from "$lib/images";

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

/**
 * The `src` for one of those raw `<img>` tags, capped like every other image.
 *
 * `srcset` already right-sizes what a browser downloads, so the fallback went
 * unnoticed: it is the full-resolution master, and on a Prismic library where
 * a hero can be 5768 px wide that is megabytes nobody meant to publish. It is
 * still the attribute every reader without srcset support uses — our own audit
 * among them, which is how this surfaced. It reported 1,760 KB for an image a
 * browser never downloads at that size.
 *
 * `fit=max` makes it a ceiling rather than a resize, so an image already
 * narrower than MAX_IMAGE_W comes back untouched instead of upscaled.
 */
export function imgixSrc(url: string | null | undefined): string {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}fit=max&w=${MAX_IMAGE_W}`;
}
