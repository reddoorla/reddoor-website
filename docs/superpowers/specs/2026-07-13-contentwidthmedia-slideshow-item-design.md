# ContentWidthMedia — Slideshow item

**Date:** 2026-07-13
**Status:** Implemented (Approach B). Supersedes the original Approach A design.
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
  nestable; Group is composite). So a slideshow's multiple images cannot live as a nested
  array on the item.
- Recent fix context: the no-link branch of `ContentWidthMedia` was just corrected so media
  fills the padded (`pr-6 pb-6`) cell without stacking or bleeding into the gap.

## Chosen approach (B): a reusable Gallery document via a content relationship

A slideshow item points at a **Gallery** document through a content-relationship `Link`.
Galleries are authored once and reused across projects; the slice resolves the gallery's
images at load time.

### Why Approach B (not A)

Approach A (a repeatable media `Link` with `select: "media"` on the item) proved
**unworkable in this Prismic/SliceMachine version**: SliceMachine's type generator produced
no usable type for a repeatable media link (repeatable links are modeled for buttons/CTAs,
not media galleries), and the `save_slice_data` MCP tool silently stripped the field. A
reusable Gallery document is the model Prismic actually supports for "a set of images," and
it has the bonus that galleries are reusable across projects.

The cost of B — deep-link resolution via `fetchLinks` — turned out to be one line per page
load (see below), not the "fragile query infrastructure" originally feared.

## Data model

### New custom type — `gallery` (`customtypes/gallery/index.json`)

Repeatable document type: `uid` (UID), `title` (Text), `images` (repeatable Group of a
single `image` Image field). This is the reusable set of slideshow images.

### New field on the `ContentWidthMedia` item — `gallery`

Added to the `images` group `fields` in `ContentWidthMedia/model.json`:

```jsonc
"gallery": {
  "type": "Link",
  "config": {
    "label": "gallery (slideshow)",
    "select": "document",
    "customtypes": ["gallery"]
  }
}
```

Generates `gallery: prismic.ContentRelationshipField<"gallery">` on
`ContentWidthImageSliceDefaultPrimaryImagesItem`.

> **Note on how the field/types were added.** Editing `model.json` by hand does **not**
> regenerate `src/prismicio-types.d.ts` — SliceMachine only runs typegen through its own
> model-write path, and the `save_slice_data` MCP tool strips the field. Nor does
> `vite build`/`vite dev` run Prismic typegen. The reliable code-first path (used here) is
> to drive `@slicemachine/manager`'s `customTypes.updateCustomType` / `slices.updateSlice`
> hooks, which re-emit the full types file from the on-disk models. The SliceMachine UI's
> "add field" does the same thing. Either way the model must still be **pushed to the
> Prismic remote** for content editors to use it.

### Per-item render precedence

Extends today's implicit image-vs-video rule; the gallery branch is checked **first**:

1. `gallery` filled and resolved (≥1 image) → **slideshow**
2. else `vimeoid` filled → video
3. else → image

- A **slideshow item ignores `item.link`** (the carousel owns clicks/swipe; a wrapping
  `<a>` would fight the controls).
- It respects the item's `aspect`, the `desktopcolumns` width, and `hasGap` cell padding.
- `aspect: "free"` → falls back to `aspect-video` so the carousel has a defined height.

## Page-query change: `fetchLinks`

A content relationship only carries the linked document's `id`/`uid` unless the query asks
for more. Every load that renders the shared `SliceZone` (and therefore may render a
ContentWidthMedia gallery item) resolves the gallery's images one level deep:

```ts
client.getByUID(type, uid, { fetchLinks: ["gallery.images"] });
```

Applied in the three loads that render `<SliceZone slices={data.page.data.slices} …>`:
`portfolio/[uid]` (project), `showcase/[uid]` (showcase), and `[uid]` (page). It is a no-op
for documents without a gallery. The resolved images land on `item.gallery.data.images` at
runtime; the generated `ContentRelationshipField` type omits `.data`, so the render helper
widens the type locally.

## Component architecture (snippet-based)

The reuse seam is Svelte 5 **snippets**.

### `$lib/components/Slideshow/Slideshow.svelte` (shared carousel)

Carousel mechanics extracted from the current slice: tripled-array infinite loop, translate
track, autoplay lifecycle, prev/next, play/pause, dots, swipe. Props:

- `slides: unknown[]` — the array (count + index math only).
- `slide: Snippet<[unknown, number]>` — render-prop that renders one slide's media, so each
  caller supplies its own image markup while sharing 100% of the carousel logic.
- `aspectClass?` (default `"aspect-video"`), `hasNavDots?`, `interval?` (5000),
  `transitionMs?` (1600), `autoplay?` (true).

Internal snippet `controlButton` DRYs the shared circular control-button styling used by
prev/next/play-pause.

### `Slideshow/index.svelte` (thin wrapper — refactored)

