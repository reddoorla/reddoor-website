/**
 * Documents with no page of their own, and where their Prismic preview opens.
 * `redirectToPreviewURL` prefixes "/preview", so "/funnel" lands on
 * /preview/funnel. Resolved in /api/preview rather than through `routes` in
 * prismicio.ts, because `routes` naming a type the API does not know fails
 * every query. Null hands every other type back to its route-resolved URL.
 */
const PREVIEW_PAGES: Record<string, string> = { funnel_copy: "/funnel" };

export function previewPage(doc: { type: string }): string | null {
  return PREVIEW_PAGES[doc.type] ?? null;
}
