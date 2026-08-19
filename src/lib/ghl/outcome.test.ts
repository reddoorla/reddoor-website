import { describe, expect, it } from "vitest";
import { OUTCOMES, RECAP_NO, RECAP_YES, isOutcome, recordMeetingOutcome, tagFor } from "./outcome";

function stubCrm(
  opts: { found?: Record<string, unknown> | null; updateStatus?: number; tagStatus?: number } = {},
) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ url, method, body: JSON.parse(String(init.body ?? "{}")) });
    let status = 200;
    let body: unknown = {};
    if (url.includes("/contacts/search")) {
      const found =
        opts.found === undefined
          ? { id: "C1", email: "buyer@example.com", firstName: "Dana", lastName: "Buyer" }
          : opts.found;
      body = { contacts: found ? [found] : [], total: found ? 1 : 0 };
    } else if (url.includes("/tags")) {
      status = opts.tagStatus ?? 200;
      body = { tags: [] };
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

const base = {
  email: "buyer@example.com",
  outcome: "Sold!" as const,
  leadValue: "12000",
  internalNotes: "Budget confirmed with their CFO.",
  recapNotes: "Agreed scope and next steps.",
  sendRecap: true,
};

describe("the option strings", () => {
  it("match the CRM's picklists byte for byte", () => {
    // Read from GET /locations/{id}/customFields on 2026-08-18. GHL matches
    // these exactly; an option "tidied up" here silently unmaps the answer from
    // the record and the salesperson sees a blank field, not an error. Note the
    // space after the slash, and the exclamation mark.
    expect(OUTCOMES.map((o) => o.value)).toEqual([
      "No Show",
      "Unqualified - Not A Good Fit (Do Not Follow Up)",
      "Not Interested/ Not Yet Ready",
      "Offer Made (pending)",
      "Sold!",
    ]);
    expect(RECAP_YES).toBe("Yes (send email)");
    expect(RECAP_NO).toBe("No (don't send email)");
  });

  it("gives every outcome a distinct, namespaced tag", () => {
    const tags = OUTCOMES.map((o) => o.tag);
    expect(new Set(tags).size).toBe(tags.length);
    // Namespaced because the location already uses bare lower-case tags, and
    // the CRM has its own no-show handling keyed to appointment STATUS.
    for (const t of tags) expect(t.startsWith("outcome ")).toBe(true);
  });

  it("rejects anything not on the picklist", () => {
    expect(isOutcome("Sold!")).toBe(true);
    expect(isOutcome("sold!")).toBe(false);
    expect(isOutcome("Not Interested / Not Yet Ready")).toBe(false); // spacing differs
    expect(isOutcome(undefined)).toBe(false);
  });
});

describe("recordMeetingOutcome", () => {
  it("writes the fields and applies the outcome's tag", async () => {
    const { fetch, find } = stubCrm();
    const r = await recordMeetingOutcome({ token: "t", fetch, input: base });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data?.name).toBe("Dana Buyer");

    const fields = find("/contacts/C1")[0].body.customFields as { id: string; value: string }[];
    const byId = Object.fromEntries(fields.map((f) => [f.id, f.value]));
    expect(byId.ecxAtBgBCtua0mCmwOjT).toBe("Sold!");
    expect(byId.hgIqPAD8nfqQ7fOIGMxU).toBe("12000");
    expect(byId.OvwDdKei8MjYXxXu1WVf).toBe(RECAP_YES);

    // Through the tags endpoint, never the update body: `tags` on a contact
    // write REPLACES the array, dropping `application completed` and every tag
    // a workflow has added since.
    expect(find("/tags")[0].body.tags).toEqual([tagFor("Sold!")]);
    expect("tags" in find("/contacts/C1")[0].body).toBe(false);
  });

  it("omits empty fields rather than blanking what a previous log recorded", async () => {
    const { fetch, find } = stubCrm();
    await recordMeetingOutcome({
      token: "t",
      fetch,
      input: { ...base, leadValue: "", internalNotes: "   ", recapNotes: "", sendRecap: false },
    });
    const fields = find("/contacts/C1")[0].body.customFields as { id: string }[];
    const ids = fields.map((f) => f.id);
    expect(ids).toContain("ecxAtBgBCtua0mCmwOjT"); // outcome, always
    expect(ids).toContain("OvwDdKei8MjYXxXu1WVf"); // recap choice, always
    expect(ids).not.toContain("hgIqPAD8nfqQ7fOIGMxU");
    expect(ids).not.toContain("rKaJuZQUqDcqq1VZOoZ5");
    expect(ids).not.toContain("zPcu05nFBM9gzqIbpxZb");
  });

  it("refuses to invent a contact for an unknown address", async () => {
    // A call outcome on a contact nobody spoke to is worse than a failed
    // submission — it is a fabricated lead in someone's pipeline.
    const { fetch, calls } = stubCrm({ found: null });
    const r = await recordMeetingOutcome({ token: "t", fetch, input: base });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
    expect(calls.filter((c) => c.url.includes("upsert"))).toHaveLength(0);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("reports a failed tag without failing the log", async () => {
    // The outcome is already on the record by then; the tag is the hook for a
    // workflow that does not exist yet.
    const { fetch } = stubCrm({ tagStatus: 500 });
    const r = await recordMeetingOutcome({ token: "t", fetch, input: base });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data?.taggedOk).toBe(false);
  });

  it("surfaces a failed write rather than claiming it saved", async () => {
    const { fetch } = stubCrm({ updateStatus: 422 });
    const r = await recordMeetingOutcome({ token: "t", fetch, input: base });
    expect(r.ok).toBe(false);
  });
});