Keeps its `ContentWidth`/sidebar/background/`isAnimated`/`hide` wrapper and delegates to
`<Slideshow slides={slice.primary.images} …>` with a `slide` snippet using `<PrismicImage>`
(its images are Image fields, so output is unchanged).

### `ContentWidthMedia/index.svelte` (slideshow branch — new)

A `galleryImages(item)` helper returns the resolved images (or `null`, falling through to
video/image). The slideshow branch renders, ahead of the image/video branches and without an
`<a>` wrapper:

```svelte
<Slideshow slides={gallerySlides} aspectClass={slideshowAspectClass(item)} hasNavDots>
  {#snippet slide(media)}
    <PrismicImage field={(media as GalleryDocumentDataImagesItem).image}
      imgixParams={{ auto: ["format", "compress"] }} widths={[400,640,800,1200,1600]}
      sizes="(min-width: 1024px) 50vw, 100vw" loading="lazy" decoding="async" />
  {/snippet}
</Slideshow>
```

`PrismicImage` is used directly (the gallery's images are real Prismic Image fields), so no
`MediaImg` helper is needed — the Approach-A `MediaImg`/`mediaSrcset` helpers were removed.

## Behavior & accessibility

- **Container-width-responsive controls** via a Tailwind container query (`@container`) on
  the carousel root. Arrows and dots are `hidden` (display:none) by default and shown at
  `@min-[400px]`; below the threshold the carousel auto-runs chrome-less. Narrow desktop
  cells (≈3-column) and all mobile cells get a clean auto-run; wider cells get full controls.
- **Play/pause is the WCAG 2.2.2 pause mechanism.** It is rendered only when motion actually
  runs (`canAutoplay`), so under reduced motion there is no misleading no-op button. At
  `@min-[400px]` it is visible; below the threshold it stays in the DOM but is visually
  hidden (`opacity-0 pointer-events-none`) until keyboard focus (`focus-within`), so small
  "auto-run" cells still expose a pause control to keyboard/AT users.
- **`prefers-reduced-motion` wins everywhere**: no autoplay, instant/no transition, and (per
  the above) no play/pause button since there is no motion to pause.
- **1 image** → static image, no autoplay/controls. **0 images / unresolved** → not a
  slideshow (falls through to video/image).

## Testing

- **Fixture route** `src/routes/dev/slideshow-fixture/+page.svelte` renders the real
  `ContentWidthMedia` slice with a gallery item resolved as `fetchLinks` would deliver it.
  This is necessary because the **slice simulator cannot resolve content relationships**, so
  a `mocks.json` gallery entry would render empty. `/dev/*` is robots-disallowed.
- **Playwright** `tests/smoke/contentwidthmedia-slideshow.spec.ts`: (1) the gallery renders
  as a carousel with working prev/next and a toggling play/pause; (2) under reduced motion
  the pause control is omitted (WCAG 2.2.2); (3) on a narrow cell the arrows hide below the
  container threshold. Reduced motion is driven by stubbing `window.matchMedia` via
  `addInitScript` — Playwright's `reducedMotion` emulation does not reach `matchMedia` in
  this setup, and the carousel detects reduced motion in JS.

## Files touched

- **New** `customtypes/gallery/index.json` (Gallery custom type)
- **New** `src/lib/components/Slideshow/Slideshow.svelte` (shared carousel + internal snippet)
- **New** `src/routes/dev/slideshow-fixture/+page.svelte` (Playwright fixture)
- **New** `tests/smoke/contentwidthmedia-slideshow.spec.ts`
- **Refactor** `src/lib/slices/Slideshow/index.svelte` (thin wrapper on the shared component)
- **Edit** `src/lib/slices/ContentWidthMedia/index.svelte` (slideshow branch + `slide` snippet)
- **Model** `src/lib/slices/ContentWidthMedia/model.json` (add `gallery` field)
- **Loads** `portfolio/[uid]`, `showcase/[uid]`, `[uid]` `+page.server.ts` (add `fetchLinks`)
- **Generated** `src/prismicio-types.d.ts` (regenerated: `gallery` field + `GalleryDocument`)

## Remaining author step (Prismic remote)

The code and types are complete. For editors to use the feature the models must be **pushed
to the Prismic remote** via SliceMachine's "Push changes": the `gallery` custom type and the
updated ContentWidthMedia model. Then create a Gallery document, add images, and point a
ContentWidthMedia item's `gallery` field at it on a project.

## Out of scope (YAGNI)

- Per-item nav-dots toggle (dots are governed by the container-width threshold).
- Video slides within the carousel (images only for now).
- Multi-level link resolution (only `gallery.images`, one level, is needed).
- Changing the standalone `Slideshow` slice's authoring model. Its output is unchanged except
  it inherits the shared component's `prefers-reduced-motion` handling — an intentional
  accessibility improvement.
