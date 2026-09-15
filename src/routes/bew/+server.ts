import { bewTarget } from "$lib/bew";
import type { RequestHandler } from "./$types";

// A static route beats the `[uid]` catch-all in SvelteKit's routing, so `/bew`
// can never be shadowed by a Prismic document. Not prerendered: the target
// varies with the incoming utm_* query, and a redirect is not a page.
export const prerender = false;

export const GET: RequestHandler = ({ url }) =>
  new Response(null, {
    status: 302,
    headers: {
      location: bewTarget(url.searchParams),
      "cache-control": "no-store",
    },
  });
