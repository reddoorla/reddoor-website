/**
 * The contract between a page's `meta_image` and the /og endpoint. Nothing
 * free-text goes in the URL: a kind names where the headline comes from and an
 * id names which one, so the endpoint cannot be used to put arbitrary words on
 * a Reddoor-branded card.
 */
export const OG_KINDS = ["site", "page", "industry", "showcase", "project"] as const;
export type OgKind = (typeof OG_KINDS)[number];

/** Prismic uids and the registry slugs. */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function isOgKind(kind: string): kind is OgKind {
  return (OG_KINDS as readonly string[]).includes(kind);
}

export function isOgId(id: string): boolean {
  return ID.test(id);
}

/** Root-relative; the root layout resolves it against the canonical origin. */
export function ogCardPath(kind: OgKind, id: string): string {
  if (!isOgId(id)) throw new Error(`og card id not allowed: ${JSON.stringify(id)}`);
  return `/og/${kind}/${id}.png`;
}
