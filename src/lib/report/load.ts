import { error, redirect } from "@sveltejs/kit";
import * as env from "$app/env/private";
import { fetchReport, REPORT_TOKEN_PATTERN, type AuditReport, type OverrideMap } from "./fetch";
import { applyOverrides } from "./overrides";
import { EDIT_COOKIE, configuredEditKey, keyMatches } from "./edit-auth";

/** The subset of a SvelteKit load event this needs. Declared structurally so
 *  both routes can pass their own event without a type dance. */
type LoadLike = {
  params: { token: string };
  /** Present on a real SvelteKit event; used to keep /print and /edit on the
   *  same suffix when a superseded link is followed. Optional for tests. */
  url?: URL;
  fetch: typeof globalThis.fetch;
  setHeaders: (headers: Record<string, string>) => void;
  /** Present on a real SvelteKit event. Optional so a caller in a test can omit
   *  it and get the ordinary-reader path. */
  cookies?: { get: (name: string) => string | undefined };
};

/**
 * Load one report, with the guards both the page and the print route need.
 *
 * Shared rather than copied because the guards are the part that must not
 * drift. The two routes serve the same confidential document to the same
 * audience in different formats, so a difference in what either accepts, or in
 * what it tells crawlers, is a security difference and not a stylistic one.
 */
export async function loadReport(
  { params, url, fetch, setHeaders, cookies }: LoadLike,
  opts: { forEditor?: boolean } = {},
): Promise<{
  report: AuditReport;
  overrides: OverrideMap;
  approved: boolean;
  meta_referrer: string;
}> {
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

  // An operator previewing their own edits is not the prospect reading the
  // report. Saying so here is what keeps `opened_at` meaning "the person we sent
  // this to has seen it" rather than "somebody loaded the page".
  //
  // Presence of the cookie is enough: it is not a second authorisation check.
  // The edit ROUTE verifies the key before rendering anything, and the worst a
  // forged cookie buys on the read path is suppressing one's own read receipt —
  // which anyone holding the link could do by simply not opening it.
  const cookie = cookies?.get(EDIT_COOKIE);
  const editing = Boolean(cookie);

  // W1. A DRAFT is served by maintenance only to a request carrying
  // PROSPECT_EDIT_TOKEN, and that token goes out only when the cookie is not
  // merely present but VERIFIED against REPORT_EDIT_KEY: presence is enough to
  // skip a read receipt (above), never enough to read a report nobody has
  // approved. A forged cookie gets exactly what the public gets.
  const expected = cookie ? configuredEditKey(env.REPORT_EDIT_KEY) : null;
  const verified = Boolean(cookie && expected && keyMatches(cookie, expected));
  // Fails closed, but say why: otherwise a verified editor meets a bare 404 on
  // every draft with nothing in the log.
  if (verified && !env.PROSPECT_EDIT_TOKEN) {
    console.error("[audit] PROSPECT_EDIT_TOKEN not set: the editor cannot open a draft");
  }

  const fetched = await fetchReport(params.token, {
    baseUrl: env.PROSPECT_REPORT_URL ?? "",
    fetch,
    editSession: editing,
    ...(verified && env.PROSPECT_EDIT_TOKEN ? { editToken: env.PROSPECT_EDIT_TOKEN } : {}),
  });

  // Only a genuine 404 lands here as null. An upstream outage throws out of
  // fetchReport and becomes a 500, deliberately: "your report is gone" and "we
  // are broken" must not look the same to the person holding the link.
  if (!fetched) throw error(404, "Not found");

  // W1. The link was replaced by a newer report for the same site: send the
  // reader there, keeping /print or /edit. 307 so it is not cached as forever.
  if ("supersededBy" in fetched) {
    const suffix = url?.pathname.match(/\/(print|edit)\/?$/)?.[0] ?? "";
    throw redirect(307, `/audit/${fetched.supersededBy}${suffix}`);
  }

  // W1 review round 1. SvelteKit serialises `load` data into the page for
  // hydration, so a row an operator hid was still readable in view-source on
  // the reader's page, and an override's `original` repeated what it replaced.
  // Every route but the editor therefore gets the payload with its overrides
  // (hides included) already applied, and only the `composed:` entries, which
  // name sentences this repo writes and must be matched at render time. The
  // editor needs the stored payload and the whole map to show and revert.
  const report = opts.forEditor
    ? fetched.report
    : applyOverrides(fetched.report, fetched.overrides);
  const overrides = opts.forEditor
    ? fetched.overrides
    : Object.fromEntries(
        Object.entries(fetched.overrides).filter(([k]) => k.startsWith("composed:")),
      );

  return {
    report,
    overrides,
    approved: fetched.approved,
    // Rendered by the root layout as <meta name="referrer">. The URL is the
    // credential, so it must not travel in a Referer header when the reader
    // follows a link out of the report — the same reason /cancel, /calendar,
    // /reschedule and /meeting-outcome each set this. app.html separately keeps
    // the URL out of analytics; this keeps it out of other people's logs.
    meta_referrer: "no-referrer",
  };
}
