/**
 * Carrying a finished application across to the booking page.
 *
 * The template sends the lead straight from the questionnaire to the calendar,
 * so by the time /schedule loads we already know their name, email and phone —
 * asking again would be the third time in one sitting.
 *
 * sessionStorage rather than query params: these are a real person's contact
 * details, and a URL carries them into the browser history, the Referer header
 * of every subsequent request, and any analytics that records page paths.
 * sessionStorage also expires exactly when it should — with the tab.
 *
 * Every access is wrapped: sessionStorage throws outright in Safari's private
 * mode and wherever storage is disabled by policy, and a booking page that
 * white-screens because it could not read a convenience prefill would be a
 * spectacular own goal. Nothing here is load-bearing; failure degrades to an
 * empty form.
 */

const KEY = "reddoor:inquiry";

export type InquiryHandoff = {
  email: string;
  name: string;
  phone: string;
  /** True once the five questions are in — /schedule changes its copy on this. */
  applied: boolean;
};

export function writeHandoff(value: InquiryHandoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable — the booking page just asks for the details again.
  }
}

/** null when absent, unreadable, or not the shape this build writes. */
export function readHandoff(): InquiryHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { email, name, phone, applied } = parsed as Record<string, unknown>;
    // An email is the one field worth having on its own; the rest are optional
    // so an older or partial record still prefills what it can.
    if (typeof email !== "string" || !email) return null;
    return {
      email,
      name: typeof name === "string" ? name : "",
      phone: typeof phone === "string" ? phone : "",
      applied: applied === true,
    };
  } catch {
    return null;
  }
}

export function clearHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // See writeHandoff.
  }
}
