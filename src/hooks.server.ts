import type { Handle } from "@sveltejs/kit";
import { applySecurityHeaders } from "$lib/security/headers";

/**
 * Give SSR responses the security headers that `netlify.toml` gives static ones.
 *
 * Netlify's `[[headers]]` never reach a function response, so before this the
 * 404 page and `/contact` — the site's only form, carrying a Turnstile widget —
 * were the two pages served with no CSP and no `nosniff`. See
 * `$lib/security/headers` for the policy and why it is enforced rather than
 * report-only.
 *
 * Prerendered pages are unaffected: they are served as files, so Netlify's copy
 * applies and this never runs for them. In `vite dev` nothing is prerendered, so
 * this covers everything — which is what makes the smoke suite's assertions
 * meaningful locally.
 */
export const handle: Handle = async ({ event, resolve }) => {
  // The path picks the framing policy: /slice-simulator is the one route the
  // CMS loads in an iframe from another origin (CMS_FRAMED_ROUTES).
  return applySecurityHeaders(await resolve(event), event.url.pathname);
};
