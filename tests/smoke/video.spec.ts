import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// The shared Video component (P1-74): a self-hosted Prismic file first, Vimeo
// as the fallback when no file is set and when the file fails. Exercised on
// /dev/video-fixture, where each `section[data-case]` is one branch, and on
// the a11y fixtures' self-hosted OfferHero. What is asserted is what a
// visitor's browser does: which file it chose, whether it plays, and which
// player is on the page.

const CLIP = readFileSync(new URL("../fixtures/clip.mp4", import.meta.url));
const SELF_HOSTED = 'video[data-video="self-hosted"]';
const VIMEO = 'iframe[src*="player.vimeo.com"], iframe[title]';

const VTT = "WEBVTT\n\n00:00.000 --> 00:01.000\nFixture caption\n";

/** Answer every Prismic media url as its CDN does (with CORS: a player is
 *  crossorigin="anonymous" for its captions): a `dead-` name 404s, a `.vtt`
 *  is a caption file, anything else is the fixture clip. Vimeo never loads.
 *  Returns the urls the browser asked for. */
async function serveMedia(page: Page) {
  const asked: string[] = [];
  const headers = { "access-control-allow-origin": "*" };
  await page.route("https://reddoor-la.cdn.prismic.io/**", (route) => {
    const url = route.request().url();
    asked.push(url);
    if (url.includes("/dead-")) return route.fulfill({ status: 404, headers, body: "" });
    if (url.endsWith(".vtt"))
      return route.fulfill({ status: 200, headers, contentType: "text/vtt", body: VTT });
    return route.fulfill({ status: 200, headers, contentType: "video/mp4", body: CLIP });
  });
  await page.route("https://player.vimeo.com/**", (route) => route.abort());
  return asked;
}

async function gotoFixture(page: Page) {
  const asked = await serveMedia(page);
  await page.goto("/dev/video-fixture", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
  return asked;
}

const kase = (page: Page, id: string) => page.locator(`section[data-case="${id}"]`);
const isPaused = (page: Page, id: string) =>
  kase(page, id)
    .locator("video")
    .evaluate((v: HTMLVideoElement) => v.paused);
const allowMotion = (page: Page) => page.emulateMedia({ reducedMotion: "no-preference" });

test(
  "a self-hosted background video plays its file, and no Vimeo player is on the page",
  { tag: "@smoke" },
  async ({ page }) => {
    await allowMotion(page);
    await gotoFixture(page);
    const video = kase(page, "bg-hosted").locator(SELF_HOSTED);
    await expect(video).toBeAttached();
    await expect.poll(() => isPaused(page, "bg-hosted")).toBe(false);
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/bg-1080\.mp4$/);
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
    await expect(kase(page, "bg-hosted").locator("iframe")).toHaveCount(0);
  },
);

test("a phone gets the 720p phone file", { tag: "@smoke" }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await allowMotion(page);
  await gotoFixture(page);
  const video = kase(page, "bg-hosted").locator(SELF_HOSTED);
  await expect.poll(() => isPaused(page, "bg-hosted")).toBe(false);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/bg-phone-720\.mp4$/);
});

test(
  "with no file set, both modes render the Vimeo embed instead",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoFixture(page);
    for (const id of ["bg-empty", "player-empty"]) {
      await expect(kase(page, id).locator("video")).toHaveCount(0);
      await expect(kase(page, id).locator("iframe")).toHaveCount(1);
    }
    // The player embed is eager; its src names the fallback video.
    await expect(kase(page, "player-empty").locator("iframe")).toHaveAttribute(
      "src",
      /player\.vimeo\.com\/video\/76979871/,
    );
  },
);

test(
  "a file that fails to load hands over to the Vimeo embed, in both modes",
  { tag: "@smoke" },
  async ({ page }) => {
    await allowMotion(page);
    await gotoFixture(page);
    // The player fetches metadata at once; the background asks when it plays.
    for (const id of ["player-dead", "bg-dead"]) {
      await expect(kase(page, id).locator("video")).toHaveCount(0, { timeout: 15_000 });
      await expect(kase(page, id).locator("iframe")).toHaveCount(1);
    }
    await expect(kase(page, "player-dead").locator("iframe")).toHaveAttribute(
      "src",
      /player\.vimeo\.com\/video\/76979871/,
    );
  },
);

test(
  "a background video waits off screen, plays near the viewport, and a visitor's pause sticks",
  { tag: "@smoke" },
  async ({ page }) => {
    await allowMotion(page);
    const asked = await gotoFixture(page);
    const far = kase(page, "bg-far");
    await expect.poll(() => isPaused(page, "bg-hosted")).toBe(false);
    // Two screens down: not playing, and not even fetched.
    expect(await isPaused(page, "bg-far")).toBe(true);
    expect(asked.some((u) => u.includes("far-1080"))).toBe(false);

    await far.scrollIntoViewIfNeeded();
    await expect.poll(() => isPaused(page, "bg-far")).toBe(false);

    await far.getByRole("button", { name: "Pause background video" }).click();
    await expect.poll(() => isPaused(page, "bg-far")).toBe(true);
    await expect(far.getByRole("button", { name: "Play background video" })).toBeVisible();

    // Away and back: the visitor's pause holds.
    await page.evaluate(() => window.scrollTo(0, 0));
    await far.scrollIntoViewIfNeeded();
    await expect(far.getByRole("button", { name: "Play background video" })).toBeVisible();
    expect(await isPaused(page, "bg-far")).toBe(true);

    await far.getByRole("button", { name: "Play background video" }).click();
    await expect.poll(() => isPaused(page, "bg-far")).toBe(false);
  },
);

