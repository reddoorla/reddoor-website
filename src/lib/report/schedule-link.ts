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

/**
 * The note a booking made through that link leaves on the CRM contact, or null
 * when the booking did not come from a report. `/api/book` writes only the
 * contact's fields and an appointment, so without this the reference reached
 * the team's email (through forms ingest) and never the record Tim opens.
 * Only an 8-hex reference is echoed; anything else in the query is not ours.
 */
export function auditBookingNote(sourceUrl: string): string | null {
  let params: URLSearchParams;
  try {
    params = new URL(sourceUrl).searchParams;
  } catch {
    return null;
  }
  if (params.get("utm_source") !== "audit") return null;
  const ref = params.get("utm_content") ?? "";
  return /^[0-9a-f]{8}$/.test(ref)
    ? `Booked from an audit report, reference ${ref}.`
    : "Booked from an audit report.";
}
