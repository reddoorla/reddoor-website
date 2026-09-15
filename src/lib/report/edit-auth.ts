import { createHash, timingSafeEqual } from "node:crypto";

/** The operator's edit session. Scoped to /audit in the `set` call, so it is
 *  never sent with a request to any other part of the site. */
export const EDIT_COOKIE = "reddoor_report_edit";

/** Short by design. This grants the ability to rewrite what a prospect reads,
 *  and an operator who wants it back only has to follow the link again. */
export const EDIT_COOKIE_MAX_AGE = 60 * 60 * 8;

/**
 * Constant-time compare of a presented key against the configured one, with
 * respect to BOTH content and length.
 *
 * The SHA-256 is there to EQUALISE LENGTH, and for nothing else. It is not
 * protecting the key at rest — both operands are already secrets held in
 * memory — and a plain digest is not a MAC. What it solves is that
 * `timingSafeEqual` throws a RangeError on buffers of different lengths, so a
 * raw-buffer compare has to guard with `a.length === b.length &&` first. That
 * guard short-circuits, which leaks the configured key's LENGTH to anyone who
 * can time it — the one thing a constant-time compare exists to hide. Digesting
 * first makes both operands 32 bytes always: the guard is unnecessary,
 * `timingSafeEqual` can never throw, and no length is observable.
 *
 * This deliberately DIVERGES from the helper in /api/meeting-outcome, which
 * guards this site's other internal page and still short-circuits on length.
 * That is a live route and the fix there deserves its own change and review, so
 * it is not made here in passing. The pattern used instead is the one
 * reddoor-maintenance already runs on both of its shared-token routes
 * (`verifyFormsToken` in src/forms/token.ts, and the overrides function this
 * route will eventually POST to).
 */
export function keyMatches(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * The configured edit key, trimmed — or null when there is effectively none.
 *
 * Shared because two callers need the SAME answer and a difference between them
 * is not a style difference. The edit route decides whether to render; the save
 * proxy decides whether to forward. If one trimmed and the other did not, a
 * single newline pasted into an environment UI would produce the worst possible
 * state: an editor that opens and accepts typing, and saves that all 404 with
 * no log line, so the operator watches their work silently fail to persist.
 *
 * Whitespace-only is null rather than a key nothing can present, so callers
 * fail closed loudly instead of refusing everything forever for a reason
 * nothing reports.
 */
export function configuredEditKey(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** True when the configured value carried stray whitespace that was trimmed
 *  away — the misconfiguration worth warning about, once a caller has already
 *  authenticated. See the placement note at each call site. */
export function editKeyNeededTrimming(raw: string | undefined): boolean {
  return raw !== undefined && raw !== raw.trim();
}
