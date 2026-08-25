// TODO: replace this local declaration with
//   import type { ProspectAuditResult } from "@reddoorla/maintenance/audit";
// once reddoorla/reddoor-maintenance#605 is released and this repo's dependency
// is bumped past it. The `./audit` subpath exports the real type; it is not
// published yet, and the caret on ^0.83.0 will not pick up a new export map
// from an unpublished version.
//
// Declared structurally rather than copied: the full result type is ~200 lines,
// and a duplicate of it is exactly the drift the package export exists to
// prevent. This says only what this module needs — that the payload is an
// object — and every consumer gets the real type the moment the import lands.
// See docs/superpowers/plans/2026-08-25-prospect-report-route.md.
export type AuditReport = Record<string, unknown>;

/** Base64url, the shape `generateToken()` produces in the maintenance repo.
 *  Anchored at both ends: an unanchored pattern would let a valid-looking
 *  prefix smuggle a path segment into the outbound URL. */
export const REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export type FetchReportOptions = {
  /** Origin of the maintenance app. Empty is a configuration error, not a
   *  fallback — see the throw below. */
  baseUrl: string;
  fetch: typeof globalThis.fetch;
};

/**
 * Read one audit report from the maintenance API.
 *
 * Returns `null` ONLY for a genuine 404. Every other failure throws, because
 * the two mean opposite things to the person holding the link: "this report
 * does not exist" is final and correct, while "our ops app is down" is
 * temporary and must not be dressed up as the former. A prospect told their
 * report was deleted does not come back and check later.
 */
export async function fetchReport(
  token: string,
  opts: FetchReportOptions,
): Promise<AuditReport | null> {
  // Validated here as well as at the route, because this function builds a URL
  // from the value and must not depend on a caller having checked first.
  if (!REPORT_TOKEN_PATTERN.test(token)) {
    throw new Error("fetchReport: malformed report token");
  }

  // An empty base URL would resolve as a relative path against the marketing
  // site, 404 there, and surface to the visitor as "report not found" — a
  // misconfiguration wearing the costume of a legitimate answer. Name the
  // variable so the fix is obvious from the log line alone.
  if (!opts.baseUrl) {
    throw new Error("fetchReport: PROSPECT_REPORT_URL is not configured");
  }

  const res = await opts.fetch(`${opts.baseUrl.replace(/\/$/, "")}/api/audit-report/${token}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchReport: upstream responded ${res.status}`);

  return (await res.json()) as AuditReport;
}
