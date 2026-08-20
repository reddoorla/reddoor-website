import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The three pages that replace the CRM's own hosted links: reschedule, cancel,
// and add-to-calendar. All reached from an email carrying an appointment id.
//
// The id is a BEARER TOKEN, which is what most of these tests are really about:
// the page must not become a way to read a Zoom link off someone else's
// booking, and it must not cancel anything just because a mail scanner opened
// the message.

const EVENT = "yeNIKuJ12o9bnPIUweNV";
const ZOOM = "https://us06web.zoom.us/j/3922707667?pwd=UVRtSE16U0JCakY3Z2s4RUhTUS9Ydz09";

const SLOTS = [
  "2026-08-19T09:00:00-06:00",
  "2026-08-19T09:30:00-06:00",
  "2026-08-20T09:00:00-06:00",
];

type Body = Record<string, unknown>;

/**
 * Stub the appointment endpoints. `/api/appointment/**` especially: the real
 * one reaches a live calendar, and the reschedule and cancel routes MUTATE a
 * real booking the moment the dev server has a CRM token in its env.
 */
async function stub(
  page: Page,
  opts: {
    appointment?: Body | null;
    appointmentStatus?: number;
    actionStatus?: number;
    actionBody?: Body;
  } = {},
) {
  const posts: Array<{ url: string; body: Body }> = [];

  await page.route("**/api/slots**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ slots: SLOTS }),
    }),
  );

  await page.route("**/api/appointment/**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "POST") {
      posts.push({ url, body: JSON.parse(route.request().postData() ?? "{}") });
      const status = opts.actionStatus ?? 200;
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          opts.actionBody ?? (status === 200 ? { success: true } : { error: "no" }),
        ),
      });
      return;
    }
    const status = opts.appointmentStatus ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200
          ? (opts.appointment ?? {
              startTime: "2026-08-21T11:00:00-06:00",
              endTime: "2026-08-21T11:30:00-06:00",
              status: "confirmed",
              actionable: true,
            })
          : { error: "We couldn't find that booking." },
      ),
    });
  });

  // The browser must never talk to the CRM directly, and must never be handed
  // a Zoom link to render.
  const stray: string[] = [];
  await page.route("**/*.leadconnectorhq.com/**", async (route) => {
    stray.push(route.request().url());
    await route.abort();
  });

  return { posts, stray };
}

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

test.use({ timezoneId: "America/Los_Angeles" });

