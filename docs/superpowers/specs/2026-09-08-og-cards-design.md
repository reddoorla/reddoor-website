# OG cards for every page — design

**Date:** 2026-09-08
**Asked by:** Tim, Discord #rd-website, 2026-09-08: "OG image and text for MedTech page and all pages for all moving forward … It shouldn't be the PNG of the debossed reddoor logo."

## Problem

The root layout emits `og:image` from whatever each loader returns as `meta_image`.
Only four Prismic types carry a meta image (page, industry, project, showcase), and
the fallback every other loader uses is `printedReddoor.png`, a 200×141 logo that
renders as the "cheesy" card Tim is seeing. Live state on 2026-09-08:

| Page                                              | og:image                                           |
| ------------------------------------------------- | -------------------------------------------------- |
| `/`                                               | Prismic meta image (filled)                        |
| `/medtech`                                        | debossed logo (industry doc's meta image is empty) |
| `/about`, `/contact`, `/portfolio`                | debossed logo (hard-coded, no Prismic doc)         |
| `/portfolio/*` (43)                               | Prismic meta image or hero                         |
| funnel pages                                      | 1200×630 typographic cards (PR #138)               |
| `/showcase`, 404, `/audit/[token]`, `/reschedule` | none                                               |

PR #138 already drew the typographic card the site should use (`scripts/og/generate.mjs`)
and left two spares, `default.jpg` and `medtech.jpg`, deliberately unwired.

## Goals

1. Every page ships a 1200×630 `og:image`, with no route able to fall through to the
   logo PNG or to nothing. Pages without a filled CMS meta image get a card generated
   from their own headline, in the PR #138 design.
2. The "OG text" half of Tim's ask: `og:title` falls back to the page title,
   `og:description` mirrors the meta description, plus `og:site_name`, `og:type`, `og:url`.
3. `/medtech` gets the art-directed `medtech.jpg` through the industry doc's meta image
   field, staged in a Prismic release for a human to publish.

## Non-goals

- A Prismic "place" for the code-routed pages (about, contact, portfolio, showcase).
  That needs a new custom type pushed through Slice Machine, which is an interactive
  login step. The generated card covers them; flagged for Tim as a follow-up decision.
- Touching any page whose Prismic meta image is filled.
- Tim's sticky portfolio title (separate ask, pending his screen share).

## Design

### Card renderer (pure)

`src/lib/og/card.ts` — `renderCard(headline, assets): Promise<Uint8Array>` returns a PNG.
Satori lays out a JSX-free element tree that reproduces the PR #138 card: paper texture
tiled at 300px, "Reddoor Creative" eyebrow, red Besley headline low-left, footer with
`reddoorla.com` and the door mark. Resvg (wasm) rasterises the SVG at 1200×630.

Assets are injected (`{ besley, inter, mark, texture, wasm }`) so the renderer has no
import-time dependency on Vite; unit tests load them from disk. Fonts are static Latin
subsets instanced from the Google Fonts variable files (Besley 400, Inter 300, both OFL,
licences committed alongside). Inter stands in for the site's Typekit Pragmatica, the
same way the PR #138 cards used system Helvetica.

### Headlines (pure)

`src/lib/og/headline.ts`:

- `SITE_HEADLINES`: registry of code-routed slugs → copy. `default` ("Brand strategy &
  design."), `about`, `contact`, `portfolio`, `showcase`, each echoing the page's hero.
- `docHeadline(title)`: strips the site's `| Reddoor Creative` title suffix, collapses
  whitespace, caps length. The medtech doc's title is "MedTech | Reddoor Creative".
- `auditHeadline(businessName | null)`: "When AI answers for {name}" / "your business".

### URL + validation (pure)

`src/lib/og/url.ts`: `ogCardPath(kind, id)` → `/og/{kind}/{id}.png`. Kinds:
`site | page | industry | showcase | project | audit`. Ids match `[A-Za-z0-9_-]{1,80}`
(Prismic UIDs and report tokens both fit). Nothing free-text goes in the URL, so the
endpoint cannot be used to put arbitrary words on a Reddoor card.

### Endpoint

`src/routes/og/[kind]/[id].png/+server.ts` — GET only.

- `site`: registry lookup, unknown slug → 404.
- `page | industry | showcase | project`: Prismic `getByUID(kind, id)` → `docHeadline`;
  missing doc → 404.
- `audit`: `fetchReport(token)` → `auditHeadline`; missing → 404. Response is
  `private, no-store` + `x-robots-tag: noindex`, matching the report's own policy.
- Everything else: `Cache-Control: public, max-age=300, s-maxage=86400`.
- `prerender = "auto"` with `entries()` listing every `site` slug and every page /
  industry / showcase document, so those cards are baked at build time; anything not
  enumerated (audit, a doc published after the build) renders in the function.

Assets reach the function through one tiny Vite plugin, `virtual:og-assets`, which reads
the fonts, texture, mark and the resvg wasm from disk at build time and exports them as
base64 (Vite`s own `?inline` is claimed by imagetools for images and refused for wasm).
adapter-netlify esbuild-bundles the SSR output, so nothing may depend on files existing
next to the function at runtime; base64 in the bundle is the only shape that survives.
Satori's default entry embeds Yoga as asm.js, so it needs no loader of its own.

### Loaders

- `+layout.server.ts` returns `meta_image: ogCardPath("site", "default")` as the base
  default. Page keys override layout keys, so every route that returns nothing (404,
  `/showcase`, `/dev/*`, any future route) inherits a real card.
- `about`, `contact`, `portfolio` → their `site` card. `/showcase` gets a `+page.ts` for its
  card. Bare `/reschedule` is a redirect to `/schedule` and needs nothing.
- `/` → `meta_image.url || ogCardPath("page", "home")` (today it has no fallback at all).
- `[uid]` → `|| ogCardPath(docType, uid)`; `showcase/[uid]` → `|| ogCardPath("showcase", uid)`;
  `portfolio/[uid]` → `|| hero.url || ogCardPath("project", uid)`.
- `audit/[token]` and `/print` → `ogCardPath("audit", token)`.
- The five `printedReddoor.png` imports go away. `default.jpg` and `medtech.jpg` leave the
  repo (one is superseded by the generated card, the other moves into Prismic) and
  `scripts/og/generate.mjs` drops their entries.

### Layout head

`og:title` = `meta_title || title`; `og:description` = `meta_description` when set;
`og:site_name` = "Reddoor Creative"; `og:type` = website; `og:url` = pathname resolved
against the same origin rule `metaImageUrl` already uses.

### Prismic content

Upload `medtech.jpg` to the reddoor-la asset library, create a release "OG: medtech meta
image", and update the industry doc `anwadxIAAC0AIHtG` `meta_image` in it. A human publishes.

## Testing

- Unit (vitest): `headline` (suffix strip, caps, registry contains every slug the loaders
  use), `url` (kind/id validation), `card` (renders a PNG whose IHDR reads 1200×630 and
  whose bytes are stable across two renders of the same input).
- Smoke (Playwright): `/og/site/about.png` is `image/png`; `/og/site/nope.png` is 404;
  `/about`'s `og:image` ends in `/og/site/about.png`; a 404 page still has an `og:image`.
- Build verification: `vite build`, then grep the prerendered HTML for `og:image` (no
  `sveltekit-prerender` host, no `printedReddoor`), confirm the prerendered PNGs exist,
  and invoke the emitted Netlify function directly for a dynamic card to prove the
  inlined wasm loads inside the esbuild bundle.
