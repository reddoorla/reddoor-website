# ContentWidthMedia — Slideshow item

**Date:** 2026-07-13
**Status:** Design approved in conversation; pending written-spec review.
**Owner:** Tucker Lemos

## Goal

Let a single item inside the `ContentWidthMedia` slice's `images` group render as a
**slideshow** (a carousel of multiple images) inline in its grid cell, alongside the
existing image and Vimeo-video item types. Reuse the existing `Slideshow` slice's
carousel behavior (autoplay, arrows, play/pause, dots, swipe, infinite loop).

## Context & constraints

- `ContentWidthMedia.images` is a **repeatable Group**; each item is a single media unit
  (`label`, `image`, `vimeoid`, `loopvideo`, `link`, `aspect`) laid out in a 1/2/3-column
  flex-wrap grid with a text sidebar.
- `Slideshow` is a **separate slice** with its own `images` Group (Image fields) and the
  full carousel UI in `Slideshow/index.svelte`.
- **Prismic cannot nest a repeatable Group inside a Group** (a Group's fields must be
  nestable fields; Group is composite). So a slideshow's multiple images cannot live as a
  nested array on the item.
- **No route in this codebase uses `graphQuery`/`fetchLinks`.** Content relationships are
  only read at the `.uid` level today. Introducing deep-link resolution would be new,
  fragile infrastructure.
- Recent fix context: the no-link branch of `ContentWidthMedia` was just corrected so media
  fills the padded (`pr-6 pb-6`) cell without stacking or bleeding into the gap. The
  slideshow must follow the same "fill the padded cell" sizing.

## Chosen approach (A): inline slides via a repeatable media Link

Add a **`slides`** field to the `images` group item — a `Link` with `repeat: true`,
`select: "media"`. This gives an unbounded array of images per item with **no new custom
type and no page-query changes**.

Rejected alternatives:

- **B. Reusable Gallery document + content relationship** — would need a new custom type
  and `fetchLinks`/`graphQuery` resolution through a slice-zone → group-item →
  content-relationship → gallery-images chain. Too much new query-layer risk for one
  feature in a codebase that uses none. Can be added later without undoing A if reusable
  galleries become a real need.
- **C. Fixed image slots** (`slideImage1..5` + toggle) — hard slide cap and a cluttered,
  empty-slot editing UX.

Trade-off accepted: media links are not Prismic Image fields, so `PrismicImage` can't render
them. A small responsive-`<img>` helper covers this with equivalent imgix quality (see
`MediaImg` below).

## Data model change

`ContentWidthMedia/model.json`, saved via Prismic's `save_slice_data` MCP tool (never
hand-edited). Add to the `images` group `fields`:

```jsonc
"slides": {
  "type": "Link",
  "config": {
    "label": "slideshow images",
    "select": "media",
    "repeat": true
  }
}
```

Regenerate `prismicio-types.d.ts` via Slice Machine after the model change.

### Per-item render precedence

Extends today's implicit image-vs-video rule:

1. `slides` filled (≥1 media link) → **slideshow**
2. else `vimeoid` filled → video
3. else → image

- A **slideshow item ignores `item.link`** (the carousel owns clicks/swipe; a wrapping
  `<a>` would fight the controls).
- It respects the item's `aspect`, the `desktopcolumns` width, and `hasGap` cell padding.
- `aspect: "free"` → fall back to `aspect-video` so the carousel has a defined height
  (mirrors the "an iframe/carousel needs a height" lesson).

## Component architecture (snippet-based)

The reuse seam is Svelte 5 **snippets** at two levels.

### New — `$lib/components/Slideshow/Slideshow.svelte` (shared carousel)

Carousel mechanics extracted from the current slice: tripled-array infinite loop, translate
track, autoplay lifecycle, prev/next, play/pause, dots, swipe.

Props:

- `slides: unknown[]` — the array (component uses it for count + index math only).
- `slide` — a **snippet** `(item, index)` that renders one slide's media. This is the
  render-prop that lets each caller supply its own image markup while sharing 100% of the
  carousel logic.
- `aspectClass?: string` — e.g. `"aspect-video"`, `"aspect-square"` (default `"aspect-video"`).
- `hasNavDots?: boolean` — gates dots (only shown when also at/above the control threshold).
- `interval?: number` (default 5000), `transitionMs?: number` (default 1600),
  `autoplay?: boolean` (default true).

**Internal snippets to DRY repeated markup** (the refactor opportunity called out in review):

- `{#snippet controlButton(onclick, ariaLabel, children)}` — the shared circular control
  button styling used by prev/next/play-pause.
