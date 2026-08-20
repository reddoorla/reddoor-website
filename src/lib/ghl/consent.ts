import { crmCall, type CrmFetch, type CrmResult } from "./client";
import { GHL_LOCATION_ID } from "./constants";
import { findContactByEmail, updateContact } from "./lookup";

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
 * ── Look up first; never invent a subscriber ──────────────────────────────
 *
 * The form is public and takes a typed address, so an upsert would let anyone
 * conjure a contact — for a stranger's email, or a typo — with marketing on.
 * So: find the contact, and if there is no such contact, do nothing and say
 * nothing. `outcome` reports which of those happened, for the log only.
 *
 * The upsert path is kept as a FALLBACK for exactly one condition: the token
 * lacking `contacts.readonly`. That scope was added on 2026-08-18, so this
 * should never fire — but a scope can be revoked in a dashboard by someone who
 * does not know this form depends on it, and silently breaking a subscriber's
 * opt-in is worse than the pollution risk. A 401 here is logged loudly.
 */

const DND_OFF = { Email: { status: "inactive" } };

export type ResubscribeOutcome =
  "reactivated" | "already-subscribed" | "unknown-address" | "created-by-fallback";

export async function resubscribeEmail(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
}): Promise<CrmResult<{ outcome: ResubscribeOutcome; contactId: string }>> {
  const found = await findContactByEmail({
    token: opts.token,
    fetch: opts.fetch,
    email: opts.email,
  });

  if (!found.ok) {
    if (found.status !== 401) return found;
    // See the module comment: the read scope is gone. Fall back rather than
    // leave someone unable to opt back in.
    const up = await upsertResubscribe(opts);
    if (!up.ok) return up;
    return { ok: true, data: { outcome: "created-by-fallback", contactId: up.data.contactId } };
  }

  if (!found.data) {
    // Nothing to do, and deliberately nothing created.
    return { ok: true, data: { outcome: "unknown-address", contactId: "" } };
  }

  const already = found.data.dndSettings?.Email?.status !== "active";
  const updated = await updateContact({
    token: opts.token,
    fetch: opts.fetch,
    contactId: found.data.id,
    body: { dndSettings: DND_OFF },
  });
  if (!updated.ok) return updated;

  return {
    ok: true,
    data: {
      outcome: already ? "already-subscribed" : "reactivated",
      contactId: found.data.id,
    },
  };
}

/** The pre-`contacts.readonly` path. See the module comment for when it runs. */
function upsertResubscribe(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
}): Promise<CrmResult<{ contactId: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/contacts/upsert",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        email: opts.email,
        dndSettings: DND_OFF,
      }),
    },
    (json) => {
      const c = (json.contact ?? {}) as Record<string, unknown>;
      return { contactId: String(c.id ?? "") };
    },
  );
}
