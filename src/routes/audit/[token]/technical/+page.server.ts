import { createHash } from "node:crypto";
import { loadReport } from "$lib/report/load";
import { toTechnicalView } from "$lib/report/technical/model";
import { ogCardPath } from "$lib/og/url";
import type { PageServerLoad } from "./$types";

// A private report behind an unguessable token, like its parent route.
export const prerender = false;

/**
 * The Technical report: a second view of the same token (W4).
 *
 * The guards are loadReport's, shared with the main and print routes: token
 * validation, noindex, no-store, the 404-vs-500 split, and the edit cookie's
 * read-receipt rule. Whatever gate decides whether a report may be shown at
 * all applies here through the same call.
 *
 * Built on the SERVER and sent as the view alone. The parent route ships the
 * whole stored row to the browser (TEC-08); this one has no reason to, and
 * the stages a model wrote never leave the server on this page.
 *
 * `reference` is a short label for the scheduler link, derived one way from
 * the token. The token itself is the credential and never goes in a URL that
 * leaves the report.
 */
export const load: PageServerLoad = async (event) => {
  const { report, hiddenChecks, meta_referrer } = await loadReport(event, {
    withHiddenChecks: true,
  });
  return {
    // A check the operator hid on the report is hidden here too (W1).
    view: toTechnicalView(report, new Date(), new Set(hiddenChecks ?? [])),
    reference: createHash("sha256").update(event.params.token).digest("hex").slice(0, 8),
    meta_referrer,
    meta_image: ogCardPath("site", "audit"),
  };
};
