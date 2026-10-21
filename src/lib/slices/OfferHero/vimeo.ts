/**
 * The Vimeo id in an editor's paste. The field takes whatever Tim copies: a bare
 * id, `https://vimeo.com/123456789`, an unlisted share link
 * (`vimeo.com/123456789/abcdef1234`, whose second segment is the privacy hash
 * the player needs as `h=`), a `player.vimeo.com/video/123456789` embed URL, a
 * showcase link to a video, or the whole `<iframe>` snippet from Vimeo's Embed button.
 * Anything else is null, and the card stays a poster rather than embedding a
 * player for a video that does not exist.
 */
export function parseVimeo(raw: string | null | undefined): { id: string; hash?: string } | null {
  let value = (raw ?? "").trim();
  // Vimeo's "Embed" button copies an <iframe> snippet; its src is the link.
  const embedSrc = /<iframe[^>]*\ssrc=["']([^"']+)["']/i.exec(value);
  if (embedSrc) value = embedSrc[1].replace(/&amp;/g, "&");
  if (!value) return null;
  if (/^\d+$/.test(value)) return { id: value };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!/(^|\.)vimeo\.com$/i.test(url.hostname)) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  // The id follows `video` when the path names one (player URLs, and showcase
  // or channel links such as /showcase/1234567/video/987654321, whose first
  // number is the showcase); otherwise it is the first all-digit segment.
  const afterVideo = segments.indexOf("video") + 1;
  // A showcase or album link with no video in it names a collection, not a
  // video.
  if (afterVideo === 0 && ["showcase", "album"].includes(segments[0]?.toLowerCase() ?? ""))
    return null;
  const at =
    afterVideo > 0 && /^\d+$/.test(segments[afterVideo] ?? "")
      ? afterVideo
      : segments.findIndex((s) => /^\d+$/.test(s));
  if (at === -1) return null;
  const id = segments[at];
  const pathHash = segments[at + 1];
  const hash =
    url.searchParams.get("h") ?? (pathHash && /^[0-9a-f]+$/i.test(pathHash) ? pathHash : undefined);
  return hash ? { id, hash } : { id };
}
