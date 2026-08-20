import { test, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// The two pages that replace go.reddoorla.com/unsubscribe and /resubscribe.
//
// The thing worth pinning hardest is what they DON'T do. Unsubscribing stays
// with GHL's own tooling — a second home-grown way to suppress someone is a
// second thing to get wrong about a legal obligation — so neither page may
// write on load, and the only write available anywhere here opts back IN.

type Body = Record<string, unknown>;

async function stub(page: Page, opts: { status?: number; body?: Body } = {}) {
  const posts: Body[] = [];
  await page.route("**/api/email-preferences", async (route) => {
    posts.push(JSON.parse(route.request().postData() ?? "{}"));
    const status = opts.status ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(opts.body ?? (status === 200 ? { success: true } : { error: "no" })),
    });
  });

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

test("/email/unsubscribed confirms without writing anything", async ({ page }) => {
  // A page that acted on load would turn the first link scanner to open the
  // email into a consent record.
  const { posts, stray } = await stub(page);
  await gotoHydrated(page, "/email/unsubscribed");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("You're unsubscribed");
  expect(posts).toHaveLength(0);
  expect(stray).toEqual([]);
});

test("it says what is NOT affected, which is what people actually worry about", async ({
  page,
}) => {
  await stub(page);
  await gotoHydrated(page, "/email/unsubscribed");
  await expect(page.getByText(/confirmation and reminders still come through/)).toBeVisible();
});

test("the recovery form opts back in and confirms in place", async ({ page }) => {
  const { posts } = await stub(page);
  await gotoHydrated(page, "/email/unsubscribed");

  await page.locator("#resub-email").fill("buyer@example.com");
  await page.getByRole("button", { name: "Resubscribe" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("back on the list");
  expect(posts).toHaveLength(1);
  expect(posts[0].email).toBe("buyer@example.com");
  // Nothing but the address: a resubscribe form is not a profile form.
  expect(posts[0].name).toBeUndefined();
  expect(posts[0].phone).toBeUndefined();
});

test("a bad address is caught before it reaches the CRM", async ({ page }) => {
  const { posts } = await stub(page);
  await gotoHydrated(page, "/email/unsubscribed");

  await page.locator("#resub-email").fill("not-an-email");
  await page.getByRole("button", { name: "Resubscribe" }).click();

  await expect(page.getByRole("alert")).toContainText("valid email");
  expect(posts).toHaveLength(0);
});

test("/email/resubscribed is pure confirmation", async ({ page }) => {
  const { posts, stray } = await stub(page);
  await gotoHydrated(page, "/email/resubscribed");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("back on the list");
  // The opt-in it reports happened upstream. Repeating it here on load would
  // make a page visit into a consent record.
  expect(posts).toHaveLength(0);
  expect(stray).toEqual([]);
});

for (const path of ["/email/unsubscribed", "/email/resubscribed"]) {
  test(`${path} stays out of search results`, async ({ page }) => {
    await stub(page);
    await gotoHydrated(page, path);
    // `follow`, not `nofollow`: there is nothing to index here, but the links
    // back into the site are worth crawling.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  });

  test(`${path} has no accessibility violations`, async ({ page }) => {
    await stub(page);
    // Set per-test: playwright.config.ts's `use: { reducedMotion }` does not
    // reach the page on 1.62.1 — see schedule.spec.ts for the measurement.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoHydrated(page, path);
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