test("under Reduce Motion a background video never starts", { tag: "@smoke" }, async ({ page }) => {
  const asked = await gotoFixture(page);
  // Wait for the component's own decision, so the checks below cannot pass
  // merely by running before it made one.
  await expect(kase(page, "bg-hosted").locator(SELF_HOSTED)).toHaveAttribute(
    "data-state",
    "reduced",
  );
  await expect(kase(page, "bg-hosted").getByRole("button")).toHaveCount(0);
  expect(await isPaused(page, "bg-hosted")).toBe(true);
  expect(asked.some((u) => u.includes("bg-1080"))).toBe(false);
});

test(
  "a phone file with no 1080p file plays at desktop width too",
  { tag: "@smoke" },
  async ({ page }) => {
    await allowMotion(page);
    await gotoFixture(page);
    const video = kase(page, "bg-phone-only").locator(SELF_HOSTED);
    await kase(page, "bg-phone-only").scrollIntoViewIfNeeded();
    await expect.poll(() => isPaused(page, "bg-phone-only")).toBe(false);
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
      /only-phone-720\.mp4$/,
    );
  },
);

test(
  "a self-hosted player waits for the visitor, is named, and shows its captions",
  { tag: "@smoke" },
  async ({ page }) => {
    await gotoFixture(page);
    const video = kase(page, "player-hosted").locator(SELF_HOSTED);
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("controls", "");
    await expect(video).toHaveAttribute("aria-label", "Fixture player-hosted");
    await expect(video).toHaveAttribute("preload", "metadata");
    // Its own poster, set once it is near: frame 0 would cover any still.
    await expect(video).toHaveAttribute("poster", /pl-poster\.png/);
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await expect
      .poll(() =>
        video.evaluate((v: HTMLVideoElement) => {
          const t = v.textTracks[0];
          return t ? `${t.kind}:${t.mode}` : "none";
        }),
      )
      .toBe("captions:showing");
  },
);

test(
  "a video in a linked card is not inside the link, and its controls do not follow it",
  { tag: "@smoke" },
  async ({ page }) => {
    await allowMotion(page);
    await gotoFixture(page);
    const cards = page.locator('[data-case="linked-cards"]');
    const videos = cards.locator(SELF_HOSTED);
    await expect(videos).toHaveCount(2);
    expect(await cards.locator(`a ${SELF_HOSTED}, a button`).count()).toBe(0);
    // The link is still there, on the card's label.
    await expect(cards.getByRole("link", { name: "Linked player" })).toHaveAttribute(
      "href",
      "/linked-target",
    );

    // That structure is the guard: a URL check straight after a click
    // cannot see a client-side navigation that has not happened yet. The
    // button is still reachable and named for its card.
    await expect(
      cards.getByRole("button", { name: /background video: Linked loop/ }),
    ).toBeVisible();
  },
);

test(
  "a dead offer file with no Vimeo behind it goes back to the poster, focus on its button",
  { tag: "@smoke" },
  async ({ page }) => {
    const asked = await serveMedia(page);
    await page.goto("/dev/a11y-fixtures", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
    const hero = page.locator('section[data-slice-type="offer_hero"]').nth(3);
    const play = hero.getByRole("button", { name: "Play video: Brand Friction Audit" });
    await play.click();
    await expect(hero.locator("video")).toHaveCount(0, { timeout: 15_000 });
    await expect(hero.locator("iframe")).toHaveCount(0);
    // A player did mount and ask for the file, so the button is a new one.
    expect(asked.some((u) => u.includes("dead-offer-1080.mp4"))).toBe(true);
    await expect(play).toBeFocused();
  },
);

test(
  "the self-hosted offer video plays from its file and ends on its poster",
  { tag: "@smoke" },
  async ({ page }) => {
    await serveMedia(page);
    await page.goto("/dev/a11y-fixtures", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
    const hero = page.locator('section[data-slice-type="offer_hero"]').nth(2);
    await hero.getByRole("button", { name: "Play video: Brand Friction Audit" }).click();

    const video = hero.locator(SELF_HOSTED);
    await expect(video).toBeFocused();
    expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
      /fixture-offer-1080\.mp4$/,
    );
    await expect(hero.locator(VIMEO)).toHaveCount(0);

    // The fixture clip is 1.5 s: at its end the card is its poster and play
    // button again, with focus back on the button.
    const again = hero.getByRole("button", { name: "Play video: Brand Friction Audit" });
    await expect(again).toBeVisible({ timeout: 15_000 });
    await expect(again).toBeFocused();
    await expect(hero.locator("video")).toHaveCount(0);
  },
);
