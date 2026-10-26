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

/** Answer every Prismic media url: a `dead-` name 404s, anything else is the
 *  fixture clip. Vimeo never loads. Returns the urls the browser asked for. */
async function serveMedia(page: Page) {
  const asked: string[] = [];
  await page.route("https://reddoor-la.cdn.prismic.io/**", (route) => {
    const url = route.request().url();
    asked.push(url);
    if (url.includes("/dead-")) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "video/mp4", body: CLIP });
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
  await gotoFixture(page);
  await expect(kase(page, "bg-hosted").locator(SELF_HOSTED)).toBeAttached();
  await expect(kase(page, "bg-hosted").getByRole("button")).toHaveCount(0);
  expect(await isPaused(page, "bg-hosted")).toBe(true);
});

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
