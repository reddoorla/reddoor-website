<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import { asLink, isFilled } from "@prismicio/client";
  import type { Content } from "@prismicio/client";
  import { resolveCardLabel } from "./cardLabel";
  import { resolvePadding } from "$lib/utils/slicePadding";
  // Real bytes exported from Figma node 4821:448 (provenance + the two edits
  // are documented in the asset's own header). Inlined `?raw` rather than used
  // as an <img src> because an <img>-loaded SVG has no colour context — its
  // `currentColor` fills would paint black instead of inheriting `text-band`.
  import circleArrow from "$lib/assets/icons/industry/circle-arrow.svg?raw";

  let { slice }: { slice: Content.FeaturedProjectSlice } = $props();

  // Author-controlled band spacing (MED-16). Fallback FALSE, unlike the other
  // landing-page slices: this band ships flush in the comp, so a document that
  // predates the field must keep rendering with no section padding.
  const pad = $derived(resolvePadding(slice.primary, false));

  // See the strip in the markup: opt-in continuation of the preceding band's
  // paper texture over this section's top edge.
  const hasTextureBleed = $derived(slice.primary.hasTextureBleed ?? false);

  // Drop the asset's provenance comment: it belongs in the file, not in ~1KB of
  // markup shipped with every render. Not `$derived` — the import is static, so
  // this is a one-shot at setup rather than a reactive dependency.
  const arrowSvg = circleArrow.replace(/<!--[\s\S]*?-->/g, "").trim();

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  const title = $derived(slice.primary.title ?? "");
  const services = $derived(slice.primary.services ?? "");

  const link = $derived(slice.primary.link);
  const href = $derived(isFilled.link(link) ? (asLink(link) ?? "") : "");
  // Gate on the resolved URL, not on `isFilled` alone: a document link whose
  // target has no URL (unpublished, or a type the route resolver does not
  // cover) is "filled" but resolves to null, and `<a href="">` is a link back
  // to the current page wearing the project's name.
  const hasLink = $derived(href !== "");
  // Only web links carry `target` — content relationships and media links have
  // no such property, hence the discriminant check before reading it.
  const target = $derived(
    isFilled.link(link) && link.link_type === "Web" ? link.target : undefined,
  );
  const rel = $derived(target === "_blank" ? "noopener noreferrer" : undefined);

  // ONE link wraps the whole card and the arrow is decorative, so the link's
  // accessible name has to carry the project on its own — see cardLabel.ts.
  const accessibleName = $derived(resolveCardLabel(slice.primary.title, slice.primary.image.alt));
</script>

