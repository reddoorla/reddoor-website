/**
 * The widest image we ever ask Prismic for.
 *
 * Our own audit caught this on our own site: the hero on a portfolio page is a
 * 5768 × 4320 source, and every call site asked for it with `auto=format,
 * compress` and no size at all — so imgix compressed the format and served the
 * full 5.7K frame. A browser that accepts AVIF downloaded 543 KB of it; one
 * that does not took 1,760 KB. Nothing on the site is displayed anywhere near
 * that size.
 *
 * Measured on that image, AVIF, at the moment of the change:
 *
 *   uncapped   543 KB
 *   w=3200     204 KB
 *   w=2560     136 KB
 *   w=1920      88 KB
 *
 * 2560 rather than 1920 because these are full-bleed images and 1920 is only
 * one device pixel per CSS pixel on a 1920 viewport — soft on any large retina
 * screen, which is most of the machines our work is looked at on. 2560 still
 * cuts the heaviest asset fourfold and leaves headroom to spare.
 *
 * `fit: "max"` is what makes this safe to apply everywhere, including to logos
 * and avatars: it is a ceiling, never a resize. An image already narrower than
 * this is returned untouched rather than upscaled.
 */
export const MAX_IMAGE_W = 2560;
