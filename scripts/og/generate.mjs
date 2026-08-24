/**
 * Generate the funnel pages' OG cards — typographic, echoing each page's own
 * hero: the bg-paper texture, the red Besley headline the visitor will actually
 * meet, the door mark as a signature. Replaces the debossed-logo default that
 * every SMS/iMessage unfurl was showing (Tim, Discord 2026-08-21).
 *
 * Run from the repo root:  node scripts/og/generate.mjs
 * Output: src/lib/assets/og/<slug>.jpg (1200×630), committed like any asset.
 *
 * Besley is fetched from Google Fonts at generation time (same typeface the
 * site loads from Typekit); the texture and logo are the repo's own files, so
 * a regenerated card only changes if the copy here does.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "src/lib/assets/og");
// data: URIs, not file:// — Chromium refuses file:// subresources on a page
// built with setContent, and fails them SILENTLY: the card renders, minus its
// background and mark.
const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(path).toString("base64")}`;
const TEXTURE = dataUri(resolve(ROOT, "static/waterColorBg.jpg"), "image/jpeg");
const LOGO = dataUri(resolve(ROOT, "src/lib/assets/icons/logos/reddoor_logo.png"), "image/png");

/** slug → the page's own hero line (default state), so the preview reads as
 *  the page it opens. `default` and `medtech` are spares: the site-wide CMS
 *  fallback and the Prismic doc's meta image are wired separately. */
const CARDS = [
  { slug: "schedule", headline: "Let’s find a time." },
  { slug: "reschedule", headline: "Let’s find a better time." },
  { slug: "cancel", headline: "Cancel your call?" },
  { slug: "calendar", headline: "Save the date." },
  { slug: "meeting-outcome", headline: "How did the call go?" },
  { slug: "not-a-fit", headline: "Thanks for being straight with us." },
  { slug: "unsubscribed", headline: "You’re unsubscribed." },
  { slug: "resubscribed", headline: "You’re back on the list." },
  { slug: "medtech", headline: "Instant credibility with buyers and clinicians." },
  { slug: "default", headline: "Brand strategy & design." },
];

const html = (headline) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Besley:wght@400&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    /* bg-paper, at the site's own 300px tile. */
    background-image: url("${TEXTURE}");
    background-size: 300px;
    background-position: center;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 72px 84px 64px;
    font-family: "Besley", georgia, serif;
  }
  .eyebrow {
    font-family: helvetica, arial, sans-serif;
    font-size: 26px; font-weight: 300;
    letter-spacing: 6px; text-transform: uppercase;
    color: #000;
  }
  h1 {
    font-size: 92px; font-weight: 400; line-height: 1.12;
    color: #d71920;
    max-width: 950px;
    /* Sit the headline low-left like the hero band, above the footer row. */
    margin-top: auto; padding-bottom: 28px;
  }
  .foot { display: flex; justify-content: space-between; align-items: flex-end; }
  .site {
    font-family: helvetica, arial, sans-serif;
    font-size: 24px; font-weight: 300; letter-spacing: 2px; color: #6e6f72;
  }
  img.mark { width: 120px; display: block; }
</style></head>
<body>
  <div class="eyebrow">Reddoor Creative</div>
  <h1>${headline}</h1>
  <div class="foot">
    <div class="site">reddoorla.com</div>
    <img class="mark" src="${LOGO}" alt="">
  </div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const { slug, headline } of CARDS) {
  await page.setContent(html(headline), { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(OUT, `${slug}.jpg`), type: "jpeg", quality: 90 });
  console.log(`og card: ${slug}.jpg — "${headline}"`);
}
await browser.close();
