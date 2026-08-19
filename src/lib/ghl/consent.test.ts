import { describe, expect, it } from "vitest";
import { resubscribeEmail } from "./consent";
import { GHL_LOCATION_ID } from "./constants";

function stub(body: unknown, status = 200) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: JSON.parse(String(init.body ?? "{}")),
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

describe("resubscribeEmail", () => {
  it("clears the Email DND and nothing else", async () => {
    const { fetch, calls } = stub({ contact: { id: "C1", new: false } });
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });

    expect(r.ok).toBe(true);
    expect(calls[0].url).toContain("/contacts/upsert");
    expect(calls[0].body).toEqual({
      locationId: GHL_LOCATION_ID,
      email: "buyer@example.com",
      dndSettings: { Email: { status: "inactive" } },
    });
  });

  it("only ever opts IN — it cannot be made to suppress anyone", async () => {
    const { fetch, calls } = stub({ contact: { id: "C1", new: false } });
    await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    const sent = JSON.stringify(calls[0].body);
    // "active" is DND ON. If this module can ever emit it, the opt-out path has
    // two implementations and one of them is not the compliance record.
    expect(sent).not.toContain('"active"');
    expect(sent).toContain('"inactive"');
    // A second suppression channel is the same mistake by another name.
    expect(calls[0].body.dnd).toBeUndefined();
    expect(Object.keys(calls[0].body.dndSettings as object)).toEqual(["Email"]);
  });

  it("sends no name and no phone", async () => {
    // A resubscribe form is not a place to accept profile data from an
    // unauthenticated stranger — and a phone here risks the match-conflict
    // that silently drops it (see phoneWasDropped).
    const { fetch, calls } = stub({ contact: { id: "C1", new: false } });
    await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    expect("name" in calls[0].body).toBe(false);
    expect("phone" in calls[0].body).toBe(false);
    expect("tags" in calls[0].body).toBe(false);
  });

  it("reports whether a contact was CREATED, which is the upsert's known cost", async () => {
    // An address the CRM has never seen makes a bare record. The endpoint logs
    // it; the test pins that the signal survives the helper.
    const { fetch } = stub({ contact: { id: "C9", new: true } });
    const r = await resubscribeEmail({ token: "t", fetch, email: "stranger@example.com" });
    if (r.ok) expect(r.data.isNew).toBe(true);
  });

  it("surfaces a failure rather than reporting a consent change that did not happen", async () => {
    const { fetch } = stub({ message: "nope" }, 422);
    const r = await resubscribeEmail({ token: "t", fetch, email: "buyer@example.com" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(422);
  });
});
