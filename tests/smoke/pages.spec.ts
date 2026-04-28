import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Console messages we don't care about. Add patterns here only after seeing
// them in CI and confirming they aren't actionable.
const ALLOWED_CONSOLE_PATTERNS: RegExp[] = [
  // Vimeo iframe embeds emit cross-origin / autoplay warnings we can't control.
  /vimeo/i,
  // Turnstile (Cloudflare) telemetry occasionally surfaces in console.
  /turnstile|challenges\.cloudflare/i,
];

function attachConsoleWatcher(page: Page, extraAllowed: RegExp[] = []) {
  const errors: string[] = [];
  const allowed = [...ALLOWED_CONSOLE_PATTERNS, ...extraAllowed];
  const isAllowed = (text: string) => allowed.some((re) => re.test(text));

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isAllowed(text)) return;
    errors.push(`[console.error] ${text}`);
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
