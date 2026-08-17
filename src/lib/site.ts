/**
 * Canonical production origin. Used to build absolute URLs (OG/Twitter images,
 * sitemap `<loc>`s) that must resolve in prerendered output: at prerender time
 * `page.url.origin` is SvelteKit's `http://sveltekit-prerender` placeholder, not
 * the real host, so a request-origin-relative URL would be baked in broken.
 */
export const SITE_URL = "https://reddoorla.com";
