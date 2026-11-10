import { test, expect, type Page } from "@playwright/test";

// The MedTech funnel's Meta Pixel ($lib/consent/metaPixel). What a visitor and
// Meta observe: on a funnel page, nothing goes to Facebook until Accept, then
// fbevents.js loads and Tim's pixel gets a PageView; off the funnel there is no
// ask and no request, consented or not. No test ever reaches Facebook: both
// hosts are answered here, and fbevents.js is replaced by an empty script, so
// the `fbq` queue the page built is what the assertions read.

const PIXEL_ID = "4257052441251456";
const FACEBOOK = /^https:\/\/(connect\.facebook\.net|www\.facebook\.com)\//;

async function watchFacebook(page: Page) {
  const requests: string[] = [];
  await page.route(FACEBOOK, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  // The server copy of each event: answered here so that a developer's own
  // META_CAPI_ACCESS_TOKEN never sends a test PageView to Tim's pixel.
  // watchServerEvents (registered later, so matched first) records them.
  await page.route("**/api/meta-event", (route) => route.fulfill({ status: 204 }));
  // /schedule asks the CRM for slots on mount; answer that here too.
  await page.route("**/api/slots**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"slots":[]}' }),
  );
  return requests;
}

/** The bodies the page posts to /api/meta-event (the Conversions API copy). */
async function watchServerEvents(page: Page) {
  const bodies: Record<string, unknown>[] = [];
  await page.route("**/api/meta-event", (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 204 });
  });
  return bodies;
}

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

const consentBar = (page: Page) => page.getByRole("region", { name: "Cookie consent" });

/** The `fbq` calls the page queued, or null when there is no `fbq` at all. */
const fbqCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { fbq?: { queue: unknown[][] } }).fbq?.queue ?? null);

/** How many PageViews the page has queued. Exact, so a double-fire is red. */
const pageViews = async (page: Page) =>
  ((await fbqCalls(page)) ?? []).filter((c) => c[0] === "track" && c[1] === "PageView").length;

/** A client-side navigation: SvelteKit's router takes any same-origin link click. */
async function clientNavigate(page: Page, path: string) {
  await page.evaluate((href) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = "test navigation";
    document.body.appendChild(a);
    a.click();
  }, path);
  await page.waitForURL((u) => u.pathname === path);
}

for (const path of ["/medtech", "/brand-friction-audit", "/schedule", "/not-a-fit"]) {
  test(
    `${path}: nothing reaches Facebook before Accept; after it, Tim's pixel gets a PageView`,
    { tag: "@smoke" },
    async ({ page }) => {
      const requests = await watchFacebook(page);
      await gotoHydrated(page, path);

      await expect(consentBar(page)).toBeVisible();
      expect(requests).toEqual([]);
      expect(await fbqCalls(page)).toBeNull();

      await consentBar(page).getByRole("button", { name: "Accept" }).click();
      await expect(consentBar(page)).toBeHidden();
      await expect.poll(() => requests).toContain("https://connect.facebook.net/en_US/fbevents.js");
      expect(await fbqCalls(page)).toContainEqual(["init", PIXEL_ID]);
      expect(await pageViews(page)).toBe(1);

      // Remembered: the next visit loads the pixel without asking again.
      await gotoHydrated(page, path);
      await expect(consentBar(page)).toBeHidden();
      await expect.poll(() => pageViews(page)).toBe(1);
      expect(await pageViews(page)).toBe(1);
    },
  );
}

test(
  "client-side navigation: one PageView per funnel page, none after leaving the funnel",
  { tag: "@smoke" },
  async ({ page }) => {
    await watchFacebook(page);
    const serverEvents = await watchServerEvents(page);
    await gotoHydrated(page, "/medtech");
    await consentBar(page).getByRole("button", { name: "Accept" }).click();
    await expect.poll(() => pageViews(page)).toBe(1);

    // The inquiry hands over to /schedule with goto(): a SPA arrival.
    await clientNavigate(page, "/schedule");
    await expect.poll(() => pageViews(page)).toBe(2);
    await expect.poll(() => serverEvents.length).toBe(2);

    // A hash change on a funnel page is not a new page.
    await page.evaluate(() => (location.hash = "inquire"));
    await clientNavigate(page, "/");
    await clientNavigate(page, "/about");
    // Back onto the funnel, no sleep: its PageView lands in the same flush as
    // the arrival, so a stray fire on / or /about would already have made it 4.
    await clientNavigate(page, "/not-a-fit");
    await expect.poll(() => pageViews(page)).toBe(3);
    await expect.poll(() => serverEvents.length).toBe(3);
    expect(await pageViews(page)).toBe(3);
    // One server copy per browser PageView, each with its own id.
    expect(new Set(serverEvents.map((e) => e.event_id)).size).toBe(3);
  },
);

test(
  "Reject on the funnel loads nothing, then or on the next visit",
  { tag: "@smoke" },
  async ({ page }) => {
    const requests = await watchFacebook(page);
    const serverEvents = await watchServerEvents(page);
    await gotoHydrated(page, "/not-a-fit");
    await consentBar(page).getByRole("button", { name: "Reject" }).click();
    await expect(consentBar(page)).toBeHidden();

    await gotoHydrated(page, "/schedule");
    await expect(consentBar(page)).toBeHidden();
    expect(await fbqCalls(page)).toBeNull();
    expect(requests).toEqual([]);
    expect(serverEvents).toEqual([]);
  },
);

test(
  "after Accept, the server copy of the PageView carries the browser's eventID",
  { tag: "@smoke" },
  async ({ page }) => {
    await watchFacebook(page);
    const serverEvents = await watchServerEvents(page);
    await gotoHydrated(page, "/brand-friction-audit");
    expect(serverEvents).toEqual([]);

    await consentBar(page).getByRole("button", { name: "Accept" }).click();
    await expect.poll(() => serverEvents.length).toBe(1);
    // Exactly one each way: a double post would make these differ.
    expect(serverEvents.length).toBe(await pageViews(page));

    const track = ((await fbqCalls(page)) ?? []).find(
      (c) => c[0] === "track" && c[1] === "PageView",
    );
    const eventID = (track?.[3] as { eventID?: string } | undefined)?.eventID;
    expect(eventID).toBeTruthy();
    expect(serverEvents[0]).toMatchObject({
      event_name: "PageView",
      event_id: eventID,
      consent: "accepted",
    });
    expect(new URL(String(serverEvents[0].event_source_url)).pathname).toBe(
      "/brand-friction-audit",
    );
  },
);

test(
  "off the funnel there is no ask and no pixel, even after consent",
  { tag: "@smoke" },
  async ({ page }) => {
    const requests = await watchFacebook(page);
    const serverEvents = await watchServerEvents(page);
    await page.addInitScript(() => localStorage.setItem("cookieConsent", "true"));

    for (const path of ["/", "/boise", "/about"]) {
      await gotoHydrated(page, path);
      await expect(consentBar(page)).toHaveCount(0);
      expect(await fbqCalls(page), path).toBeNull();
    }
    expect(requests).toEqual([]);
    expect(serverEvents).toEqual([]);
  },
);
