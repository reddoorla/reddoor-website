import { crmCall, type CrmFetch, type CrmResult } from "./client";
import { GHL_LOCATION_ID } from "./constants";

/**
 * Finding an existing contact by email.
 *
 * Needs `contacts.readonly`, which the deployed token gained on 2026-08-18
 * specifically so two things could stop guessing: the resubscribe form, which
 * should do nothing for an address the CRM has never seen rather than creating
 * a bare record, and the meeting-outcome page, which must not write a call
 * outcome onto a contact it invented.
 *
 * `POST /contacts/search` with an `eq` filter, NOT the `query` parameter.
 * Measured 2026-08-18: `query` is a fuzzy search and will happily return a
 * near-match, which for "write this person's consent" or "log this person's
 * call outcome" is the wrong kind of helpful. The filter returns total=1 for a
 * known address and total=0 for an absent one.
 *
 * Unlike the plain `/contacts/` list endpoint, this is used for records that
 * are minutes-to-months old, so its index lag (documented against the list) is
 * not a concern here.
 */

export type FoundContact = {
  id: string;
  email: string;
  name: string;
  /** Per-channel DND, e.g. `{ Email: { status: "active" } }`. */
  dndSettings: Record<string, { status?: string }>;
};

export async function findContactByEmail(opts: {
  token: string;
  fetch: CrmFetch;
  email: string;
}): Promise<CrmResult<FoundContact | null>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    "/contacts/search",
    {
      method: "POST",
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        pageLimit: 1,
        filters: [{ field: "email", operator: "eq", value: opts.email }],
      }),
    },
    (json) => {
      const list = (json.contacts as Record<string, unknown>[]) ?? [];
      const c = list[0];
      if (!c) return null;
      const first = String(c.firstName ?? "").trim();
      const last = String(c.lastName ?? "").trim();
      return {
        id: String(c.id ?? ""),
        email: String(c.email ?? ""),
        name: [first, last].filter(Boolean).join(" ") || String(c.contactName ?? ""),
        dndSettings: (c.dndSettings ?? {}) as Record<string, { status?: string }>,
      };
    },
  );
}

/** Update an existing contact by id. Never creates — that is the point. */
export async function updateContact(opts: {
  token: string;
  fetch: CrmFetch;
  contactId: string;
  body: Record<string, unknown>;
}): Promise<CrmResult<{ contactId: string }>> {
  return crmCall(
    { token: opts.token, fetch: opts.fetch },
    `/contacts/${encodeURIComponent(opts.contactId)}`,
    { method: "PUT", body: JSON.stringify(opts.body) },
    (json) => {
      const c = (json.contact ?? {}) as Record<string, unknown>;
      return { contactId: String(c.id ?? opts.contactId) };
    },
  );
}
