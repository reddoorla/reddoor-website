/**
 * Validating the visitor's IANA zone before it reaches the CRM.
 *
 * ── Why the CRM needs this at all ─────────────────────────────────────────
 *
 * GHL renders appointment times in the CONTACT's timezone, falling back to the
 * location's when the contact has none. Every contact we create has none, so
 * every confirmation email and SMS renders in `America/Boise` — Mountain —
 * however the visitor's own picker was labelled. Reported by Erik 2026-08-19:
 * he booked 10:30am Central and the confirmation read "9:30 AM MDT". The
 * instant was right and the frame was wrong, which is worse than it sounds,
 * because everything up to that point had been in his zone.
 *
 * The browser has always known the answer — `resolveTimeZone()` in `slots.ts`
 * has been using it to render the picker since day one. It was simply never
 * sent anywhere.
 *
 * ── Why it is validated rather than forwarded ─────────────────────────────
 *
 * The value arrives from a browser, so it is attacker-controlled: it lands on a
 * contact record, and from there in the body of mail we send. `Intl` is the
 * check rather than a regex, because the question is not "does this look like a
 * zone" but "does the tz database know it" — and an invalid zone throws
 * `RangeError` there, which is exactly the answer we want.
 *
 * An unrecognised value is dropped, never substituted. A wrong zone silently
 * applied is worse than the Mountain fallback: the fallback is at least
 * consistent and explicable.
 */

/** Longest real IANA identifier is well under this; the cap is for the parser. */
const MAX_LENGTH = 64;

export function isIanaZone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  // Must contain a region separator: `Intl` accepts bare offsets like "UTC" and
  // — depending on the runtime — abbreviations we do not want on a record.
  if (v.length === 0 || v.length > MAX_LENGTH || !v.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}

/** The zone if the tz database recognises it, otherwise undefined. */
export function normalizeZone(value: unknown): string | undefined {
  return isIanaZone(value) ? value.trim() : undefined;
}
