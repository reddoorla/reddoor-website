import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BASE_SECURITY_HEADERS, CONTENT_SECURITY_POLICY, applySecurityHeaders } from "./headers";

/** The policy as netlify.toml actually declares it, for static responses. */
function policyFromNetlifyToml(): { csp: string; headers: Record<string, string> } {
  const toml = readFileSync(new URL("../../../netlify.toml", import.meta.url), "utf8");
  const block = toml.slice(toml.indexOf("[headers.values]"));
  const read = (name: string) => {
    const m = block.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, "m"));
    if (!m) throw new Error(`${name} not found in netlify.toml`);
    return m[1];
  };
  return {
    csp: read("Content-Security-Policy"),
    headers: {
      "X-Frame-Options": read("X-Frame-Options"),
      "X-Content-Type-Options": read("X-Content-Type-Options"),
      "Referrer-Policy": read("Referrer-Policy"),
      "Strict-Transport-Security": read("Strict-Transport-Security"),
      "Permissions-Policy": read("Permissions-Policy"),
    },
  };
}

describe("the SSR policy matches the static one", () => {
  // Two copies of a security policy drift, and the drift is invisible: the
  // static pages keep working while the SSR ones quietly diverge. These pin
  // them together, so changing one fails on the other.
  it("declares the same CSP as netlify.toml, byte for byte", () => {
    expect(CONTENT_SECURITY_POLICY).toBe(policyFromNetlifyToml().csp);
  });

  it("declares the same non-CSP headers", () => {
    expect(BASE_SECURITY_HEADERS).toEqual(policyFromNetlifyToml().headers);
  });

  it("no longer permits the dead CRM host", () => {
    // The widget endpoint it existed for needs a cf_clearance cookie from a
    // Cloudflare zone we do not own, and was replaced by the server-side sync.
    // A connect-src entry for a host we never call is permission without purpose.
    expect(CONTENT_SECURITY_POLICY).not.toContain("leadconnectorhq.com");
    expect(policyFromNetlifyToml().csp).not.toContain("leadconnectorhq.com");
  });

  it("still allows what the type and the bot screen need", () => {
    // p.typekit.net in style-src: the kit CSS @imports p.css, which the browser
    // fetches as a STYLESHEET, not a font. Removing it fell the whole family
    // back to system sans in production — report-only never caught it, because
    // the @import fires before a violation listener can attach.
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).toMatch(/style-src[^;]*https:\/\/p\.typekit\.net/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/script-src[^;]*challenges\.cloudflare\.com/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/frame-src[^;]*challenges\.cloudflare\.com/);
  });
});

describe("applySecurityHeaders", () => {
  const html = () => new Response("<p>hi</p>", { headers: { "content-type": "text/html" } });
  const json = () => new Response("{}", { headers: { "content-type": "application/json" } });

  it("puts the CSP on HTML", () => {
    expect(applySecurityHeaders(html()).headers.get("content-security-policy")).toBe(
      CONTENT_SECURITY_POLICY,
    );
  });

  it("leaves the CSP off non-HTML", () => {
    // A JSON body has no content for a policy to govern, and the header would
    // ride on every response the funnel makes.
    expect(applySecurityHeaders(json()).headers.get("content-security-policy")).toBeNull();
  });

  it("still hardens non-HTML with the rest", () => {
    const r = applySecurityHeaders(json());
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("never overwrites a header the route already set", () => {
    // /reschedule, /cancel, /calendar and /meeting-outcome deliberately weaken
    // Referrer-Policy to `no-referrer`, because their URLs carry a credential.
    // A blanket overwrite here would quietly hand that credential back out.
    const r = new Response("<p>hi</p>", {
      headers: { "content-type": "text/html", "Referrer-Policy": "no-referrer" },
    });
    expect(applySecurityHeaders(r).headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("does not disturb a route's own cache directives", () => {
    const r = new Response("{}", {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
    expect(applySecurityHeaders(r).headers.get("cache-control")).toBe("no-store");
  });
});
