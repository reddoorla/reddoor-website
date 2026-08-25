import { createClient } from "$lib/prismicio";
import { filter } from "@prismicio/client";
import type { LayoutServerLoad } from "./$types";

export const prerender = "auto";

export const load: LayoutServerLoad = async ({ url, fetch, cookies, setHeaders }) => {
  const { pathname } = url;

  // An active Prismic preview session is signalled by this cookie: editors who
  // arrive via a Prismic preview link have it set, normal visitors never do. It
  // drives two things — skipping durable CDN caching so drafts stay live, and
  // only mounting the Prismic toolbar for previewers (the toolbar sets ~21
  // third-party cookies that otherwise hit every visitor and fail Lighthouse).
  const isPreviewSession = !!cookies.get("io.prismic.preview");

  // Prospect audit reports are confidential and must never reach the durable
  // CDN. They are not a leak between prospects — the edge keys on URL and every
  // report has its own unguessable token — but `public, durable` puts a copy of
  // a document naming one business and listing its weaknesses into shared,
  // persistent storage for up to a day past its TTL, and a revoked or
  // regenerated report would keep serving from it.
  //
  // The route sets `cache-control: private, no-store`; without this the two
  // headers contradict each other and the CDN directive is the one that wins.
  // Excluded here rather than overridden in the route, because setHeaders
  // refuses to set the same header twice in one request — and because the
  // caching policy belongs where the rest of it is.
  const isPrivateReport = pathname.startsWith("/audit/");

  // ISR-style edge caching: these pages can't prerender (every load reads the
  // Prismic preview cookie), so they SSR per request. Cache the rendered HTML
  // on Netlify's durable CDN and revalidate in the background — repeat hits are
  // served from the edge (fast TTFB) instead of re-running the function.
  // Prismic preview sessions bypass the cache so editors always see live drafts.
  if (!isPreviewSession && !isPrivateReport) {
    setHeaders({
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
      // Key the durable cache on the preview cookie. Without this the edge keys on
      // URL alone, so an editor with an active preview session could be served a
      // normal visitor's cached PUBLISHED HTML instead of their live draft. With
      // it, preview and non-preview requests resolve to separate cache entries.
      "Netlify-Vary": "cookie=io.prismic.preview",
    });
  }

  const client = createClient({ fetch, cookies });
  const latestFourProjects = await client.getByType("project", {
    orderings: {
      field: "document.first_publication_date",
      direction: "desc",
    },

    filters: [filter.not("document.tags", ["hide"])],
    pageSize: 4,
  });

  return {
    pathname,
    latestFourProjects,
    isPreviewSession,
  };
};
