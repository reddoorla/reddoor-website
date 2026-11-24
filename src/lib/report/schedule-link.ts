/**
 * The link behind a report's "talk to us" buttons. It books a call and tags it
 * with where it came from: utm_content carries the report's reference, so the
 * CRM note names the report without naming its token.
 */
export function scheduleHref(reference: string | null): string {
  const params = new URLSearchParams({ utm_source: "audit", utm_medium: "report" });
  if (reference) params.set("utm_content", reference);
  return `/schedule?${params}`;
}
