/**
 * The Vimeo id in an editor's paste. The field takes whatever Tim copies: a bare
 * id, `https://vimeo.com/123456789`, an unlisted share link
 * (`vimeo.com/123456789/abcdef1234`, whose second segment is the privacy hash
 * the player needs as `h=`), or a `player.vimeo.com/video/123456789` embed URL.
 * Anything else is null, and the card stays a poster rather than embedding a
 * player for a video that does not exist.
 */
export function parseVimeo(raw: string | null | undefined): { id: string; hash?: string } | null {
  const value = (raw ?? "").trim();
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
  const at = segments.findIndex((s) => /^\d+$/.test(s));
  if (at === -1) return null;
  const id = segments[at];
  const pathHash = segments[at + 1];
  const hash =
    url.searchParams.get("h") ?? (pathHash && /^[0-9a-f]+$/i.test(pathHash) ? pathHash : undefined);
  return hash ? { id, hash } : { id };
}
