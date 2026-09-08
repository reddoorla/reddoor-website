import { loadReport } from "$lib/report/load";
import { ogCardPath } from "$lib/og/url";
import type { PageServerLoad } from "./$types";

// The root layout prerenders by default. This page is one prospect's private
// report behind an unguessable token — there is nothing to prerender, and a
// build-time crawl of it would be a bug.
export const prerender = false;

// Guards live in loadReport, shared with the print route: token validation,
// noindex, no-store, and the deliberate 404-vs-500 split.
export const load: PageServerLoad = async (event) => ({
  ...(await loadReport(event)),
  // The share card names the business, nothing more; it is fetched by an
  // unfurler holding the same link, so it carries the same token.
  meta_image: ogCardPath("audit", event.params.token),
});
