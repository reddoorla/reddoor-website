# Portfolio featured-section rebuild — design

**Date:** 2026-06-30
**File:** `src/routes/[[preview=preview]]/portfolio/+page.svelte`
**Figma:** `FwaZy5Jz0JsbJjJRvytnmY`, node `725:1226` (Portfolio, desktop 1440)

## Goal

Replace the editorial/featured region of the portfolio page with the new Figma
design. A re-sequenced, re-imagined set of six featured projects using new
imagery, headlines, and three layout patterns.

## Scope

**Replace** (current `+page.svelte` ~L430–668): the full-bleed CEO hero, the old
featured projects (Progress Lighting, LoneHollow, Young Life, St James[old],
1-800-Dentist), **and** the mid-page red CTA (`Isn't it time…`).

**Untouched:**

- Hero "Portfolio" header (intro lead + red `Portfolio` h1).
- Archive grid `#projectsDiv`: "But wait, there's more!", search, sort dropdown,
  category filters, the entire View-Transition machinery, aria-live region.
- Footer red CTA (`It's time to arm your brand…` + MEET WITH US).
- `+page.server.ts` data loading.

## Featured sequence (new)

All arrows are circular-arrow links to the project page. Slugs confirmed live in
Prismic (`reddoor-la`).

| #   | Project                     | Slug                                   | Layout                                                                       |
| --- | --------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Rubrik Zero Labs            | `/portfolio/rubrik-zero-labs`          | full-bleed image → caption below → offset 2nd image (report-mac)             |
| 2   | Revogen                     | `/portfolio/revogen`                   | full-bleed image → 2-col (paper card headline+label \| packaging image)      |
| 3   | CEO of Los Angeles          | `/portfolio/ceo-la`                    | offset lanyard image → 2-col (paper card headline+label \| brand-guide-grid) |
| 4   | Trinity Law School          | `/portfolio/trinity-law-school`        | 2-col (steps image w/ label overlay \| tablet viewbook)                      |
| 5   | St. James' Episcopal School | `/portfolio/st-james-episcopal-school` | full-bleed mural → 2-col (paper card headline+label \| phone mockup)         |
| 6   | Gallery Sonder              | `/portfolio/gallery-sonder`            | offset storefront image → caption below                                      |

### Copy

- **Rubrik** caption headline: "Smarter Insights to Keep Your Data Protected" — _Brand, Digital_
- **Revogen** card headline: "A revolutionary brand with a simple purpose: Healing." — _Brand, Print, Digital, Environmental_
- **CEO** card headline: "The “buck stops here” with a branding system overhaul of LA County's CEO" — _brand, digital, print_
- **Trinity** label overlay: _Print, Digital_
- **St. James'** card headline: "A diverse, joyful, and inclusive community of young learners." — _brand, digital, print, environmental_
- **Gallery Sonder** caption headline: "A local gallery highlighting the stories of emerging and established artists." — _brand, digital, print, environmental_

## Layout primitives

1. **Full-bleed image** — `ScreenWidthImage` / full-width `<Img>`.
2. **Offset image** — `md:w-4/5 md:ml-[20%]` block (existing convention).
3. **2-col paper-card + image** — `flex-col-reverse lg:flex-row`, each col
   `lg:w-1/2 aspect-square`; paper card = `bg-paper`, headline top + label/arrow
   bottom (matches current Progress Lighting / St James blocks).

**Caption block** (gray editorial headline + red CAPS label + services + circular
arrow) recurs 6×. Factor into a local Svelte 5 `{#snippet}` taking
`{ headline, label, services, href, ariaLabel }`. No new component files.

## Approach

Inline section layouts + one `{#snippet}` for the repeated caption — NOT a
prop-driven `<FeaturedProject>` component (the four layout variants diverge too
much for one clean component). Pull exact spacing/colors per section via Figma
`get_design_context` while building.

## Assets

Reuse existing local assets where present; export the rest from Figma into
`src/lib/assets/images/` via the `?as=run` (vite-imagetools) pipeline.

| Image                         | Source                                          |
| ----------------------------- | ----------------------------------------------- |
| CEO lanyard hero              | existing `CEO_HERO_Badge_Lanyard 1.jpg` (reuse) |
| St James mural (full-bleed)   | check existing `stJames.jpg`; else export       |
| Rubrik city/data (full-bleed) | export                                          |
| Rubrik report-on-iMac         | export                                          |
| Revogen homepage (full-bleed) | export                                          |
| Revogen packaging             | export                                          |
| CEO brand-guide grid          | export                                          |
| Trinity man-on-steps          | export                                          |
| Trinity tablet viewbook       | export                                          |
| St James phone mockup         | export                                          |
| Gallery Sonder storefront     | export                                          |

Flag any export that comes down too low-res for replacement with a hi-res original.

## Responsive (mobile — match current conventions)

- 2-col → `flex-col-reverse` (image above card on mobile, as existing blocks do).
- Offset images → full-width on mobile (`w-full md:w-4/5 md:ml-[20%]`).
- Caption blocks stack headline → label/arrow.
- Show mobile to user before finalizing.

## Invariants to preserve

- Heading order h1→h2; keep `.type-h4 / .type-h5 / .type-cta / .archive-title`
  pinned classes for any non-`<h1>` display headings.
- Single footer CTA only.
- Lighthouse 100: lazy/`fetchpriority=low` below-the-fold images, no new
  render-blocking assets, sized images.
- Don't touch the grid/search/sort/View-Transition code.

## Verification

- `svelte-check` clean, `pnpm build` clean.
- Dev-server smoke + screenshot compare each section against Figma.
- Heading-order pass (axe) + responsive check at mobile width.
