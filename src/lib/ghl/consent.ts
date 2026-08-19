import { crmCall, type CrmFetch, type CrmResult } from "./client";
import { GHL_LOCATION_ID } from "./constants";

/**
 * Email marketing consent, so the unsubscribe and resubscribe confirmation
 * pages can live on reddoorla.com instead of go.reddoorla.com.
 *
 * ── Only ever opt IN ──────────────────────────────────────────────────────
 *
 * This module can clear a Do-Not-Disturb flag and cannot set one. That is not
 * an oversight. The opt-OUT path is GHL's own unsubscribe view, which is wired
 * to their compliance tooling and is the record of who asked to stop hearing
 * from us — a second, home-grown way to suppress someone is a second thing to
 * get wrong about a legal obligation. Opting back in is the safe direction: the
 * worst case of a bug here is that someone who wanted email keeps not getting
 * it, which they can tell us about.
 *
 * ── Why an upsert rather than a lookup ────────────────────────────────────
 *
 * The deployed token holds `contacts.write` and NOT `contacts.readonly` —
 * measured 2026-08-18, `GET /contacts/{id}` returns 401 on it. So there is no
 * way to find a contact by email and update it; the upsert, which takes an
 * email and returns the record, is the only door.
 *
 * The cost is real and worth stating: an upsert for an address that does not
 * exist CREATES a contact. Someone typing a stranger's email into the
 * resubscribe form makes a bare record with email marketing enabled. GHL's own
 * form behaves the same way, and the alternative — adding `contacts.readonly`
 * to the token that ships — widens the deployed credential for one form. If
 * that trade stops being worth it, the fix is the scope, and then a lookup
 * that simply does nothing when the address is unknown.
 */

/** The per-channel shape the API stores. "active" means DND is ON. */
export type DndChannel = "Email" | "SMS" | "Call" | "WhatsApp" | "GMB" | "FB";

/**
 * Turn marketing email back on for an address.
 *
 * Deliberately sends nothing but the email and the flag: no name, no phone. A
 * resubscribe is not a place to accept profile data from an unauthenticated
 * form, and sending a phone here would risk the match-conflict that silently
 * drops it (see phoneWasDropped in client.ts).
 */
export async function resubscribeEmail(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
}): Promise<CrmResult<{ contactId: string; isNew: boolean }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/contacts/upsert",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        email: opts.email,
        dndSettings: { Email: { status: "inactive" } },
      }),
    },
    (json) => {
      const c = (json.contact ?? {}) as Record<string, unknown>;
      return { contactId: String(c.id ?? ""), isNew: c.new === true };
    },
  );
}
