import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { SITE_URL } from "./site";

/**
 * Analytics measures production, and nothing else — and never a URL that is
 * itself a credential.
 *
 * `app.html` is one file shipped to every environment, so the tag it carries
 * runs under `vite dev`, on every Netlify deploy preview and on staging as
 * readily as on the live site. It loads on the first pointer/key/scroll, which
 * is exactly what the Playwright smoke suite does — so for the 30 days to
 * 2026-09-14 GA4 counted 16,072 users on this property, 15,971 of them on
 * `localhost`, and the maintenance report mailed that out as a 510% rise.
 * Real traffic over the same window was 87, and falling.
 *
 * A report URL *is* its credential, and gtag reads `location.href`, so the tag
 * must also stay away from `/audit/`. (The other channel that reads the URL
 * automatically, the Referer header, is covered by load.test.ts and the smoke
 * suite's `meta[name="referrer"]` checks.)
 *
 * The tag is an inline script with nothing to import, so these run app.html's
 * inline scripts in a vm against a stub of the few browser globals they touch,
 * and observe what a browser would: whether gtag.js gets requested.
 */
const INLINE_SCRIPTS = [
  ...readFileSync("src/app.html", "utf-8").matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g,
  ),
]
  .map((m) => m[1]!)
  .filter((s) => s.includes("googletagmanager"));

type Listener = { type: string; fn: () => void };

function open(href: string) {
  const url = new URL(href);
  const location = { hostname: url.hostname, pathname: url.pathname };
  const listeners: Listener[] = [];
  const requested: string[] = [];
  const window = {
    location,
    document: {
      createElement: () => ({}),
      head: { appendChild: (el: { src?: string }) => requested.push(el.src ?? "") },
    },
    addEventListener: (type: string, fn: () => void) => listeners.push({ type, fn }),
    removeEventListener: (type: string, fn: () => void) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i !== -1) listeners.splice(i, 1);
    },
  };
  // In a browser `window` is the global object, so it is the vm's global too.
  const context = createContext(Object.assign(window, { window }));
  for (const script of INLINE_SCRIPTS) runInContext(script, context);

  return {
    /** A client-side navigation: same document, same listeners, new path. */
    navigate: (pathname: string) => {
      location.pathname = pathname;
    },
    pointerdown: () => {
      for (const l of listeners.filter((l) => l.type === "pointerdown")) l.fn();
    },
    loadsGA: () =>
      requested.some((src) => new URL(src, url).hostname.endsWith("googletagmanager.com")),
  };
}

describe("the analytics tag only loads on the production host", () => {
  it("measures the canonical origin ($lib/site.ts) on the first interaction, and not before", () => {
    // Not before: $lib/url/stripQueryParams.ts relies on that ordering to get a
    // lead's address out of the URL before gtag can read it.
    const page = open(SITE_URL);
    expect(page.loadsGA()).toBe(false);
    page.pointerdown();
    expect(page.loadsGA()).toBe(true);
  });

  it("measures nothing else — not a laptop, a preview, staging or a lookalike", () => {
    // `staging.reddoorla.com` and `evilreddoorla.com` both end with the
    // production domain; a suffix test would measure them.
    for (const href of [
      "http://localhost:5173/",
      "http://127.0.0.1:4173/",
      "https://deploy-preview-1--reddoorla.netlify.app/",
      "https://staging--reddoorla.netlify.app/",
      "https://reddoorla.netlify.app/",
      "https://staging.reddoorla.com/",
      "https://evilreddoorla.com/",
    ]) {
      const page = open(href);
      page.pointerdown();
      expect(page.loadsGA(), href).toBe(false);
    }
  });
});

describe("analytics must not see a credential-bearing URL", () => {
  it("never loads on a report or its print view", () => {
    for (const href of [
      "https://reddoorla.com/audit/tok",
      "https://reddoorla.com/audit/tok/print",
    ]) {
      const page = open(href);
      page.pointerdown();
      expect(page.loadsGA(), href).toBe(false);
    }
  });

  it("checks the path the reader is on when gtag would load, not the one they landed on", () => {
    const page = open("https://reddoorla.com/");
    page.navigate("/audit/tok");
    page.pointerdown();
    expect(page.loadsGA()).toBe(false);
  });

  // The subtle half. This is a SPA: a reader can navigate from a report to an
  // ordinary page in the same document. If the bail latched or removed the
  // listeners, analytics would stay dead for the rest of the session.
  it("bails WITHOUT latching, so analytics still starts if they navigate onward", () => {
    const page = open("https://reddoorla.com/audit/tok");
    page.pointerdown();
    expect(page.loadsGA()).toBe(false);
    page.navigate("/");
    page.pointerdown();
    expect(page.loadsGA()).toBe(true);
  });
});
