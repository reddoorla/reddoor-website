import { describe, expect, it } from "vitest";
import { resubscribeEmail } from "./consent";

/**
 * Routes by URL and method, because a resubscribe is now two calls — find the
 * contact, then update it — and a positional queue would be brittle to a
 * reordering that changes nothing observable.
 */
function stubCrm(
  opts: {
    /** null = no such contact. */
    found?: Record<string, unknown> | null;
    searchStatus?: number;
    updateStatus?: number;
    upsertStatus?: number;
  } = {},
) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: JSON.parse(String(init.body ?? "{}")) });

    let status = 200;
    let body: unknown = {};
    if (url.includes("/contacts/search")) {
      status = opts.searchStatus ?? 200;
      const found =
        opts.found === undefined ? { id: "C1", email: "buyer@example.com" } : opts.found;
      body =
        status === 200
          ? { contacts: found ? [found] : [], total: found ? 1 : 0 }
          : { message: "nope" };
    } else if (url.includes("/contacts/upsert")) {
      status = opts.upsertStatus ?? 200;
      body = { contact: { id: "C9", new: true } };
    } else if (method === "PUT") {
      status = opts.updateStatus ?? 200;
      body = status === 200 ? { contact: { id: "C1" } } : { message: "nope" };
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  const find = (fragment: string) => calls.filter((c) => c.url.includes(fragment));
  return { fetch, calls, find };
}

describe("resubscribeEmail", () => {
  it("finds the contact and clears only its Email DND", async () => {
    const { fetch, find } = stubCrm({
      found: { id: "C1", email: "buyer@example.com", dndSettings: { Email: { status: "active" } } },
    });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.outcome).toBe("reactivated");
    // An exact-match filter, not the fuzzy `query` — a near-match is the wrong
    // kind of helpful when the write is somebody's consent.
    expect(find("/contacts/search")[0].body.filters).toEqual([
      { field: "email", operator: "eq", value: "buyer@example.com" },
    ]);
    const put = find("/contacts/C1")[0];
    expect(put.method).toBe("PUT");
    expect(put.body).toEqual({ dndSettings: { Email: { status: "inactive" } } });
  });

  it("creates NOTHING for an address the CRM has never seen", async () => {
    // The form is public and takes a typed address. An upsert here would let
    // anyone conjure a subscriber out of a stranger's email or a typo.
    const { fetch, calls } = stubCrm({ found: null });
    const r = await resubscribeEmail({ token: "t", fetch, email: "stranger@example.com" });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.outcome).toBe("unknown-address");
      expect(r.data.contactId).toBe("");
    }
    expect(calls.filter((c) => c.url.includes("upsert"))).toHaveLength(0);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("reports an already-subscribed address without pretending it changed", async () => {
    const { fetch } = stubCrm({ found: { id: "C1", email: "buyer@example.com", dndSettings: {} } });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    if (r.ok) expect(r.data.outcome).toBe("already-subscribed");
  });

  it("only ever opts IN — it cannot be made to suppress anyone", async () => {
    const { fetch, calls } = stubCrm();
    await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    const sent = JSON.stringify(calls.map((c) => c.body));
    // "active" is DND ON. If this module can ever emit it, the opt-out path has
    // two implementations and one of them is not the compliance record.
    expect(sent).not.toContain('"active"');
    expect(sent).toContain('"inactive"');
  });

  it("sends no name and no phone", async () => {
    // A resubscribe form is not a place to take profile data from a stranger,
    // and a phone risks the match-conflict that silently drops it.
    const { fetch, calls } = stubCrm();
    await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    for (const c of calls) {
      expect("name" in c.body).toBe(false);
      expect("phone" in c.body).toBe(false);
      expect("tags" in c.body).toBe(false);
    }
  });

  it("falls back to an upsert ONLY when the read scope is missing", async () => {
    // A revoked scope must not silently break somebody's opt-in. Anything other
    // than 401 is a real failure and is surfaced, not worked around.
    const { fetch, calls } = stubCrm({ searchStatus: 401 });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.outcome).toBe("created-by-fallback");
    expect(calls.filter((c) => c.url.includes("upsert"))).toHaveLength(1);
  });

  it("surfaces a non-401 search failure rather than inventing a contact", async () => {
    const { fetch, calls } = stubCrm({ searchStatus: 500 });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    expect(r.ok).toBe(false);
    expect(calls.filter((c) => c.url.includes("upsert"))).toHaveLength(0);
  });

  it("surfaces a failed update rather than reporting consent that did not change", async () => {
    const { fetch } = stubCrm({ updateStatus: 422 });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });
});
