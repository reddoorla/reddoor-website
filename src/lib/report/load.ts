import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { fetchReport, REPORT_TOKEN_PATTERN, type AuditReport } from "./fetch";

/** The subset of a SvelteKit load event this needs. Declared structurally so
 *  both routes can pass their own event without a type dance. */
type LoadLike = {
  params: { token: string };
  fetch: typeof globalThis.fetch;
  setHeaders: (headers: Record<string, string>) => void;
};

/**
 * Load one report, with the guards both the page and the print route need.
 *
 * Shared rather than copied because the guards are the part that must not
 * drift. The two routes serve the same confidential document to the same
 * audience in different formats, so a difference in what either accepts, or in
 * what it tells crawlers, is a security difference and not a stylistic one.
 */
export async function loadReport({
  params,
  fetch,
  setHeaders,
}: LoadLike): Promise<{ report: AuditReport; meta_referrer: string }> {
  // Reject before fetching. fetchReport validates too, but these routes build a
  // URL from a public path segment and should not rely on a callee to catch it.
  if (!REPORT_TOKEN_PATTERN.test(params.token)) throw error(404, "Not found");

  // One of three independent guards against a prospect's report reaching a
  // search index — with robots.txt and each page's own meta tag. This one
  // travels with the response, so it survives an edit to either of the others.
  setHeaders({
    "x-robots-tag": "noindex, nofollow, noarchive",
    // The document names one business and enumerates its weaknesses. Nothing on
    // any path should retain a copy. The root layout separately excludes
    // /audit/ from durable CDN caching, which would otherwise contradict this.
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

  return {
    report,
    // Rendered by the root layout as <meta name="referrer">. The URL is the
    // credential, so it must not travel in a Referer header when the reader
    // follows a link out of the report — the same reason /cancel, /calendar,
    // /reschedule and /meeting-outcome each set this. app.html separately keeps
    // the URL out of analytics; this keeps it out of other people's logs.
    meta_referrer: "no-referrer",
  };
}
