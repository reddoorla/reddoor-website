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
  /** Marks this fetch as an operator preview, so maintenance does not record it
   *  as the report having been opened by its recipient. */
  editSession?: boolean;
};

/** One replaced string, with the generated text it replaced. `original` is kept
 *  so the cockpit can show what changed, and so an override can be withheld if
 *  it no longer matches what it claims to replace. */
export type Override = { original: string; text: string };
export type OverrideMap = Record<string, Override>;

/** What one report fetch yields. `overrides` is always an object, never null,
 *  so no caller has to branch on absence. */
export type FetchedReport = { report: AuditReport; overrides: OverrideMap };

/**
 * The maintenance API served a bare report before overrides existed and serves
 * `{ report, overrides, editedAt, openedAt }` after. Both are accepted, on
 * purpose: the two repos deploy independently, and a website that only
 * understood the new shape would 500 every report until maintenance caught up.
 *
 * The discriminator is a `report` key, which a bare `ProspectAuditResult` never
 * has — its top level is url/businessName/scores/crawl/checks and the rest.
 *
 * `editedAt` and `openedAt` are dropped: they are cockpit bookkeeping about the
 * operator's own editing session, and nothing on the prospect's page is a
 * function of them. Carrying them would put them in the hydration payload of a
 * document the prospect can read.
 */
export function unwrap(body: unknown): FetchedReport {
  if (body && typeof body === "object" && "report" in body) {
    const { report, overrides } = body as { report: unknown; overrides?: unknown };
    return {
      report: report as AuditReport,
      // `typeof [] === "object"`, so proving object-ness alone would let an
      // array through as an OverrideMap.
      overrides:
        overrides && typeof overrides === "object" && !Array.isArray(overrides)
          ? (overrides as OverrideMap)
          : {},
    };
  }
  return { report: body as AuditReport, overrides: {} };
}

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
): Promise<FetchedReport | null> {
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

  // `x-reddoor-edit-session` is a CROSS-REPO CONTRACT, and it degrades silently.
  // reddoor-maintenance's `audit-report-json.mts` reads this exact header name
  // and this exact value to decide whether to skip its `opened_at` stamp. There
  // is no shared constant and there cannot be one yet: this repo cannot take a
  // `@reddoorla/maintenance` bump past ^0.83.0 (see the note at the top of this
  // file). If the two ever drift, nothing breaks loudly — the skip just stops
  // working, and `opened_at` starts recording the operator's own previews as the
  // prospect having read the report, which is the one thing that timestamp
  // exists to tell you.
  const res = await opts.fetch(`${opts.baseUrl.replace(/\/$/, "")}/api/audit-report/${token}`, {
    headers: opts.editSession ? { "x-reddoor-edit-session": "1" } : {},
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchReport: upstream responded ${res.status}`);

  const fetched = unwrap(await res.json());

  // A 200 carrying no report is the upstream contradicting itself: it has a 404
  // to say "gone" with, so this is a fault on our side of the wire and not an
  // answer about this prospect — 500, the same as any other outage. Named here
  // because the next thing to touch it is toReportView, and a TypeError on
  // `.analyze` thrown out of a renderer tells an operator nothing about where it
  // came from. Reachable two ways: a bare body that is literally `null` (the
  // pre-overrides shape saying nothing), and `{ report: null }` (the wrapped
  // shape doing the same).
  if (!fetched.report || typeof fetched.report !== "object") {
    throw new Error("fetchReport: upstream responded 200 with no report");
  }

  return fetched;
}
