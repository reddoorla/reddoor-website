import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The report URL *is* the credential, so it must not leak through the two
 * channels that read it automatically: analytics (which reads
 * `location.href`) and the Referer header.
 *
 * These assert against `app.html` as text because that script is a bare inline
 * IIFE with no module boundary — there is nothing to import. Coarse, but it
 * pins the two properties that matter, and the alternative is no coverage at
 * all on the one file that can leak a token to a third party.
 */
const APP_HTML = readFileSync("src/app.html", "utf-8");

describe("analytics must not see a credential-bearing URL", () => {
  it("knows /audit/ is a credential path", () => {
    expect(APP_HTML).toMatch(/CREDENTIAL_PATHS\s*=\s*\[[^\]]*"\/audit\/"/);
  });

  it("checks before loading gtag, not merely before registering the listeners", () => {
    // The guard has to sit inside loadGA. Registration-time checking would
    // evaluate the path once on a page that may not be the report yet.
    const loadGA = APP_HTML.slice(APP_HTML.indexOf("function loadGA()"));
    const body = loadGA.slice(0, loadGA.indexOf("\n        }"));
    expect(body).toContain("urlIsSecret()");
    expect(body.indexOf("urlIsSecret()")).toBeLessThan(body.indexOf("googletagmanager"));
  });

  // The subtle half. This is a SPA: a reader can navigate from a report to an
  // ordinary page in the same document. If the bail latched `loaded` or removed
  // the listeners, analytics would stay dead for the rest of the session.
  it("bails WITHOUT latching, so analytics still starts if they navigate onward", () => {
    const loadGA = APP_HTML.slice(APP_HTML.indexOf("function loadGA()"));
    const guard = loadGA.slice(loadGA.indexOf("urlIsSecret()"));
    const bail = guard.slice(0, guard.indexOf("\n"));
    expect(bail).toContain("return");
    expect(bail).not.toContain("loaded = true");
  });

  it("matches by prefix, so /audit/{token}/print is covered too", () => {
    const fn = APP_HTML.slice(APP_HTML.indexOf("function urlIsSecret()"));
    expect(fn.slice(0, 220)).toContain("indexOf(p) === 0");
  });
});

describe("the Referer header must not carry the token either", () => {
  it("the shared loader returns no-referrer for both routes", async () => {
    const src = readFileSync("src/lib/report/load.ts", "utf-8");
    expect(src).toContain('meta_referrer: "no-referrer"');
  });

  it("the root layout renders it", () => {
    const layout = readFileSync("src/routes/+layout.svelte", "utf-8");
    expect(layout).toContain('<meta name="referrer" content={page.data.meta_referrer} />');
  });
});
