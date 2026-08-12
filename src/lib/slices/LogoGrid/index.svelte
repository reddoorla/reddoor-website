<script lang="ts">
  // Static client-logo grid on the paper band: rail label + "Our Work" CTA on
  // the left, a 3-up logo grid in the wide (1004px) content column.
  //
  // Deliberately NOT $lib/components/LogoSoup.svelte. That component is driven
  // by the `logo_soup` DOCUMENT type (not a slice), is `h-lvh`, and carries the
  // hover/scroll chrome this design does not draw — full-bleed background photo
  // swap, negative-logo crossfade, caption block, prev/next arrows, and a 500vh
  // mobile scroll sequence. Its desktop branch also puts interactive content
  // inside a hover wrapper (a known axe nested-interactive finding); nothing
  // here nests a link inside another control. Only its per-logo markup idiom is
  // reused.
  import { asLink, isFilled, type Content } from "@prismicio/client";
  import { PrismicImage, PrismicLink } from "@prismicio/svelte";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";

  let { slice }: { slice: Content.LogoGridSlice } = $props();

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // Drop image-less rows up front rather than guarding inside the each: an
  // empty cell would still consume a grid track and shift every logo after it
  // out of the left/centre/right column rhythm below.
  const logos = $derived(
    (slice.primary.logos ?? [])
      .filter((item) => isFilled.image(item.logo))
      // Resolve each link up front and gate the <a> on the URL rather than on
      // `isFilled`: a relationship to an unpublished project keeps its id, so it
      // reads as filled but resolves to null, and PrismicLink coerces that to
      // `<a href="">` — a logo that navigates back to the current page.
      .map((item) => ({
        ...item,
        href: isFilled.link(item.link) ? (asLink(item.link) ?? "") : "",
      })),
  );

  const ctaHref = $derived(asLink(slice.primary.link) ?? "");
  // Link is authored with text (allowText); fall back to the design's copy so a
  // link saved without a label never renders a blank button.
  const ctaText = $derived(slice.primary.link?.text || "Our Work");

  // The board flushes the outer columns with the content column's edges and
  // centres the middle one (equal 220px outer cells, `justify-between`).
  // Full literal strings — a composed `lg:justify-${x}` is invisible to
  // Tailwind's scanner.
  const columnAlign = ["lg:justify-start", "lg:justify-center", "lg:justify-end"];
</script>

<SliceSection {slice} class="w-screen bg-paper py-16 md:py-32">
  <RailRow wide animateIn={isAnimated}>
    <!-- Label + CTA belong together in the left rail, and RailRow renders only
         a bare label there — so the pair lives here and is lifted into the (then
         empty) rail column on lg. RailRow's ContentWidth is `relative`, and its
         content-box left edge IS the rail's left edge, so `left-0` lands exactly
         on the 240px rail track. Below lg it stays in flow above the grid, which
         is RailRow's own stacking order. -->
    <div class="mb-10 lg:absolute lg:top-0 lg:left-0 lg:mb-0 lg:w-[240px]">
      {#if slice.primary.label}
        <!-- Section heading. `font-sans` + every size property is pinned: the
             global `h2` element rule is Besley 60px and leaks its family in
             even when the size is overridden. -->
        <h2 class="font-sans text-base font-bold leading-normal text-primary">
          {slice.primary.label}
        </h2>
      {/if}
      {#if ctaHref}
        <DefaultButton red filled={false} href={ctaHref} text={ctaText} class="mt-5" />
      {/if}
    </div>

    {#if logos.length}
      <ul
        class="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:gap-y-20 lg:grid-cols-3 lg:gap-x-10 xl:gap-y-[150px]"
      >
        <!-- Keyed by index: `name` is optional and non-unique (the same client
             pasted twice would throw each_key_duplicate). -->
        {#each logos as item, i (i)}
          <li
            class="flex h-16 min-w-0 items-center justify-center md:h-20 lg:h-24 {columnAlign[
              i % 3
            ]}"
          >
            {#if item.href}
              <!-- Accessible name comes from the brand name; the image inside is
                   then decorative so the link is announced once. A plain <a>,
                   never a button wrapping a link. -->
              <PrismicLink
                field={item.link}
                aria-label={item.name || "View project"}
                class="flex h-full max-w-[220px] min-w-0 items-center hover:opacity-70 motion-safe:transition-opacity motion-safe:duration-300"
              >
                <PrismicImage
                  field={item.logo}
                  alt=""
                  class="max-h-full w-auto max-w-full object-contain"
                  imgixParams={{ auto: ["format", "compress"] }}
                  widths={[220, 440, 660]}
                  sizes="220px"
                  loading="lazy"
                  decoding="async"
                />
              </PrismicLink>
            {:else}
              <!-- `min-w-0` on both branches: a replaced flex item's automatic
                   minimum size is min(intrinsic, max-width) = 220px, so without
                   it the logo refuses to shrink and spills into the 40px column
                   gutter roughly between 1024px and 1086px, where the 3-up
                   tracks inside the wide rail column are narrower than 220px.

                   Alt text comes from the image field's own alt in Prismic;
                   PrismicImage's `alt` prop only accepts "" (it marks an image
                   decorative), so a per-item alt cannot be passed through it.
                   `fallbackAlt=""` keeps an alt-less asset valid rather than
                   throwing, and the modelled `name` then supplies the missing
                   accessible name as sr-only text — nothing else in this grid
                   names the brand. Only one of the two ever renders, so the
                   logo is never announced twice. -->
              <PrismicImage
                field={item.logo}
                fallbackAlt=""
                class="max-h-full w-auto max-w-[220px] min-w-0 object-contain"
                imgixParams={{ auto: ["format", "compress"] }}
                widths={[220, 440, 660]}
                sizes="220px"
                loading="lazy"
                decoding="async"
              />
              {#if !item.logo.alt && item.name}
                <span class="sr-only">{item.name}</span>
              {/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </RailRow>
</SliceSection>
