<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";
  import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import type { Content } from "@prismicio/client";
  import { normalizeVimeoId, resolveCaseStudyMedia } from "./media";
  import { resolvePadding } from "$lib/utils/slicePadding";

  let { slice }: { slice: Content.CaseStudySlice } = $props();

  // Author-controlled band spacing (MED-16). Fallback FALSE, unlike the other
  // landing-page slices: this band ships flush in the comp, so a document that
  // predates the field must keep rendering with no section padding.
  const pad = $derived(resolvePadding(slice.primary, false));

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // The rail label names the section (h2) and the Besley lead line is its h3
  // child. With no label the lead line IS the section heading, so promote it
  // rather than skipping a level (axe heading-order gate) — same pattern as
  // TextColumns' `titleTag`.
  const headingTag = $derived(slice.primary.label ? "h3" : "h2");

  const vimeoId = $derived(normalizeVimeoId(slice.primary.vimeo_id));
  // Precedence + degrade rules (and why) live in ./media.ts.
  const media = $derived(
    resolveCaseStudyMedia({
      hasAfter: isFilled.image(slice.primary.after_image),
      hasBefore: isFilled.image(slice.primary.before_image),
      hasVideo: vimeoId !== "",
    }),
  );

  // AFTER is the default: it is the only state the Figma frame draws.
  let showBefore = $state(false);
  const showingAfter = $derived(!(media.showToggle && showBefore));

  const baseImage = $derived(
    media.base === "before" ? slice.primary.before_image : slice.primary.after_image,
  );

  // The after state is a slideshow of the project's work, not one still: the
  // main `after_image` first, then any extra slides. Filtered on `isFilled`
  // because an editor can leave a group row half-added, and a blank slide would
  // be a beat of empty band mid-rotation.
  //
  // Rendered through $lib/components/Slideshow — the shared component already
  // carries reduced-motion handling, the WCAG 2.2.2 pause control, swipe and the
  // looping track. It hides its own chrome when there is only one slide, so the
  // single-image case needs no branch here.
  const afterSlides = $derived(
    [slice.primary.after_image, ...(slice.primary.after_images ?? []).map((s) => s.image)].filter(
      (image) => isFilled.image(image),
    ),
  );

  const mediaTitle = $derived(slice.primary.heading || slice.primary.label || "case study video");

  // Every optional field can be blank at once (an images-only band is a
  // plausible authoring), and the text layer is only in flow below `lg` — so
  // without this it would ship 54px of empty padding above the photo on mobile
  // and nothing on desktop.
  const hasText = $derived(
    Boolean(slice.primary.label || slice.primary.heading || slice.primary.services) ||
      media.showToggle,
  );

  // Tops out at 2880 because that IS the source: the board frames are 1440x831
  // and export-assets pulls them at 2x. 2880 is what a 1440 viewport needs at
  // DPR 2, so the common retina desktop is now served exactly rather than
  // upscaled from 2560. Nothing above 2880 is listed — imgix would happily
  // enlarge past the source and hand back a bigger, blurrier file.
  const imageWidths = [640, 960, 1280, 1600, 1920, 2560, 2880];
</script>

<!--
  ART DIRECTION REQUIREMENT (cannot be enforced in code): from `lg` the label,
  services, switch and lead line sit DIRECTLY on the photo, with no scrim — the
  design relies on the photo's cream studio backdrop filling the top ~150px of
  the frame. Black + red type only reads there. A dark or busy upper band must
  be fixed with a different crop/shot, not by bolting a gradient over the
  design. `object-position: 50% 35%` below biases the cover crop toward the top
  of the source image for exactly that reason.

  This is a real WCAG constraint, not a preference, and the shipped Revogen
  photo only barely satisfies it. Measured off the composited page at 1440px:
  the primary-red label (#D71920, 16px bold — 12pt, so AA wants 4.5:1, not the
  3:1 large-text allowance) scores a median 4.51:1 against its own backdrop,
  4.35:1 at the 5th percentile. Any darker or busier crop fails outright, and
  nothing catches it automatically: axe declines to score text over an image.
  Check a replacement photo before publishing an industry page that uses it.
