import { redirectToPreviewURL } from "@prismicio/svelte/kit";
import { createClient } from "$lib/prismicio.js";
import type { RequestHandler } from "./$types";

/**
 * Documents with no page of their own, and where their preview should open.
 * `redirectToPreviewURL` prefixes "/preview", so "/funnel" lands on
 * /preview/funnel. Resolved here rather than through `routes` in prismicio.ts,
 * because `routes` naming a type the API does not know fails every query.
 */
const PREVIEW_PAGES: Record<string, string> = { funnel_copy: "/funnel" };

export const GET: RequestHandler = async ({ fetch, request, cookies }) => {
  const client = createClient({ fetch });

  return await redirectToPreviewURL({
    client: {
      resolvePreviewURL: (args) =>
        client.resolvePreviewURL({
          ...args,
          linkResolver: (doc) => PREVIEW_PAGES[doc.type] ?? null,
        }),
    },
    request,
    cookies,
  });
};
