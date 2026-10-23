import { describe, it, expect, vi } from "vitest";
import { isRedirect } from "@sveltejs/kit";

// The Google and Outlook hand-offs answer with a redirect to another origin.
// SvelteKit 3 throws on an external redirect unless the call allows it, so
// after the Kit 3 upgrade (#264) both routes answered 500 in production — the
// buttons on "You're on the calendar" and in the CRM's confirmation email went
// nowhere, while event.ics, which redirects nowhere, kept working. Nothing
// covered the handlers themselves: the smoke suite stubs the CRM read away.
vi.mock("$app/env/private", () => ({ CRM_FUNNEL_ACTIVE_TOKEN: "crm-token" }));
vi.mock("$lib/ghl/appointment", () => ({
  fetchAppointment: async () => ({
    ok: true,
    data: {
      title: "Intro call — Pat Buyer",
      startTime: "2026-10-26T13:00:00-06:00",
      endTime: "2026-10-26T13:30:00-06:00",
      address: "https://us06web.zoom.us/j/1?pwd=x",
    },
  }),
}));

const google = await import("./google/+server");
const outlook = await import("./outlook/+server");

async function handOff(handler: (event: never) => unknown): Promise<URL> {
  const event = { params: { eventId: "5AuxjkTZ5g0u3ltMbS4D" }, fetch } as never;
  try {
    await handler(event);
  } catch (e) {
    if (isRedirect(e)) {
      expect(e.status).toBe(302);
      return new URL(e.location);
    }
    throw e;
  }
  throw new Error("the handler returned without redirecting");
}

describe("the calendar hand-offs", () => {
  it("send Google Calendar the event", async () => {
    const to = await handOff(google.GET as never);
    expect(to.origin).toBe("https://calendar.google.com");
    expect(to.searchParams.get("dates")).toBe("20261026T190000Z/20261026T193000Z");
  });

  it("send Outlook on the web the event", async () => {
    const to = await handOff(outlook.GET as never);
    expect(to.origin).toBe("https://outlook.live.com");
    expect(to.searchParams.get("startdt")).toBe("2026-10-26T19:00:00.000Z");
  });
});
