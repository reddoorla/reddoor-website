import type { LinkToMediaField } from "@prismicio/client";

/** The https URL of a filled link-to-media field whose file name (or URL)
 *  ends in one of `extensions`, else null. */
function fileUrl(field: LinkToMediaField | null | undefined, extensions: RegExp): string | null {
  if (!field || field.link_type !== "Media") return null;
  const url = "url" in field ? field.url : undefined;
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null;
  if ("kind" in field && field.kind === "image") return null;
  const name = "name" in field && typeof field.name === "string" ? field.name : "";
  return extensions.test(name) || extensions.test(url) ? url : null;
}

/**
 * The URL of a link-to-media field, when it names an mp4. An empty field, a
 * field holding an image, a PDF or another container (Video labels every
 * source video/mp4), or a URL that is not https gives null, so the caller
 * plays Vimeo instead of a <video> that cannot play.
 */
export function mediaUrl(field: LinkToMediaField | null | undefined): string | null {
  return fileUrl(field, /\.(mp4|m4v)(\?|$)/i);
}

/** The URL of a link-to-media field holding a WebVTT captions file. */
export function captionsUrl(field: LinkToMediaField | null | undefined): string | null {
  return fileUrl(field, /\.vtt(\?|$)/i);
}
