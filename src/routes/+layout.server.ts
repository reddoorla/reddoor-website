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

  // ISR-style edge caching: these pages can't prerender (every load reads the
  // Prismic preview cookie), so they SSR per request. Cache the rendered HTML
  // on Netlify's durable CDN and revalidate in the background — repeat hits are
  // served from the edge (fast TTFB) instead of re-running the function.
  // Prismic preview sessions bypass the cache so editors always see live drafts.
  if (!isPreviewSession) {
    setHeaders({
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
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