-->
<!-- Rail continuation: the services line and the before/after switch belong in
     the rail under the label. Passed to RailRow as its `rail` snippet so it
     flows after the label instead of being absolutely positioned at a fixed
     offset — a rail label past roughly 30 characters wraps to a second line in
     the 240px rail, and the old hardcoded `top` put this 14px underneath it. -->
{#snippet railExtra()}
  {#if slice.primary.services || media.showToggle}
    <div class="flex flex-col items-start gap-2.5">
      {#if slice.primary.services}
        <p class="font-sans text-base leading-normal font-light text-black">
          {slice.primary.services}
        </p>
      {/if}

      {#if media.showToggle}
        <button
          type="button"
          role="switch"
          aria-checked={showingAfter}
          onclick={(event) => {
            // Stopped so a future wrapping <a> cannot hijack the switch. There
            // is no longer a stretched link over this band to bubble into — see
            // the note at the end of this file for why it was removed.
            event.stopPropagation();
            showBefore = !showBefore;
          }}
          class="pointer-events-auto flex items-center gap-2.5 rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <!-- Static accessible name. The visible word is the STATE (already
                 exposed via aria-checked) — if it were the name, the control
                 would rename itself on every press and read as a new widget. -->
          <span class="sr-only">Show the after image</span>
          <!-- Rebuilt from Figma's np_toggle-on SVG as CSS because the file
                 only contains the ON state: 40.4x20 pill, 1.84px ring, 12.84px
                 knob sitting 3.38px inside the outer edge, recoloured LP red
                 #E31937 → token primary. OFF mirrors ON (knob left). `left` is
                 1.54px because an absolute child is offset from the PADDING
                 box, i.e. already inside the 1.84px ring (1.54 + 1.84 = 3.38);
                 ON adds 20.81px to land the knob at Figma's x=24.19. -->
          <span
            aria-hidden="true"
            class="relative block h-5 w-[40.4px] shrink-0 rounded-full border-[1.84px] border-primary"
          >
            <span
              class="absolute top-1/2 left-[1.54px] block h-[12.84px] w-[12.84px] -translate-y-1/2 rounded-full bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none {showingAfter
                ? 'translate-x-[20.81px]'
                : ''}"
            ></span>
          </span>
          <span aria-hidden="true" class="type-eyebrow text-primary">
            {showingAfter ? "after" : "before"}
          </span>
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

<!-- Declared at template top level, NOT inside <Slideshow>: a snippet written as
     a direct child of a component is passed to that component as a prop, so
     nesting it there would make it invisible to the `slide` binding below. -->
{#snippet afterSlide(item: unknown, _index: number)}
  <!-- `fallbackAlt=""` is load bearing: PrismicImage emits
       `alt={alt ?? (field.alt || fallbackAlt)}`, so an image whose CMS alt text
       is blank renders an <img> with NO alt attribute at all — an axe
       `image-alt` violation. Empty alt (decorative) is the right degrade: the
       label and lead line already name the case study, and a slideshow that
       announced four near-identical packaging shots would be noise. -->
  <PrismicImage
    field={item as Content.CaseStudySlice["primary"]["after_image"]}
    fallbackAlt=""
    imgixParams={{ auto: ["format", "compress"] }}
    widths={imageWidths}
    sizes="100vw"
    loading="lazy"
    decoding="async"
    class="h-full w-full object-cover object-[50%_35%]"
  />
{/snippet}

<SliceSection
  {slice}
  class="relative w-full bg-white {pad.padTop ? 'pt-7.5' : ''} {pad.padBottom ? 'pb-7.5' : ''}"
>
  <!-- Text first in DOM so it stacks ABOVE the photo on small screens (no mobile
       frame exists in Figma, and at 375px the band is only ~216px tall — the
       overlay would not fit). From `lg` it lifts out of flow onto the photo's
       quiet top band, which is the drawn desktop design — but only when there IS
       media: with no image and no video the band has no height of its own, so an
       absolute overlay would collapse the section onto the next slice. -->
  <!-- No `pointer-events-none` now the stretched link is gone: the copy is
       selectable again. This layer only covers the photo's top band, and the
       Slideshow's controls sit at its bottom edge, so the two never overlap. -->
  {#if hasText}
    <!-- z-10, NOT z-20. The site nav is `fixed z-20` and the page content is
         rendered AFTER it in the layout, so at an equal z-index this copy won
         the tie and painted straight over the nav once the band scrolled up
         under it. z-10 still clears the media box below (position:relative,
         z-auto), so the overlay is unaffected — it just stops out-ranking the
         chrome. CaseStudy was the only slice reaching z-20; fixing it here
         beats restacking the nav on every page in the site. -->
    <div
      class="relative z-10 pt-7.5 pb-6 {media.mode === 'empty'
        ? 'lg:pb-7.5'
        : 'lg:absolute lg:inset-x-0 lg:top-0 lg:pt-8.75 lg:pb-0'}"
    >
      <RailRow label={slice.primary.label} animateIn={isAnimated} rail={railExtra}>
        {#if slice.primary.heading}
          <!-- Besley 26/1.45. Every property the global `h2`/`h3` element rules set
             is pinned, font-family included, or Besley 60/300 (h2) or Pragmatica
             80/200 (h3) leaks in depending on which tag we land on. -->
          <svelte:element this={headingTag} class="type-lede text-black lg:-mt-1.25">
            {slice.primary.heading}
          </svelte:element>
        {/if}
      </RailRow>
    </div>
  {/if}

  {#if media.mode !== "empty"}
    <!-- White, not the `band` gray the spec suggested, as the pre-load fill: the
         rail label is primary red, which clears 4.5:1 on white (5.2:1) but not
         on #E7E8EB (4.2:1), and at `lg` that fill IS the text's background until
         the photo paints. -->
    <!-- `max-h-svh` caps the band at one viewport. The 1440/831 ratio is
         the board's, but it is a RATIO on a `w-full` box, so height grows with
         width without limit: at 2560x1440 the band came out 1477px tall and the
         slideshow ran off the bottom of the screen, taking its own nav dots and
         pause control with it. Past ~1730px wide the cap takes over and the
         images simply crop a little more, which `object-cover` already handles.
         `svh` rather than `vh` so mobile browser chrome cannot push it over. -->
    <div class="relative aspect-[1440/831] max-h-svh min-h-65 w-full overflow-hidden bg-white">
      {#if media.base !== "none"}
        <div
          class="absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none {showingAfter
            ? 'opacity-100'
            : 'opacity-0'}"
          aria-hidden={showingAfter ? undefined : "true"}
        >
          {#if media.base === "before"}
            <!-- Degrade path: no after image was authored, so the BEFORE stands
                 in as the base still and there is nothing to rotate. -->
            <PrismicImage
              field={baseImage}
              fallbackAlt=""
              imgixParams={{ auto: ["format", "compress"] }}
              widths={imageWidths}
              sizes="100vw"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover object-[50%_35%]"
            />
          {:else}
            <!-- `aspectClass=""` overrides the component's `aspect-video`
                 default: this band already has its own 1440/831 box, and a
                 second aspect ratio inside it would letterbox every slide. -->
            <Slideshow slides={afterSlides} aspectClass="" hasNavDots slide={afterSlide} />
          {/if}
        </div>
      {/if}

      {#if media.showToggle}
        <div
          class="absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none {showingAfter
            ? 'opacity-0'
            : 'opacity-100'}"
          aria-hidden={showingAfter ? "true" : undefined}
        >
          <PrismicImage
            field={slice.primary.before_image}
            fallbackAlt=""
            imgixParams={{ auto: ["format", "compress"] }}
            widths={imageWidths}
            sizes="100vw"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover object-[50%_35%]"
          />
        </div>
      {/if}

      {#if media.mode === "video"}
        <!-- A vimeo id replaces the after image outright and hides the switch
             (see ./media.ts). Background loop: the design shows no play control,
             and the still above doubles as its poster. -->
        <VimeoEmbed
          {vimeoId}
          background
          hasPoster={media.base !== "none"}
          title={mediaTitle}
          class="absolute inset-0 h-full w-full"
        />
      {/if}
    </div>
  {/if}

  <!-- No stretched link over this band any more. It used to cover the whole
       section (`absolute inset-0 z-10`) so a click anywhere reached the project.
       The after state is now a Slideshow, whose prev/next and pause controls
       live inside the media layer BENEATH that overlay — they would have been
       unreachable, and an autoplaying carousel whose pause control cannot be
       clicked fails WCAG 2.2.2. A link stretched over a carousel is the wrong
       shape regardless; the board draws no CTA here, and the Revogen project is
       still reachable from the logo grid and the portfolio. -->
</SliceSection>
