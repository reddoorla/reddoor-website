import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SITE_URL } from "./site";

/**
 * Analytics measures production, and nothing else.
 *
 * `app.html` is one file shipped to every environment, so the tag it carries
 * runs under `vite dev`, on every Netlify deploy preview and on staging as
 * readily as on the live site. It loads on the first pointer/key/scroll, which
 * is exactly what the Playwright smoke suite does — so for the 30 days to
 * 2026-09-14 GA4 counted 16,072 users on this property, 15,971 of them on
 * `localhost`, and the maintenance report mailed that out as a 510% rise.
 * Real traffic over the same window was 87, and falling.
 *
 * Asserted against the file as text for the reason token-privacy.test.ts
 * gives: the script is a bare inline IIFE with nothing to import.
 */
const APP_HTML = readFileSync("src/app.html", "utf-8");

const measuredHosts = (): string[] => {
  const list = APP_HTML.match(/var MEASURED_HOSTS = \[([^\]]*)\]/)?.[1] ?? "";
  return [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
};

describe("the analytics tag only loads on the production host", () => {
  it("measures the canonical origin, so the tag and $lib/site.ts cannot drift", () => {
    expect(measuredHosts()).toContain(new URL(SITE_URL).hostname);
  });

  it("measures nothing else — not a laptop, a preview or staging", () => {
    for (const host of measuredHosts()) {
      expect(host).not.toMatch(/localhost|127\.0\.0\.1|netlify\.app|^staging\./);
    }
  });

  it("checks the host before it fetches gtag.js", () => {
    const loadGA = APP_HTML.slice(APP_HTML.indexOf("function loadGA()"));
    const body = loadGA.slice(0, loadGA.indexOf("\n        }"));
    expect(body).toContain("hostIsMeasured()");
    expect(body.indexOf("hostIsMeasured()")).toBeLessThan(body.indexOf("googletagmanager"));
  });

  it("matches a whole hostname, so a subdomain of production cannot slip in", () => {
    // `staging.reddoorla.com` ends with the production domain. A suffix test
    // would measure it; list membership will not.
    const fn = APP_HTML.slice(APP_HTML.indexOf("function hostIsMeasured()"));
    const body = fn.slice(0, fn.indexOf("\n        }"));
    expect(body).toContain("MEASURED_HOSTS.indexOf(location.hostname) !== -1");
    expect(body).not.toMatch(/endsWith|slice|substring/);
  });
});
