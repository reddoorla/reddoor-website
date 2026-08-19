import { test, expect } from "@playwright/test";

// `/reschedule` with no booking id is reachable in production: the CRM's
// no-show snippets build `.../reschedule/{{appointment.id}}` and that merge
// field renders EMPTY — measured from a delivered SMS, which landed a client
// chasing a missed call on a 404. These pin the recovery.

test("a reschedule link with no id lands on the booking page, not a 404", async ({ request }) => {
  const res = await request.get("/reschedule", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toBe("/schedule");
});

test("the trailing-slash form the CRM actually sends gets there too", async ({ request }) => {
  // SvelteKit 308s `/reschedule/` to `/reschedule`; the second hop is ours.
  const res = await request.get("/reschedule/");
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).pathname).toBe("/schedule");
});

test("a real booking still reaches the reschedule page, not the redirect", async ({ request }) => {
  // The id guard wants 10+ chars, so this proves the redirect did not swallow
  // the id-bearing route.
  const res = await request.get("/reschedule/ECv5gPWC3IY5uWIlqEbe", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
});
