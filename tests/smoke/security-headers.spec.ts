import { test, expect, type Page } from "@playwright/test";

// SSR responses used to ship with NO custom headers, because Netlify attaches
// [[headers]] only to statically served files. That left the 404 page and
// /contact — the site's only form, and the one page embedding a Turnstile
// widget — as the two least protected pages on the site. hooks.server.ts fixes
// it; these tests are the proof, and the reason we could enforce rather than
// ship a Report-Only policy to a collector nobody reads.
//
// Note on scope: under `vite dev` nothing is prerendered, so the hook runs for
// every route here. In production the prerendered pages get the identical
// values from netlify.toml instead — headers.test.ts pins the two together.

const EXPECTED: Record<string, string | RegExp> = {
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": /max-age=31536000/,
  "permissions-policy": /geolocation=\(\)/,
};

/** Collect CSP violations the way the browser reports them, not from console text. */
async function watchCsp(page: Page) {
  const violations: string[] = [];
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} blocked ${e.blockedURI}`,
      );
    });
  });
  return {
    async read() {
      const found = await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp ?? [],
      );
      violations.push(...found);
      return violations;
    },
  };
}

test("the SSR form page carries the full header set", async ({ page }) => {
  const res = await page.goto("/contact");
  expect(res?.status()).toBe(200);
  const headers = res!.headers();
  for (const [name, want] of Object.entries(EXPECTED)) {
    if (want instanceof RegExp) expect(headers[name], name).toMatch(want);
    else expect(headers[name], name).toBe(want);
  }
  expect(headers["content-security-policy"], "CSP").toContain("default-src 'self'");
});

test("enforcing the policy does not break Turnstile or the type", async ({ page }) => {
  // The reason this can be enforced instead of report-only. If the policy were
  // too tight for the bot screen or the Typekit @import, it shows up here —
  // rather than as a form nobody can submit, or a page in system sans-serif.
  const csp = await watchCsp(page);
  await page.goto("/contact", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html[data-hydrated]")).toBeAttached({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await csp.read()).toEqual([]);
});

test("the 404 page is protected too", async ({ page }) => {
  // Also SSR, also previously bare. A 404 is the page an attacker reaches most
  // easily, by definition.
  const res = await page.goto("/definitely-not-a-real-page-xyz");
  expect(res?.status()).toBe(404);
  const headers = res!.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
});

test("API responses are hardened but carry no CSP", async ({ request }) => {
  const res = await request.get("/api/slots");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["content-security-policy"]).toBeUndefined();
});

test("a credential-bearing page keeps its own stricter referrer policy", async ({ page }) => {
  // The hook must not overwrite what a route already set. These URLs carry an
  // appointment id, which is a bearer token — downgrading them to the site
  // default would leak it in the Referer of everything they link to.
  const res = await page.goto("/reschedule/AAAAAAAAAAAA");
  expect(res?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});
