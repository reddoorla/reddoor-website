# Opening-animation slides controlled via Prismic

## Problem

The home-page `OpeningAnimation.svelte` component hardcodes 4 rotating background slides — St James, Enzo's, Freedom Youth Foundation, and Gallery Sonder. Each slide is a Vite-imported image plus a name, services tag, and project link literal. To swap in a new featured project requires a code change and deploy.

We want content editors to manage the slide deck from Prismic, with no other behavior of the animation (headline, CTA, rotation interval, nav links) changing.

## Out of scope

- Headline text ("Arm your brand with" / "compelling design") — stays hardcoded.
- CTA button label and href ("View Our Work" → /portfolio) — stays hardcoded.
- Rotation interval (5000ms) — stays hardcoded.
- Menu-overlay nav links — stay hardcoded.
- Logo soup brand entries — unaffected; the new custom type is independent.

## Design

### 1. New Prismic custom type — `opening_animation`

A new **single-type** document at `customtypes/opening_animation/index.json`, modeled on `customtypes/logo_soup/index.json` (`repeatable: false`, `format: "custom"`).

One group field `slides`. Each slide entry:

| Field                          | Type  | Required | Notes                                                               |
| ------------------------------ | ----- | -------- | ------------------------------------------------------------------- |
| `background_image`             | Image | yes      | Desktop background                                                  |
| `background_image_mobile_crop` | Image | no       | If present and viewport < 768px, used instead of `background_image` |
| `project_name`                 | Text  | yes      | Shown bottom-left on desktop hover overlay                          |
| `services`                     | Text  | yes      | E.g. "Branding, Print"                                              |
| `project_link`                 | Link  | yes      | `allowTargetBlank: true`, `allowText: false`                        |

Field naming intentionally parallels `logo_soup.brands` (`active_background`, `active_background_mobile_crop`, `name`, `services`, `project_link`) so editors see a familiar shape.

No min/max enforced at the schema level. Component handles 0 slides gracefully (see §5).

### 2. Data loading

In `src/routes/[[preview=preview]]/+page.server.ts`, add one fetch and return value:

```ts
const openingAnimation = await client.getSingle("opening_animation");

return {
  page,
  logoSoup,
  openingAnimation,
  // ...existing meta fields
};
```

No other route loads need to change — the opening animation only renders on the home page.

### 3. Component refactor — `src/lib/components/OpeningAnimation.svelte`

**Remove:**

- The four `?as=run` imports at the top of the script block (lines 6–9).
- The hardcoded `backgrounds` array (lines 50–75).

**Add:**

- A `slides` prop typed from the generated Prismic types: `OpeningAnimationDocument["data"]["slides"]` (exact type name will be whatever `prismic-ts-codegen` produces; verify after running codegen).
- A `currentSlide` derived value: `slides[currentImageIndex]`, guarded for the empty case.

**Change:**

- Replace `<Img>` usage in the background-image `{#each}` block (lines 274–285) with `<PrismicImage>` from `@prismicio/svelte`, matching the existing pattern in `src/lib/components/LogoSoup.svelte` lines 118–126. Mobile-crop selection:

  ```svelte
  field={viewportWidth < MOBILE_BREAKPOINT_PX && slide.background_image_mobile_crop?.url
    ? slide.background_image_mobile_crop
    : slide.background_image}
  ```

- Stable key for the `{#each}`: prefer `slide.project_link.url`, fall back to `slide.project_name`, then `i`.

- The bottom-left overlay (lines 298–319) reads `slide.project_name`, `slide.services`, and `slide.project_link.url` instead of the hardcoded `backgrounds[currentImageIndex]` properties.

- `changeBackgroundImage` uses `slides.length` instead of `backgrounds.length`.

### 4. Page wiring — `src/routes/[[preview=preview]]/+page.svelte`

```svelte
<OpeningAnimation slides={data.openingAnimation.data.slides} />
```

### 5. Empty / fallback behavior

If `slides.length === 0`:

- Skip the rotation `setInterval` (the existing `$effect` should early-return when there's nothing to rotate).
- Render the section structure (paper-red base, headline, CTA, scroll arrow) — but render no `<PrismicImage>` and no bottom-left project label.

This is the predictable rule: "if you delete content, content disappears." No code-side image fallback.

### 6. Migration and cleanup

1. Define the custom type in `customtypes/opening_animation/index.json`.
2. Push the type to Prismic (Slice Machine push).
3. In the Prismic UI, create the single-type document and seed it with the four current slides (St James, Enzo's, Freedom Youth Foundation, Gallery Sonder), uploading the existing JPGs from `src/lib/assets/images/openingBgs/` as the `background_image` values.
4. Regenerate Prismic types locally (`prismic-ts-codegen` or whatever the project uses) to refresh `src/prismicio-types.d.ts`.
5. Implement the component refactor and page-wiring changes.
6. Verify the home page renders identically to today.
7. Delete the four files in `src/lib/assets/images/openingBgs/`.

## Risks

- **Image-optimization regression.** Today's images go through Vite's `?as=run` build-time pipeline. Prismic images come as imgix URLs, served via `<PrismicImage>`. This is the same trade-off `LogoSoup` already accepts, so the precedent is established — flag rather than block.
- **Seed-then-deploy ordering.** If code ships before the Prismic document is populated, the home page renders without backgrounds. Mitigated by seeding the document in Prismic _before_ merging the code change.
- **Type generation.** The exact generated type name for the new custom type isn't known until codegen runs. Implementation step should regenerate types and reference the real name, not invent one.
