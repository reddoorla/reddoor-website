// DEFERRED, not forgotten. The real type ships as
//   import type { ProspectAuditResult } from "@reddoorla/maintenance/audit";
// in @reddoorla/maintenance 0.87.0, and swapping it in is a two-line change.
//
// It needs a dependency bump this repo cannot take yet. For a 0.x version a
// caret allows patch bumps only, so `^0.83.0` means `>=0.83.0 <0.84.0` — going
// to 0.87.0 pulls in four minor releases at once, including changes to the
// Playwright config this repo imports from that same package (its webServer
// command, port allocation and strict-port behaviour). On the bump, CI's a11y
// job fails before a single test runs: the dev server never binds and every
// warmup route reports a refused connection. It reproduces in CI and passes
// locally, so it is about that environment, not the config being wrong.
//
// That upgrade is its own piece of work and touches how the whole fleet's
// smoke suite starts. It has no bearing on whether this page is correct, so it
// is not carried here — see the TODO issue for the bump.
//
// Declared structurally rather than copied: the real type is ~200 lines, and a
// duplicate is exactly the drift the package export exists to prevent. This
// says only what this module needs — the payload is an object — and the moment
// the bump lands, every consumer gets the real shape from one import.
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
