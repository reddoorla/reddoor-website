import type { LinkToMediaField } from "@prismicio/client";

/**
 * The URL of a link-to-media field, when it names a video file. An empty
 * field, a field holding an image or a PDF, or a URL that is not https gives
 * null, so the caller plays Vimeo instead of a <video> that cannot play.
 */
export function mediaUrl(field: LinkToMediaField | null | undefined): string | null {
  if (!field || field.link_type !== "Media") return null;
  const url = "url" in field ? field.url : undefined;
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null;
  const kind = "kind" in field ? field.kind : undefined;
  const name = "name" in field && typeof field.name === "string" ? field.name : url;
  const isVideo =
    /\.(mp4|m4v|webm|mov)(\?|$)/i.test(name) || /\.(mp4|m4v|webm|mov)(\?|$)/i.test(url);
  if (kind === "image" || !isVideo) return null;
  return url;
}
