/**
 * The `/bew` short link: what Boise Entrepreneur Week collateral points at.
 *
 * The page is `/boise` — a durable city page — and this only decorates the hop
 * with the event's attribution, so the CRM can tell a BEW lead from a Boise
 * lead who arrived by search. The modal posts `location.href` as `sourceUrl`
 * and the server-side sync reads utm_* out of it (src/lib/ghl/client.ts), so
 * nothing here needs to know about the CRM.
 *
 * The destination path is fixed. Only utm_* parameters pass through, so the
 * route cannot be turned into an open redirect or used to carry a lead's
 * details somewhere they were not meant to go.
 */
export const BEW_LANDING = "/boise";

export const BEW_UTM = {
  utm_source: "bew",
  utm_medium: "event",
  utm_campaign: "bew-2026",
} as const;

/** The key shape this campaign's collateral uses: lowercase, letters only after the prefix. GA also allows multi-word keys (utm_source_platform); nothing here sends them. */
const UTM_KEY = /^utm_[a-z]+$/;
const MAX_VALUE = 100;

export function bewTarget(incoming: URLSearchParams): string {
  const params = new URLSearchParams(BEW_UTM);
  for (const [key, raw] of incoming) {
    const value = raw.trim();
    if (UTM_KEY.test(key) && value) params.set(key, value.slice(0, MAX_VALUE));
  }
  return `${BEW_LANDING}?${params.toString()}`;
}
