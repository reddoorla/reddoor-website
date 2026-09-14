import { test, expect } from "@playwright/test";

// /bew is the short link on Boise Entrepreneur Week collateral. It exists to
// attach the event's utm tags to a visit to /boise; the Location header is the
// whole contract, so these assert it at the HTTP level and never render.

async function locationOf(request: import("@playwright/test").APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(res.status(), `status for ${path}`).toBe(302);
  return new URL(res.headers()["location"], "http://x");
}

test("/bew lands on /boise tagged as the event", async ({ request }) => {
  const to = await locationOf(request, "/bew");
  expect(to.pathname).toBe("/boise");
  expect(to.searchParams.get("utm_source")).toBe("bew");
  expect(to.searchParams.get("utm_medium")).toBe("event");
  expect(to.searchParams.get("utm_campaign")).toBe("bew-2026");
});

test("a collateral-specific utm_content survives the hop", async ({ request }) => {
  const to = await locationOf(request, "/bew?utm_content=booth-card");
  expect(to.searchParams.get("utm_content")).toBe("booth-card");
  expect(to.searchParams.get("utm_source")).toBe("bew");
});

test("nothing but utm parameters passes, and the path never moves", async ({ request }) => {
  const to = await locationOf(request, "/bew?next=https://evil.example.com&email=x%40y.z");
  expect(to.host).toBe("x");
  expect(to.pathname).toBe("/boise");
  expect(to.searchParams.has("next")).toBe(false);
  expect(to.searchParams.has("email")).toBe(false);
});

test("the redirect is not cached", async ({ request }) => {
  const res = await request.get("/bew", { maxRedirects: 0 });
  expect(res.headers()["cache-control"]).toContain("no-store");
});
