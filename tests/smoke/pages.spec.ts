import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Console messages we don't care about. Add patterns here only after seeing
// them in CI and confirming they aren't actionable. Patterns are matched
// against both the message text and the offending resource URL — Chromium's
// "Failed to load resource" text omits the URL, so URL matching is what
// actually catches third-party network noise.
const ALLOWED_CONSOLE_PATTERNS: RegExp[] = [
  // Vimeo iframe embeds + their CDN telemetry endpoints (lensflare, arclight,
  // i.vimeocdn) occasionally 403 from cloud IPs due to bot detection.
  /vimeo/i,
  // Turnstile (Cloudflare) telemetry occasionally surfaces in console.
  /turnstile|challenges\.cloudflare/i,
  // Font Awesome kit script injects icon SVGs at runtime; nothing we ship.
  /fontawesome/i,
  // Font Awesome's injected SVGs sometimes carry an invalid preserveAspectRatio
  // value ("xMinYMin none") — Chromium logs a parser error attributed to the
  // page itself (no URL), so this has to be matched on text.
  /<svg> attribute preserveAspectRatio: Trailing garbage/,
];

function attachConsoleWatcher(page: Page, extraAllowed: RegExp[] = []) {
  const errors: string[] = [];
  const allowed = [...ALLOWED_CONSOLE_PATTERNS, ...extraAllowed];
  const isAllowed = (s: string) => !!s && allowed.some((re) => re.test(s));

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const url = msg.location()?.url ?? "";
    if (isAllowed(text) || isAllowed(url)) return;
    errors.push(`[console.error] ${text}${url ? ` (${url})` : ""}`);
  });

  page.on("pageerror", (err) => {
    if (isAllowed(err.message)) return;
    errors.push(`[pageerror] ${err.message}`);
  });

  return errors;
}

const ROUTES = ["/", "/about", "/portfolio", "/twenty-for-twenty", "/contact"];

for (const path of ROUTES) {
  test(`${path} loads with no console errors`, async ({ page }) => {
    const errors = attachConsoleWatcher(page);
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP status for ${path}`).toBe(200);
    // Wait for hydration markers — the layout footer is shared across pages.
    await expect(page.locator("footer")).toBeVisible();
    expect(errors, `console errors on ${path}`).toEqual([]);
  });
}

test("portfolio detail page loads with no console errors", async ({ page }) => {
  const errors = attachConsoleWatcher(page);
  await page.goto("/portfolio", { waitUntil: "domcontentloaded" });
  const firstProjectHref = await page
    .locator('a[href^="/portfolio/"]')
    .evaluateAll((els) =>
      els
        .map((el) => (el as HTMLAnchorElement).getAttribute("href"))
        .find((href) => href && href !== "/portfolio" && !href.includes("#")),
    );
  expect(firstProjectHref, "found a portfolio detail link").toBeTruthy();

  const response = await page.goto(firstProjectHref!, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status(), `HTTP status for ${firstProjectHref}`).toBe(200);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(errors, `console errors on ${firstProjectHref}`).toEqual([]);
});

test("404 page renders the custom error component", async ({ page }) => {
  // The browser logs a top-level "Failed to load resource: 404" for the page
  // itself — that's expected on a 404 route, not a bug. Allow it locally.
  const errors = attachConsoleWatcher(page, [/Failed to load resource.*404/i]);
  const response = await page.goto("/portfolio/this-uid-does-not-exist", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);
  // Our +error.svelte renders a giant "404" headline.
  await expect(page.getByText("404", { exact: false }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("/twenty-for-twenty supports anchor links to specific cards", async ({ page }) => {
  const errors = attachConsoleWatcher(page);

  // Inbound: hash by number only should jump into the card stack.
  await page.goto("/twenty-for-twenty#02", { waitUntil: "domcontentloaded" });
  await expect(page.locator("footer")).toBeVisible();
  // Wait for the page's $effect to fire resolveHashToScroll on mount.
  await page.waitForFunction(() => window.scrollY > 100, { timeout: 5000 }).catch(() => {});

  const viewportHeight = page.viewportSize()?.height ?? 720;
  const scrollY1 = await page.evaluate(() => window.scrollY);
  expect(scrollY1, "card-2 hash should produce non-zero scroll").toBeGreaterThan(100);

  // Outbound: scroll 1 viewport further into the card stack — hash should
  // advance to a card number higher than 2.
  await page.evaluate((dy) => window.scrollBy(0, dy), viewportHeight);
  // Give the scroll handler a moment to fire replaceState.
  await page.waitForTimeout(200);
  const hashAfter = await page.evaluate(() => location.hash);
  const matchAfter = hashAfter.match(/^#(\d+)/);
  expect(matchAfter, `hash "${hashAfter}" should match #NN…`).not.toBeNull();
  expect(Number(matchAfter![1]), "hash should advance past card 2").toBeGreaterThan(2);

  // Bogus hash should not throw and should not scroll to a card position.
  // Navigate away first so the next goto is a full inbound navigation, then
  // come back with the bogus hash.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.goto("/twenty-for-twenty#99-nonexistent", {
    waitUntil: "domcontentloaded",
  });
  const scrollY2 = await page.evaluate(() => window.scrollY);
  expect(scrollY2, "bogus hash should leave page at top").toBeLessThan(50);

  expect(errors, "console errors on /twenty-for-twenty").toEqual([]);
});