{#snippet plate()}
  <!-- 1018 x 658 is the comp's plate; the ratio holds at every width. -->
  <div class="fp-media relative aspect-1018/658 w-full overflow-hidden">
    <!-- `fallbackAlt=""` makes the photo decorative when no alt was authored:
         the link already carries the project name, so repeating it here would
         double-announce, and an <img> with NO alt attribute is an axe
         `image-alt` violation. An authored alt still wins and is emitted.

         Ladder tops out at 2400 = the source width (the Dropbox MSOT mockup,
         cropped to this plate by fetch-dropbox-assets). The plate maxes at
         1180px CSS, so DPR 2 wants 2360 and the old 1920 ceiling served 90%.
         Nothing above 2400 is listed: imgix would enlarge past the source. -->
    <PrismicImage
      class="h-full w-full object-cover"
      field={slice.primary.image}
      imgixParams={{ auto: ["format", "compress"] }}
      widths={[640, 960, 1280, 1600, 1920, 2400]}
      sizes="(min-width: 1566px) 1180px, (min-width: 1024px) calc(92vw - 260px), 92vw"
      loading="lazy"
      decoding="async"
      fallbackAlt=""
    />

    <!-- Not in the comp: there the caption happens to land on the photo's own
         flat khaki field, but any other project image can put white 18px type
         on light pixels. Same bottom fade the /portfolio cards already use. -->
    <div class="fp-scrim pointer-events-none absolute inset-x-0 bottom-0"></div>

    {#if title || services || hasLink}
      <div class="absolute inset-x-0 bottom-0 px-5 lg:px-[3.7%]">
        <!-- `lg:pb-[3.7%]` deliberately mirrors the wrapper's `lg:px-[3.7%]`:
             percentage padding resolves against the containing block's WIDTH, so
             the gap under the caption is the same measurement as the gap to its
             left, at every plate size (Nicole: "same amount of space on the
             bottom as on the left side"). A fixed value would only match at one
             width. Below lg the left inset is a flat 20px, which `py-5` already
             matches on the bottom. -->
        <div class="flex items-start gap-5 py-5 lg:pb-[3.7%]">
          <!-- lg:w-69.5 = the comp's fixed 278px text column; below lg it just
               takes the space the arrow leaves. -->
          <div class="flex min-w-0 flex-col gap-1 lg:w-69.5">
            {#if title}
              <!-- Caption, not a document heading: a <span> keeps this out of
                   the outline AND out of reach of app.css's global h1–h6 / p
                   element rules, so the 18/1.4 Pragmatica Light below is the
                   only thing setting the type. `font-sans` is still pinned
                   explicitly per repo convention. -->
              <span class="type-caption tracking-[0.01em] text-white uppercase">
                {title}
              </span>
            {/if}
            {#if services}
              <!-- White, not the board's `band` #E7E8EB. At 18px/300 this is
                   normal text (AA wants 4.5:1), and the caption sits on the
                   0.3-alpha scrim over an arbitrary CMS image: against the
                   shipped MSOT plate, whose caption zone is a flat khaki
                   #9F9A87 over half its area, #E7E8EB measures 4.30:1 while
                   white measures 5.27:1. The two are indistinguishable at this
                   size over a dark scrim. axe cannot flag it — it declines to
                   score text over an image. -->
              <span class="type-caption text-white">
                {services}
              </span>
            {/if}
          </div>

          {#if hasLink}
            <!-- Pure affordance for the wrapping link — never its own control. -->
            <span class="fp-arrow size-12.5 shrink-0 text-band" aria-hidden="true">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html arrowSvg}
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/snippet}

<SliceSection
  {slice}
  class="relative w-full {pad.padTop ? 'pt-7.5' : ''} {pad.padBottom ? 'pb-7.5' : ''}"
>
  {#if hasTextureBleed}
    <!-- The paper texture from the band ABOVE does not stop at that band's
         bottom edge — in the comp it runs 160px into this one and the plate sits
         on top of it (measured off the Figma render: the texture→white boundary
         is at y=508, and this section starts at y=348).

         It is drawn here rather than as an over-long background on the slice
         above because only this slice knows where its own top edge is, and the
         two are independent documents in the slice zone. It is opt-in for the
         same reason: the bleed is only right when the preceding band is paper,
         which the CMS cannot infer.

         `-inset-x-2` reproduces the comp's 8px overhang past both page edges
         (the texture frame is 1454 wide on a 1440 page); `-z-10` puts it behind
         the plate, and the section is `relative` so it anchors here. -->
    <div
      class="bg-paper pointer-events-none absolute -inset-x-2 top-0 -z-10 h-25 md:h-40"
      aria-hidden="true"
    ></div>
  {/if}
  {#if isFilled.image(slice.primary.image)}
    <!-- No `w-full` in this class list: it beats ContentWidth's own `w-[92%]`,
         which keeps the 4% page margin as width rather than as slack for
         `xl:mx-auto` to distribute — the box then ran 8% wider than the viewport
         and put a horizontal scrollbar on the page at every width below 1920.
         The inner div below is what should be full width. -->
    <ContentWidth animateIn={isAnimated} class="relative">
      <!-- Asymmetric container rather than RailRow: the comp's plate starts at
           the landing page's content column (x=342 of 1440) and bleeds all the
           way to the right page margin, which RailRow cannot express — its
           content column is capped (760px, 1004px `wide`) and would stop ~120px
           short of the gutter. `lg:pl-65` = 260px = RailRow's own geometry
           (240px rail + its gap-5 gutter), so this plate's left edge lands on
           exactly the same line as every RailRow section's content column —
           keep the two in sync if RailRow's rail ever changes. Below `lg`
           RailRow collapses its rail, so the plate goes full content width. -->
      <div class="w-full lg:pl-65">
        {#if hasLink}
          <a
            {href}
            {target}
            {rel}
            aria-label={accessibleName}
            class="fp-card relative block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {@render plate()}
          </a>
        {:else}
          <!-- No `fp-card` here on purpose: that class is the hover hook, and a
               card with no link must not animate under the cursor — motion that
               only the interactive branch has is the affordance. -->
          <div class="relative block w-full">
            {@render plate()}
          </div>
        {/if}
      </div>
    </ContentWidth>
  {/if}
</SliceSection>

<style>
  /* Bottom fade behind the caption. 0.3 max is the /portfolio card's own value
     so the two read as one system; the band is 55% tall rather than that card's
     40% because the caption is a much larger share of a short mobile plate. */
  .fp-scrim {
    height: 55%;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.3) 85%);
  }

  /* The inlined SVG needs to fill the 50px box the design gives it. */
  .fp-arrow {
    line-height: 0;
  }
  .fp-arrow :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Hover is not specified in the comp — a slow push-in on the photo plus a
     nudge on the arrow, deliberately subtle, and off entirely for reduced
     motion. Both transforms sit on the element they move (no blend or opacity
     anywhere on this card), per the mix-blend isolation gotcha. */
  @media (prefers-reduced-motion: no-preference) {
    .fp-media :global(img),
    .fp-arrow {
      transition: transform 600ms var(--transition-fast-slow);
    }
    .fp-card:hover .fp-media :global(img) {
      transform: scale(1.03);
    }
    .fp-card:hover .fp-arrow {
      transform: translateX(4px);
    }
  }
</style>
