import { error, redirect } from "@sveltejs/kit";
import * as env from "$app/env/private";
import { fetchReport, REPORT_TOKEN_PATTERN, type AuditReport, type OverrideMap } from "./fetch";
import { applyOverrides, composed, digest, hiddenRowKeys } from "./overrides";
import { goalVerdict, toReportView } from "./model";
import { editableTargets } from "./editable";
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
  opts: { forEditor?: boolean; withHiddenChecks?: boolean } = {},
): Promise<{
  report: AuditReport;
  overrides: OverrideMap;
  approved: boolean;
  /** With `withHiddenChecks`: the `key` of every site check the operator hid
   *  (W1). A view that re-derives findings from the raw fields, as the
   *  Technical report does, needs it: the hide removes only the stored check
   *  row. Left off otherwise, so the other routes' page data is unchanged. */
  hiddenChecks?: string[];
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
  // reader there, keeping /print, /edit or /technical (W4: the Technical view of
  // a superseded token opens the newer token's Technical view, not its main
  // report). 307 so it is not cached as forever.
  if ("supersededBy" in fetched) {
    const view = url?.pathname.match(/\/(print|edit|technical)\/?$/)?.[1];
    throw redirect(307, `/audit/${fetched.supersededBy}${view ? `/${view}` : ""}`);
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
  // The composed entries a reader keeps carry a DIGEST of the sentence they
  // replaced, never the sentence (review round 2): a rewording that removed a
  // wrong claim, or one built from a row that is now hidden, would otherwise
  // still ship the old words as `original`.
  const overrides = opts.forEditor
    ? fetched.overrides
    : composedInForce(
        report,
        Object.fromEntries(
          Object.entries(fetched.overrides).flatMap(([k, ov]) =>
            k.startsWith("composed:") &&
            ov &&
            typeof ov.original === "string" &&
            typeof ov.text === "string"
              ? [[k, { original: "", text: ov.text, originalDigest: digest(ov.original) }]]
              : [],
          ),
        ),
      );

  const storedChecks = (fetched.report as { siteChecks?: { data?: unknown } }).siteChecks?.data;
  const hiddenChecks = [...hiddenRowKeys(fetched.report, fetched.overrides)].flatMap((k) => {
    const i = /^siteChecks\.data\[(\d+)\]$/.exec(k)?.[1];
    const key =
      i !== undefined && Array.isArray(storedChecks)
        ? (storedChecks[Number(i)] as { key?: unknown } | undefined)?.key
        : undefined;
    return typeof key === "string" ? [key] : [];
  });

  return {
    report,
    overrides,
    approved: fetched.approved,
    ...(opts.withHiddenChecks ? { hiddenChecks } : {}),
    // Rendered by the root layout as <meta name="referrer">. The URL is the
    // credential, so it must not travel in a Referer header when the reader
    // follows a link out of the report — the same reason /cancel, /calendar,
    // /reschedule and /meeting-outcome each set this. app.html separately keeps
    // the URL out of analytics; this keeps it out of other people's logs.
    meta_referrer: "no-referrer",
  };
}

/**
 * W1 review round 3. A reader gets only the composed rewordings that render
 * now. One written against a sentence that is no longer generated (its row was
 * hidden, or the data under it changed) is withheld from the page by
 * `composed`, but it was still shipped, so its text sat in the page data and
 * view-source. The test is the renderer's own: a key applies when, with this
 * map, the line it names displays the override's text.
 */
function composedInForce(report: AuditReport, map: OverrideMap): OverrideMap {
  const view = toReportView(report, map);
  const lines = editableTargets(view, report).map((t) => ({ key: t.key, text: t.text }));
  // GoalFit.svelte wraps the one composed line `editableTargets` does not list.
  // Only where GoalFit shows a verdict at all (review round 4).
  if (view.goalFit && view.goalFit.goal !== "unknown") {
    const judged = view.goalFit.requirements.filter((r) => r.status !== "unmeasured");
    const missing = judged.filter((r) => r.status === "missing");
    const verdictKey = "composed:goalVerdict";
    lines.push({
      key: verdictKey,
      text: composed(map, verdictKey, goalVerdict(missing.length, judged.length)),
    });
  }
  const shown = new Set(
    lines.filter((t) => map[t.key] && map[t.key]!.text === t.text).map((t) => t.key),
  );
  return Object.fromEntries(Object.entries(map).filter(([k]) => shown.has(k)));
}
