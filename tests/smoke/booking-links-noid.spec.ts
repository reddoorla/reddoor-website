import { test, expect } from "@playwright/test";

// The CRM builds `{{custom_values.sub_domain_url}}/<route>/{{appointment.id}}`,
// and that id can arrive empty — a message composed outside appointment scope,
// a mail client truncating the link, a forward dropping the last segment.
// Measured on /reschedule after a real send: SvelteKit 308s the trailing slash
// to the bare path, which had no route, so a client chasing a missed call met a
// 404. These pin the recovery on every route the CRM links to.
//
// The two routes recover differently on purpose. /reschedule goes to /schedule,
// which is the outcome its message wants. /cancel does NOT — sending someone to
// a booking page when they came to cancel is the dark pattern that page is
// written to avoid — so it renders its own "we couldn't find that booking".

test("a reschedule link with no id lands on the booking page, not a 404", async ({ request }) => {
  const res = await request.get("/reschedule", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toBe("/schedule");
});

test("the trailing-slash form the CRM actually sends gets there too", async ({ request }) => {
  const res = await request.get("/reschedule/");
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).pathname).toBe("/schedule");
});

test("a cancel link with no id explains itself instead of 404ing", async ({ page }) => {
  await page.goto("/cancel", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
  await expect(page.getByText("We couldn't find that booking.")).toBeVisible();
  // And it must not have gone asking the API about an empty id.
  await expect(page.getByText("Booked for")).toHaveCount(0);
});

test("the trailing-slash cancel form resolves to the same page", async ({ request }) => {
  const res = await request.get("/cancel/");
  expect(res.status()).toBe(200);
  expect(new URL(res.url()).pathname).toBe("/cancel");
});

test("a real booking still reaches both pages, not the recovery", async ({ request }) => {
  // Proves the optional param and the redirect did not swallow the id-bearing
  // routes. 10+ chars, so it clears each route's own id guard.
  for (const path of ["/reschedule/ECv5gPWC3IY5uWIlqEbe", "/cancel/ECv5gPWC3IY5uWIlqEbe"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
});

test("neither recovery page is offered to crawlers", async ({ request }) => {
  // /cancel now answers 200 where it used to 404, so it has HTML that could be
  // indexed. It carries the same noindex as the id-bearing page.
  const html = await (await request.get("/cancel")).text();
  expect(html).toMatch(/<meta[^>]+name=["']robots["'][^>]+noindex/i);
});
