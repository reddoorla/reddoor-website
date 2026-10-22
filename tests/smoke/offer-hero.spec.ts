import { test, expect } from "@playwright/test";
import { MIN_FILL_MS } from "@reddoorla/maintenance/forms";

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
/** Room for the modal's pre-submit hold (2.5s) plus a slow runner. */
const HOLD_TIMEOUT = 15_000;

/** Step one went up with this address, and late enough that the server's bot
 *  screen (MIN_FILL_MS after `ts`) forwards it instead of dropping it. */
function expectStepOne(posts: Post[], email: string) {
  expect(posts).toHaveLength(1);
  expect(posts[0].body.email).toBe(email);
  expect(posts[0].receivedAt - Number(posts[0].body.ts)).toBeGreaterThanOrEqual(MIN_FILL_MS);
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
    ).toBeVisible({ timeout: HOLD_TIMEOUT });
    expectStepOne(posts, "founder@example.com");
    expect(page.url()).toBe(before);
  },
);

test("Enter in the email field opens on question one too", { tag: "@smoke" }, async ({ page }) => {
  const posts = await gotoHydrated(page);
  const field = hero(page).getByRole("textbox", { name: "Email address" });
  await field.fill("founder@example.com");
  await field.press("Enter");
  await expect(page.getByRole("dialog").getByRole("heading", { name: FIRST_QUESTION })).toBeVisible(
    { timeout: HOLD_TIMEOUT },
  );
  expectStepOne(posts, "founder@example.com");
});

test(
  "closing during the send and pressing Get Started again files exactly one lead",
  { tag: "@smoke" },
  async ({ page }) => {
    const posts = await gotoHydrated(page);
    await hero(page).getByRole("textbox", { name: "Email address" }).fill("founder@example.com");
    const getStarted = hero(page).getByRole("button", { name: "Get Started" });
    await getStarted.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Closed while step one is still being held for the bot screen: that
    // send is abandoned, so the reopen has to make it.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(posts, "Escape must land inside the pre-submit hold").toHaveLength(0);
    await getStarted.click();
    await expect(dialog.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible({
      timeout: HOLD_TIMEOUT,
    });
    expectStepOne(posts, "founder@example.com");
    // Once it is in, coming back resumes mid-questions rather than sending
    // it again.
    await page.keyboard.press("Escape");
    await getStarted.click();
    await expect(dialog.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
    expect(posts).toHaveLength(1);
  },
);

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
    ).toBeVisible({ timeout: HOLD_TIMEOUT });
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
    // An auto-submit marks the button busy the moment it starts (before its
    // hold), so an idle Inquire Now proves none began.
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Inquire Now" }),
    ).not.toHaveAttribute("aria-busy", "true");
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
    // An auto-submit marks the button busy the moment it starts (before its
    // hold), so an idle Inquire Now proves none began.
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Inquire Now" }),
    ).not.toHaveAttribute("aria-busy", "true");
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

// A stand-in for Vimeo's player, served from its origin: it says `ready`, and
// `window.finish()` posts `ended` only if the page subscribed to it, as the
// real player does.
const FAKE_PLAYER = `<!doctype html><body><script>
  const subscribed = new Set();
  addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "addEventListener") subscribed.add(m.value);
  });
  window.finish = () => {
    if (!subscribed.has("ended")) return false;
    parent.postMessage(JSON.stringify({ event: "ended", data: { seconds: 269 } }), "*");
    return true;
  };
  parent.postMessage(JSON.stringify({ event: "ready" }), "*");
</script></body>`;

/** Plays the hero's video in the stand-in player and plays it to its end. */
async function playToEnd(page: import("@playwright/test").Page, beforeEnd?: () => Promise<void>) {
  await page.route("https://player.vimeo.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: FAKE_PLAYER }),
  );
  await hero(page).getByRole("button", { name: "Play video: Brand Friction Audit" }).click();
  const player = hero(page).locator('iframe[title="Brand Friction Audit"]');
  await expect(player).toBeAttached();
  await beforeEnd?.();

  // Vimeo's end screen would fill the frame from here; the page has to have
  // asked to hear about the end, and has to take the player down when it does.
  const frame = player.contentFrame();
  await expect
    .poll(() =>
      frame
        .locator("body")
        .evaluate(() => (window as unknown as { finish(): boolean }).finish())
        .catch(() => false),
    )
    .toBe(true);
  await expect(player).toHaveCount(0);
}

test(
  "at the video's end the card is its poster and play button again, with focus on the button",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    await playToEnd(page);
    await expect(
      hero(page).getByRole("button", { name: "Play video: Brand Friction Audit" }),
    ).toBeFocused();
  },
);

test(
  "the video ending does not take focus from a visitor typing elsewhere",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    const field = hero(page).getByRole("textbox", { name: "Email address" });
    await playToEnd(page, async () => {
      await field.fill("founder@exa");
    });
    await expect(hero(page).getByRole("button", { name: /Play video/ })).toBeVisible();
    await expect(field).toBeFocused();
  },
);

test(
  "the video ending does not scroll a visitor who has scrolled on",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoHydrated(page);
    // The fixture page's last link, two tall heroes below the video's card.
    const below = page.getByRole("link", { name: "Open inquiry with no step attribute" });
    // Scrolling leaves focus in the player, so this is the case where focus
    // does go back to the play button; it must not take the page with it.
    await playToEnd(page, async () => {
      await below.scrollIntoViewIfNeeded();
    });
    await expect(
      hero(page).getByRole("button", { name: "Play video: Brand Friction Audit" }),
    ).toBeFocused();
    await expect(below).toBeInViewport();
  },
);
