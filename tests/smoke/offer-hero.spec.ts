import { test, expect } from "@playwright/test";

// The offer landing page's hero (/brand-friction-audit, the `offer_hero`
// slice), exercised on /dev/a11y-fixtures: the document sits in an unpublished
// Prismic release, so the real page has nothing to render in CI. What is
// asserted is what a visitor meets — the page's h1, the email CTA sending step
// one with their address and opening on question one, and the video's name.
const PATH = "/dev/a11y-fixtures";

type Post = { body: Record<string, unknown>; receivedAt: number };

async function gotoHydrated(page: import("@playwright/test").Page) {
  // Nothing here should reach Vimeo or the CRM. Step-one posts are recorded,
  // with when they arrived, so a test can see what the CRM would have got.
  const posts: Post[] = [];
  await page.route("https://player.vimeo.com/**", (route) => route.abort());
  await page.route("**/api/inquiry", (route) => {
    posts.push({ body: JSON.parse(route.request().postData() ?? "{}"), receivedAt: Date.now() });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"success":true}',
    });
  });
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
  return posts;
}

const hero = (page: import("@playwright/test").Page, n = 0) =>
  page.locator('section[data-slice-type="offer_hero"]').nth(n);

const FIRST_QUESTION = /What problems are you experiencing\?/;

/** Step one went up with this address, and late enough that the server's bot
 *  screen (MIN_FILL_MS, 800ms after `ts`) forwards it instead of dropping it. */
function expectStepOne(posts: Post[], email: string) {
  expect(posts).toHaveLength(1);
  expect(posts[0].body.email).toBe(email);
  expect(posts[0].receivedAt - Number(posts[0].body.ts)).toBeGreaterThanOrEqual(800);
}

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
  "Get Started with an email sends step one and opens on question one, without navigating",
  { tag: "@smoke" },
  async ({ page }) => {
    const posts = await gotoHydrated(page);
    const before = page.url();
    await hero(page).getByRole("textbox", { name: "Email address" }).fill("founder@example.com");
    await hero(page).getByRole("button", { name: "Get Started" }).click();

    await expect(
      page.getByRole("dialog").getByRole("heading", { name: FIRST_QUESTION }),
    ).toBeVisible();
    expectStepOne(posts, "founder@example.com");
    expect(page.url()).toBe(before);
  },
);

test("Enter in the email field opens on question one too", { tag: "@smoke" }, async ({ page }) => {
  const posts = await gotoHydrated(page);
  const field = hero(page).getByRole("textbox", { name: "Email address" });
  await field.fill("founder@example.com");
  await field.press("Enter");
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: FIRST_QUESTION }),
  ).toBeVisible();
  expectStepOne(posts, "founder@example.com");
});

test(
  "Shift+Enter in the email field stays on the page too",
  { tag: "@smoke" },
  async ({ page }) => {
    const posts = await gotoHydrated(page);
    const field = hero(page).getByRole("textbox", { name: "Email address" });
    await field.fill("founder@example.com");
    await field.press("Shift+Enter");
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: FIRST_QUESTION }),
    ).toBeVisible();
    expectStepOne(posts, "founder@example.com");
  },
);

test(
  "an empty field opens the email step, empty, and sends nothing",
  { tag: "@smoke" },
  async ({ page }) => {
    const posts = await gotoHydrated(page);
    await hero(page).getByRole("button", { name: "Get Started" }).click();
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Email address" }),
    ).toHaveValue("");
    expect(posts).toHaveLength(0);
  },
);

test(
  "an invalid address opens the email step with it, and sends nothing",
  { tag: "@smoke" },
  async ({ page }) => {
    const posts = await gotoHydrated(page);
    await hero(page).getByRole("textbox", { name: "Email address" }).fill("founder@");
    await hero(page).getByRole("button", { name: "Get Started" }).click();
    await expect(
      page.getByRole("dialog").getByRole("textbox", { name: "Email address" }),
    ).toHaveValue("founder@");
    expect(posts).toHaveLength(0);
  },
);

test("the video is named, and its player keeps the name", { tag: "@smoke" }, async ({ page }) => {
  await gotoHydrated(page);
  const play = hero(page).getByRole("button", { name: "Play video: Brand Friction Audit" });
  await expect(play).toBeVisible();
  // By keyboard: the button unmounts as the player mounts, and focus has to
  // land on the player rather than drop to <body>.
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(hero(page).locator('iframe[title="Brand Friction Audit"]')).toBeFocused();
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
