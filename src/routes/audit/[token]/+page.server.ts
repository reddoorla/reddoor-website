import { loadReport } from "$lib/report/load";
import { reportReference } from "$lib/report/reference";
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
  // The label the "talk to us" buttons carry. The token stays on the server.
  reference: reportReference(event.params.token),
  // One static card for every report: cards are drawn at build time, so a
  // per-report card is not available (see the /og endpoint).
  meta_image: ogCardPath("site", "audit"),
});
