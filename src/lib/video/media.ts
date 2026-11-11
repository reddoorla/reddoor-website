import type { Renditions } from "@reddoorla/maintenance/video-pipeline";
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

/** What a video slot plays: the mp4s, the poster and the captions, from R2 when the video was encoded there. */
export type ResolvedVideo = {
  mp4: string | null;
  mobileMp4: string | null;
  poster: string | null;
  captions: string | null;
};

/** The https url of a filled link-to-media field, else null. */
function linkUrl(field: LinkToMediaField | null | undefined): string | null {
  if (!field || field.link_type !== "Media" || !("url" in field)) return null;
  return typeof field.url === "string" ? field.url : null;
}

/**
 * The renditions to play for a video field. A field whose url the build found
 * on R2 plays R2's files, with the R2 poster; an editor's own captions file
 * still wins over R2's. Anything else is what the slice played before R2: the
 * Prismic files, with no poster.
 */
export function videoFor(
  field: LinkToMediaField | null | undefined,
  mobileField: LinkToMediaField | null | undefined,
  captionsField: LinkToMediaField | null | undefined,
  videos: Record<string, Renditions> | undefined,
): ResolvedVideo {
  const url = linkUrl(field);
  const rendition = url !== null ? videos?.[url] : undefined;
  if (!rendition) {
    return {
      mp4: mediaUrl(field),
      mobileMp4: mediaUrl(mobileField),
      poster: null,
      captions: captionsUrl(captionsField),
    };
  }
  return {
    mp4: rendition.mp4,
    mobileMp4: rendition.mobileMp4 ?? mediaUrl(mobileField),
    poster: rendition.poster,
    captions: captionsUrl(captionsField) ?? rendition.captions,
  };
}
