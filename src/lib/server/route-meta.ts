import type { Client } from "@prismicio/client";
import type { AllDocumentTypes } from "../../prismicio-types";

/**
 * Editable meta for the pages that have no Prismic document of their own.
 *
 * /about, /contact, /portfolio and /showcase are code-routed; their titles,
 * descriptions and share cards used to live only in the loaders. A `route_meta`
 * document keyed on the route slug gives Tim a place to override them
 * (Discord #rd-website, 2026-09-08). Every read is optional: a missing
 * document, an empty field, or a repository where the type has not been
 * pushed yet all read as "no override", so the build never depends on content.
 */
export const ROUTE_META_SLUGS = ["about", "contact", "portfolio", "showcase"] as const;
export type RouteMetaSlug = (typeof ROUTE_META_SLUGS)[number];

export type RouteMeta = {
  meta_title?: string;
  meta_description?: string;
  /** Absolute Prismic image URL. */
  meta_image?: string;
  /** Headline for the generated share card, when no meta_image is set. */
  card_headline?: string;
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export async function loadRouteMeta(
  client: Pick<Client<AllDocumentTypes>, "getByUID">,
  slug: string,
): Promise<RouteMeta | null> {
  if (!(ROUTE_META_SLUGS as readonly string[]).includes(slug)) return null;
  try {
    const doc = await client.getByUID("route_meta", slug);
    const d = doc.data;
    return {
      meta_title: text(d.meta_title),
      meta_description: text(d.meta_description),
      meta_image: text(d.meta_image?.url),
      card_headline: text(d.card_headline),
    };
  } catch {
    // NotFound for a missing uid, or a 400 while the type is not yet pushed.
    return null;
  }
}
