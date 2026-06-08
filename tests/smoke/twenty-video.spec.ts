import { test, expect } from "@playwright/test";

// Behaviour added when fixing the "20 for 20" background video not running on
// iPad: the cross-origin Vimeo iframe now (1) carries the autoplay permission
// it was missing, and (2) is layered over a static fallback frame that stays
// visible whenever playback never starts (Low Power Mode, blocked autoplay).

const FALLBACK = "img[alt='Hand-drawn sketch of the number 20']";
const IFRAME = "iframe[title='20 for 20 animated sketch']";

test("Vimeo iframe is granted autoplay permission", async ({ page }) => {
  await page.goto("/twenty-for-twenty", { waitUntil: "domcontentloaded" });
  const iframe = page.locator(IFRAME);
  await expect(iframe).toBeAttached();

  // The original bug: a cross-origin iframe is denied autoplay by Permissions
  // Policy unless explicitly granted. WebKit (iPad) enforces this strictly.
  await expect(iframe).toHaveAttribute("allow", /autoplay/);
  await expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
});

test("fallback sketch stays visible when the video cannot play (iPad case)", async ({ page }) => {
  // Simulate an environment where the Vimeo player never starts — same observable
  // outcome as iPad Low Power Mode / a blocked autoplay: no play event arrives.
  await page.route(/player\.vimeo\.com/, (route) => route.abort());

  await page.goto("/twenty-for-twenty", { waitUntil: "domcontentloaded" });

  const fallback = page.locator(FALLBACK);
  const iframe = page.locator(IFRAME);
  await expect(fallback).toBeAttached();

  // Fallback frame is served locally (bundled import), so it survives the block.
  await expect(fallback).toHaveCSS("opacity", "0.9");
  // …and the never-playing video stays hidden rather than showing a blank box.
  await expect(iframe).toHaveCSS("opacity", "0");
});

test("video reveals itself once it actually plays", async ({ page }) => {
  await page.goto("/twenty-for-twenty", { waitUntil: "domcontentloaded" });

  const fallback = page.locator(FALLBACK);
  const iframe = page.locator(IFRAME);

  // When the Vimeo player reports playback over its postMessage API, the iframe
  // crossfades in (opacity 0.9) and the static fallback fades out (opacity 0).
  await expect(iframe).toHaveCSS("opacity", "0.9", { timeout: 20000 });
  await expect(fallback).toHaveCSS("opacity", "0");
});
