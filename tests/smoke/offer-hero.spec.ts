import { test, expect } from "@playwright/test";

// The offer landing page's hero (/brand-friction-audit, the `offer_hero`
// slice), exercised on /dev/a11y-fixtures: the document sits in an unpublished
// Prismic release, so the real page has nothing to render in CI. What is
// asserted is what a visitor meets — the page's h1, the email CTA opening the
// questionnaire with their address already in it, and the video's name.
const PATH = "/dev/a11y-fixtures";

async function gotoHydrated(page: import("@playwright/test").Page) {
  // Nothing here should reach Vimeo or the CRM.
  await page.route("https://player.vimeo.com/**", (route) => route.abort());
  await page.route("**/api/inquiry", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' }),
  );
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
}

const hero = (page: import("@playwright/test").Page, n = 0) =>
  page.locator('section[data-slice-type="offer_hero"]').nth(n);

test("the offer headline is the page's level-one heading", { tag: "@smoke" }, async ({ page }) => {
  await gotoHydrated(page);
  await expect(
    hero(page).getByRole("heading", {
      level: 1,
      name: "Get a plan to fix what’s costing you credibility with new buyers.",
    }),
  ).toBeVisible();
});

test(
  "Get Started opens the questionnaire with the typed email, without navigating",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    const before = page.url();
    await hero(page).getByRole("textbox", { name: "Email address" }).fill("founder@example.com");
    await hero(page).getByRole("button", { name: "Get Started" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Email address" })).toHaveValue(
      "founder@example.com",
    );
    expect(page.url()).toBe(before);
  },
);

test(
  "Enter in the email field opens the questionnaire too",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    const field = hero(page).getByRole("textbox", { name: "Email address" });
    await field.fill("founder@example.com");
    await field.press("Enter");
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Email address" }),
    ).toHaveValue("founder@example.com");
  },
);

test("an empty field still opens the questionnaire, empty", { tag: "@smoke" }, async ({ page }) => {
  await gotoHydrated(page);
  await hero(page).getByRole("button", { name: "Get Started" }).click();
  await expect(
    page.getByRole("dialog").getByRole("textbox", { name: "Email address" }),
  ).toHaveValue("");
});

test("the video is named, and its player keeps the name", { tag: "@smoke" }, async ({ page }) => {
  await gotoHydrated(page);
  const play = hero(page).getByRole("button", { name: "Play video: Brand Friction Audit" });
  await expect(play).toBeVisible();
  await play.click();
  await expect(hero(page).locator('iframe[title="Brand Friction Audit"]')).toBeAttached();
});

test(
  "with no video link the card is a still with nothing to press",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    await expect(hero(page, 1).getByRole("button", { name: /Play video/ })).toHaveCount(0);
    await expect(hero(page, 1).getByRole("img", { name: "Brand Friction Audit" })).toBeVisible();
  },
);
