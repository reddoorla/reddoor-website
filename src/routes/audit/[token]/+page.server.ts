import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchReport, REPORT_TOKEN_PATTERN } from "$lib/report/fetch";
import type { PageServerLoad } from "./$types";

// The root layout prerenders by default. This page is one prospect's private
// report behind an unguessable token — there is nothing to prerender, and a
// build-time crawl of it would be a bug.
export const prerender = false;

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
  // Reject before fetching. fetchReport validates too, but this route builds a
  // URL from a public path segment and should not rely on a callee to catch it.
  if (!REPORT_TOKEN_PATTERN.test(params.token)) throw error(404, "Not found");

  // One of three independent guards against a prospect's report reaching a
  // search index — with robots.txt and the page's own meta tag. This one
  // travels with the response, so it survives an edit to either of the others.
  // Letting the sales pipeline get indexed is the one mistake here that cannot
  // be walked back.
  setHeaders({
    "x-robots-tag": "noindex, nofollow, noarchive",
    // The document names one business and enumerates its weaknesses. Nothing on
    // any path should retain a copy.
    "cache-control": "private, no-store",
  });

  const report = await fetchReport(params.token, {
    baseUrl: env.PROSPECT_REPORT_URL ?? "",
    fetch,
  });

  // Only a genuine 404 lands here as null. An upstream outage throws out of
  // fetchReport and becomes a 500, deliberately: "your report is gone" and "we
  // are broken" must not look the same to the person holding the link.
  if (!report) throw error(404, "Not found");

  return { report };
};
