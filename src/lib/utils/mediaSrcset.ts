/**
 * Prismic media-library URLs are imgix-backed, so we can reproduce
 * PrismicImage's responsive behavior (modern formats + width-appropriate
 * assets) for a raw media-link URL that has no Image field to hand to
 * <PrismicImage>. Used by MediaImg for ContentWidthMedia slideshow slides.
 */
const DEFAULT_WIDTHS = [400, 640, 800, 1200, 1600];

export function mediaImgAttrs(
  url: string,
  opts: { widths?: number[]; sizes?: string } = {},
): { src: string; srcset: string; sizes: string } {
  const sizes = opts.sizes ?? "100vw";
  if (!url) return { src: "", srcset: "", sizes };

  const widths = opts.widths ?? DEFAULT_WIDTHS;
  const at = (w: number) => {
    const u = new URL(url);
    u.searchParams.set("auto", "format,compress");
    u.searchParams.set("fit", "max");
    u.searchParams.set("width", String(w));
    return u.toString();
  };

  return {
    src: at(widths[widths.length - 1]),
    srcset: widths.map((w) => `${at(w)} ${w}w`).join(", "),
    sizes,
  };
}