- `{#snippet navArrow(direction)}` — collapses the two near-identical arrow buttons into one
  parameterized snippet.

### New — `$lib/components/Slideshow/MediaImg.svelte` (responsive media-link image)

Renders a media-link URL as a responsive `<img>`: builds `srcset` over
`[400, 640, 800, 1200, 1600]` with `?auto=format,compress&fit=max&width=<w>`, a `sizes`
attr, `loading="lazy"`, `decoding="async"`, `object-cover`. Prismic media URLs are
imgix-backed, so this matches `PrismicImage`'s quality/Lighthouse behavior. `alt` falls back
to the item `label` (or empty/decorative when absent).

### Refactor — `Slideshow/index.svelte` (thin wrapper)

Keeps its `ContentWidth`/sidebar/background/`isAnimated`/`hide` wrapper. Renders
`<Slideshow slides={images} hasNavDots={slice.primary.hasNavDots}>` with a `slide` snippet
using `<PrismicImage>` — its images are Image fields, so output is unchanged.

### Edit — `ContentWidthMedia/index.svelte` (add slideshow branch)

Add the slideshow branch ahead of the image/video precedence, rendering
`<Slideshow slides={item.slides} aspectClass={aspectClassFor(item)} hasNavDots>` with a
`slide` snippet using `<MediaImg>`. The carousel fills the padded cell (`w-full h-full`),
consistent with the recent poster-padding fix.

## Behavior & accessibility

- **Container-width-responsive controls** via a Tailwind container query on the carousel
  root (`@container`). Controls (`arrows`, `play/pause`, `dots`) are `hidden` by default and
  shown at `@min-[400px]`. Below the threshold the pause button is hidden, so default
  `isPlaying = true` keeps it auto-running. This gives narrow desktop cells (≈3-column) and
  all mobile cells (full-width but narrow) a clean, chrome-less auto-run; wider cells get
  full controls. Threshold px is tunable.
- **`prefers-reduced-motion` wins everywhere**: no autoplay + instant/no transition,
  regardless of cell width. On a small controls-less cell this yields a static first slide,
  which also satisfies WCAG 2.2.2 (pause/stop for auto-moving content).
- **1 slide** → static image, no autoplay/controls. **0 slides** → not a slideshow (falls
  through to video/image).
- Existing `aria-label`s on arrows/play-pause/dots are preserved.
- Known minor edge case (accepted): pausing on a wide viewport then shrinking below the
  threshold hides the resume button, leaving it paused. Negligible; CSS-only hiding keeps
  the component simple.

## Rendering quality

`MediaImg` reproduces the `imgixParams={{ auto: ["format", "compress"] }}` + responsive
`widths`/`sizes` behavior the fleet relies on for Lighthouse, so slideshow images ship in
modern formats at appropriate resolutions.

## Mocks & testing

- Add a `slides` entry (media links) to `ContentWidthMedia/mocks.json` so the slice
  simulator shows the carousel; keep `vimeoid` empty (per the placeholder-vimeoid fix).
- Verify with Playwright: slides render, auto-advance works, controls appear at/above the
  threshold and are hidden below it, reduced-motion starts static, zero console errors.
  Drive the slice simulator and/or a page that renders the slice.

## Files touched

- **New** `src/lib/components/Slideshow/Slideshow.svelte` (shared carousel + internal snippets)
- **New** `src/lib/components/Slideshow/MediaImg.svelte` (responsive media-link image)
- **Refactor** `src/lib/slices/Slideshow/index.svelte` (thin wrapper using the shared component)
- **Edit** `src/lib/slices/ContentWidthMedia/index.svelte` (slideshow branch + `slide` snippet)
- **Model** `src/lib/slices/ContentWidthMedia/model.json` (add `slides`, via `save_slice_data`)
- **Mock** `src/lib/slices/ContentWidthMedia/mocks.json` (add `slides`)
- **Generated** `prismicio-types.d.ts` (Slice Machine regenerates after model change)
- **Test** one Playwright smoke assertion for the slideshow item

## Out of scope (YAGNI)

- Reusable gallery documents / content-relationship model (Approach B).
- Per-item nav-dots toggle (dots are governed by the container-width threshold).
- Video slides within the carousel (images only for now).
- Changing the standalone `Slideshow` slice's authoring model. Its output is unchanged
  except it inherits the shared component's `prefers-reduced-motion` handling (it will now
  start paused under reduced motion) — an intentional accessibility improvement, not a
  regression. The container-query control-hiding never triggers for it (always wide).
