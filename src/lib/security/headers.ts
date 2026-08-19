/**
 * The site's security headers, in one place.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 *
 * Netlify attaches `[[headers]]` only to STATICALLY SERVED files. Every SSR
 * response — the 404 page, and `/contact`, which is `prerender = false` for its
 * form action — shipped with no custom headers at all. So the one page on the
 * site that takes a form submission and embeds a Turnstile widget was the one
 * page with no CSP, no `nosniff`, and no framing protection. Exactly backwards.
 *
 * `hooks.server.ts` applies these to SSR responses; `netlify.toml` applies the
 * same values to static ones. Two copies of a policy drift, so `headers.test.ts`
 * parses `netlify.toml` and asserts the CSP matches this file byte for byte.
 * Change one and the test names the other.
 *
 * ── Why enforcing, rather than Report-Only ────────────────────────────────
 *
 * Report-Only was the right call when this policy was first written and nobody
 * knew what it would break. It is the wrong call now: this exact string has been
 * ENFORCED on every prerendered page of this same app since 2026-07-16, and the
 * SSR routes render the same components from the same bundle. The only thing
 * `/contact` adds is Turnstile, whose hosts are already in `script-src` and
 * `frame-src`. And we run no report collector — `Report-Only` here would send
 * violations to the browser console, where nobody is looking, while leaving the
 * page unprotected. A smoke test that fails on any `securitypolicyviolation` is
 * worth more than a report nobody receives.
 */

/**
 * The policy. Kept identical to `netlify.toml`'s — see the long comment there
 * for why each entry is present, especially `p.typekit.net` in `style-src`
 * (dropping it silently fell the whole type family back to system sans).
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.cdn.prismic.io https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net https://fonts.googleapis.com",
  "font-src 'self' data: https://use.typekit.net https://p.typekit.net https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "frame-src https://player.vimeo.com https://*.prismic.io https://challenges.cloudflare.com https://app.netlify.com",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://*.prismic.io https://*.typekit.net",
].join("; ");

/** Applied to every SSR response, HTML or not. */
export const BASE_SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=()",
};

/**
 * Apply the headers to a response, without clobbering what a route already set.
 *
 * The exemption matters: `/reschedule`, `/cancel`, `/calendar` and
 * `/meeting-outcome` set `Referrer-Policy: no-referrer` through a meta tag
 * because their URLs carry a credential, and several API routes set
 * `cache-control: no-store`. A blanket overwrite here would quietly undo both.
 * CSP goes on HTML only — a JSON error body has no content to govern, and a
 * policy header on it is noise in every response the funnel makes.
 */
export function applySecurityHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html") && !response.headers.has("Content-Security-Policy")) {
    response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  return response;
}