test.describe("reschedule", () => {
  test("shows the current time in the visitor's zone and moves it", async ({ page }) => {
    const { posts } = await stub(page);
    await gotoHydrated(page, `/reschedule/${EVENT}`);

    // 11:00 Mountain is 10:00 Pacific. Echoing the CRM's own string would tell
    // this visitor the wrong hour.
    await expect(page.getByText(/Currently booked for/)).toBeVisible();
    await expect(page.getByText(/10:00 AM PDT/)).toBeVisible();

    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await expect(page.getByText(/Moving to/)).toBeVisible();
    await page.getByRole("button", { name: "Move my call" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("You're all set");
    expect(posts).toHaveLength(1);
    // The CRM's own ISO string, not one re-rendered from a local time.
    expect(posts[0].body.startTime).toBe("2026-08-19T09:00:00-06:00");
  });

  test("a slot taken mid-flight refetches instead of looping on a stale list", async ({ page }) => {
    await stub(page, {
      actionStatus: 409,
      actionBody: { error: "That time was just taken. Please choose another.", refreshSlots: true },
    });
    await gotoHydrated(page, `/reschedule/${EVENT}`);

    await page.getByRole("button", { name: "8:00 AM", exact: true }).click();
    await page.getByRole("button", { name: "Move my call" }).click();

    await expect(page.getByRole("alert")).toContainText("just taken");
    // The selection is dropped so a dead time cannot be re-submitted — and the
    // message survives that, which is why it is rendered outside the block.
    await expect(page.getByRole("button", { name: "Move my call" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "8:00 AM", exact: true })).toBeVisible();
  });

  test("an appointment that is gone offers a new booking, not a broken form", async ({ page }) => {
    await stub(page, {
      appointment: {
        startTime: "2026-08-21T11:00:00-06:00",
        endTime: "2026-08-21T11:30:00-06:00",
        status: "cancelled",
        actionable: false,
      },
    });
    await gotoHydrated(page, `/reschedule/${EVENT}`);

    await expect(page.getByText(/no longer on the calendar/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Book a new time" })).toHaveAttribute(
      "href",
      "/schedule",
    );
    await expect(page.getByRole("button", { name: "Move my call" })).toHaveCount(0);
  });

  test("an unknown id says so instead of failing silently", async ({ page }) => {
    await stub(page, { appointmentStatus: 404 });
    await gotoHydrated(page, `/reschedule/${EVENT}`);
    await expect(page.getByText(/couldn't find that booking/)).toBeVisible();
  });
});

test.describe("cancel", () => {
  test("does NOT cancel on load — only on an explicit press", async ({ page }) => {
    // The id arrives in an email. A GET that cancelled would be fired by the
    // first link scanner or inbox preview to touch the message.
    const { posts } = await stub(page);
    await gotoHydrated(page, `/cancel/${EVENT}`);
    await expect(page.getByText(/Booked for/)).toBeVisible();
    expect(posts).toHaveLength(0);

    await page.getByRole("button", { name: "Cancel my call" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("That's cancelled");
    expect(posts).toHaveLength(1);
  });

  test("offers rescheduling as a real alternative, carrying the id across", async ({ page }) => {
    await stub(page);
    await gotoHydrated(page, `/cancel/${EVENT}`);
    await expect(page.getByRole("link", { name: "Reschedule instead" })).toHaveAttribute(
      "href",
      `/reschedule/${EVENT}`,
    );
  });

  test("an already-cancelled booking is not an error", async ({ page }) => {
    await stub(page, {
      appointment: {
        startTime: "2026-08-21T11:00:00-06:00",
        endTime: "2026-08-21T11:30:00-06:00",
        status: "cancelled",
        actionable: false,
      },
    });
    await gotoHydrated(page, `/cancel/${EVENT}`);
    await expect(page.getByText(/already off the calendar/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel my call" })).toHaveCount(0);
  });
});

test.describe("add to calendar", () => {
  test("offers all three hand-offs as server routes", async ({ page }) => {
    await stub(page);
    await gotoHydrated(page, `/calendar/${EVENT}`);

    await expect(page.getByRole("link", { name: "Google Calendar" })).toHaveAttribute(
      "href",
      `/calendar/${EVENT}/google`,
    );
    await expect(page.getByRole("link", { name: "Outlook" })).toHaveAttribute(
      "href",
      `/calendar/${EVENT}/outlook`,
    );
    await expect(page.getByRole("link", { name: /\.ics/ })).toHaveAttribute(
      "href",
      `/calendar/${EVENT}/event.ics`,
    );
  });

  test("never renders the Zoom link into the page", async ({ page }) => {
    // The whole reason those three are server redirects. A client-built
    // calendar URL would put the join link, password and all, in page source
    // that anyone with a forwarded email could read.
    await stub(page);
    await gotoHydrated(page, `/calendar/${EVENT}`);
    expect(await page.content()).not.toContain("zoom.us");
    expect(await page.content()).not.toContain(ZOOM);
  });
});

test.describe("across all three", () => {
  for (const path of ["reschedule", "cancel", "calendar"]) {
    test(`/${path} stays out of search indexes and out of Referer`, async ({ page }) => {
      await stub(page);
      await gotoHydrated(page, `/${path}/${EVENT}`);
      // A leaked id is a booking a stranger can move or cancel.
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );
      await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    });

    test(`/${path} has no accessibility violations`, async ({ page }) => {
      await stub(page);
      // Set per-test: playwright.config.ts's `use: { reducedMotion }` does not
      // reach the page on 1.62.1 — see schedule.spec.ts for the measurement.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await gotoHydrated(page, `/${path}/${EVENT}`);
      await expect
        .poll(
          () =>
            page
              .locator("[data-page-transition]")
              .last()
              .evaluate((el) => Number(getComputedStyle(el).opacity)),
          {
            timeout: 15_000,
          },
        )
        .toBe(1);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
