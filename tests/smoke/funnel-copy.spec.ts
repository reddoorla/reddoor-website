import { test, expect, type Page } from "@playwright/test";

// The booking funnel's copy lives in Prismic's `funnel_copy` document, with the
// shipped wording as the fallback, and /preview/funnel shows every state from
// sample data. These tests hold what a visitor and Tim observe, never layout.

/**
 * Every call the funnel can make. In preview mode none may happen: /api/book
 * makes a real appointment on Tim's calendar whenever the server has a CRM
 * token. Each is also stubbed, so a regression is a red test, not a booking.
 */
const FUNNEL_APIS = ["/api/book", "/api/slots", "/api/inquiry", "/api/appointment", "/inquiry"];

async function countFunnelCalls(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route(/\/(api\/|inquiry)/, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (FUNNEL_APIS.some((api) => path === api || path.startsWith(`${api}/`))) {
      calls.push(`${route.request().method()} ${path}`);
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  });
  return calls;
}

test.describe("/preview/funnel", () => {
  test(
    "shows the booked state with the sample email in place of the {email} token",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/preview/funnel");
      await expect(
        page.getByRole("heading", { level: 1, name: "You’re on the calendar." }),
      ).toBeVisible();
      const booked = page.getByRole("status").filter({ hasText: "We’ve sent a confirmation to" });
      await expect(booked).toContainText(
        "We’ve sent a confirmation to sample.visitor@example.com, and the Zoom link is in the calendar invite.",
      );
      await expect(page.locator("body")).not.toContainText("{email}");
    },
  );

  test("shows every state of every funnel page", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/preview/funnel");
    for (const h1 of [
      "Let’s find a time.",
      "Thanks — your application is in.",
      "You’re on the calendar.",
      "Thanks for being straight with us.",
      "Cancel your call?",
      "That’s cancelled.",
      "Let’s find a better time.",
      "You’re all set.",
    ]) {
      await expect(page.getByRole("heading", { level: 1, name: h1 }).first()).toBeVisible();
    }
    for (const line of [
      "So we can text you a reminder.",
      "That call is already off the calendar.",
      "That call is no longer on the calendar.",
      "We couldn’t find that booking.",
    ]) {
      await expect(page.getByText(line).first()).toBeVisible();
    }
  });

  test(
    "never calls the booking, slots, inquiry or appointment APIs, even when its buttons are pressed",
    { tag: "@smoke" },
    async ({ page }) => {
      const calls = await countFunnelCalls(page);
      await page.goto("/preview/funnel");
      await page.waitForLoadState("networkidle");

      // The default preview has empty fields; fill them so the submit would
      // pass validation and reach the network if anything let it.
      await page.locator("#book-name").first().fill("Sample Visitor");
      await page.locator("#book-email").first().fill("sample.visitor@example.com");
      for (const name of ["Confirm this time", "Cancel my call", "Move my call"]) {
        const buttons = page.getByRole("button", { name });
        for (let i = 0; i < (await buttons.count()); i++) await buttons.nth(i).click();
      }
      await page.waitForLoadState("networkidle");
      expect(calls).toEqual([]);
    },
  );
});

test.describe("Tim's photo on /schedule", () => {
  test("shows with its alt text when the field is set", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/dev/funnel-photo");
    await expect(page.getByRole("img", { name: "Tim Holmes at the studio" })).toBeVisible();
  });

  test(
    "leaves no image, broken or otherwise, while the field is empty",
    { tag: "@smoke" },
    async ({ page }) => {
      await countFunnelCalls(page);
      await page.goto("/schedule");
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Let’s find a time.");
      await page.waitForLoadState("networkidle");
      const broken = await page.$$eval("img", (imgs) =>
        imgs
          .filter((img) => !img.getAttribute("src") || (img.complete && img.naturalWidth === 0))
          .map((img) => img.outerHTML),
      );
      expect(broken).toEqual([]);
      await expect(page.getByRole("img", { name: /Tim Holmes/ })).toHaveCount(0);
    },
  );
});
