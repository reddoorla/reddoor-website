/**
 * US-centric phone normalization to the +1XXXXXXXXXX shape the CRM stores (its
 * own widget runs intl-tel-input; we cover the market this funnel targets).
 * Anything that doesn't look like a ten-digit US number passes through trimmed
 * — a mangled guess is worse than the visitor's own formatting.
 *
 * Lives on its own rather than in the CRM client because it is pure string work
 * with a regression history (see the +351 case below) worth testing in isolation.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  // An explicit non-US country code (a leading + whose digits don't start with
  // the US "1") is left exactly as given — otherwise a ten-digit international
  // number like "+351 12 345 678" would get a bogus +1 stamped on the front.
  if (trimmed.startsWith("+") && !digits.startsWith("1")) return trimmed;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}
