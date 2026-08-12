<script lang="ts">
  import { resolvePadding } from "$lib/utils/slicePadding";
  // Static client-logo grid on the paper band: rail label + "Our Work" CTA on
  // the left, a 3-up logo grid in the wide (1004px) content column.
  //
  // Deliberately NOT $lib/components/LogoSoup.svelte. That component is driven
  // by the `logo_soup` DOCUMENT type (a site-wide singleton, so it cannot carry
  // a per-industry client list), is `h-lvh`, and adds a caption block, prev/next
  // arrows and a 500vh mobile scroll sequence this board does not draw. Its
  // desktop branch also puts interactive content inside a hover wrapper (a known
  // axe nested-interactive finding) — nothing here nests a link inside another
  // control.
  //
  // The ROLLOVER is shared behaviour, though: hovering a logo fills the whole
  // band with that client's work and drops the other eight, exactly as the board
  // draws it (frames `logo soup 4`–`13` are those hover states, one per brand).
  // Below `md` that reveal is scroll-driven instead, since touch has no hover —
  // same idea as LogoSoup's mobile sequence, but sized to this band rather than
  // a 500vh spacer (see the observer below). Reimplemented rather than imported
  // because only the interaction carries over, not the layout.
  import { asImageSrc, asLink, isFilled, type Content } from "@prismicio/client";
  import { PrismicImage, PrismicLink } from "@prismicio/svelte";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";

  let { slice }: { slice: Content.LogoGridSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

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
        hasBackground: isFilled.image(item.active_background),
        hasMobileBackground: isFilled.image(item.active_background_mobile),
        hasNegative: isFilled.image(item.logo_negative),
      })),
  );

  // -1 = nothing active. Drives the background crossfade AND the dimming of the
  // other logos, so it is one piece of state rather than two. On desktop it is
  // written by hover/focus; below `md` by the scroll observer set up further
  // down — never both, since neither input fires on the other's devices.
  let activeIndex = $state(-1);

  // The whole rollover is opt-in per document: an industry that has not been
  // given rollover art must keep rendering the plain grid rather than fading
  // logos out against nothing. Checked across the set, not per logo, so a
  // half-filled group still behaves consistently.
  const hasRollover = $derived(logos.some((item) => item.hasBackground));
  const isActive = $derived(activeIndex >= 0 && !!logos[activeIndex]?.hasBackground);

  const activate = (i: number) => {
    if (logos[i]?.hasBackground) activeIndex = i;
  };
  const clear = () => (activeIndex = -1);

  // ─── mobile: scroll-driven reveal ────────────────────────────────────────
  // Hover does not exist on touch, so without this the rollover art would never
  // appear on a phone at all. The site-wide LogoSoup solves it by advancing the
  // active brand as you scroll, and the designer's `-m` crops are cut for that
  // treatment, so this band follows it — scoped to its own height rather than
  // LogoSoup's 500vh spacer, which this layout does not have.
  //
  // Driven by IntersectionObserver, not a scroll handler: `rootMargin` of
  // -50%/-50% collapses the root box to a line across the middle of the
  // viewport, so whichever logo crosses that line is the active one. That is a
  // single cheap callback per crossing, where a scroll listener would have to
  // measure every row on every frame — the forced-reflow trap LogoSoup calls
  // out in its own handler. It also needs no scroll arithmetic, so it cannot
  // drift when the band's height changes.
  //
  // User-driven, so WCAG 2.2.2 (Pause/Stop/Hide) does not apply — nothing here
  // moves on its own.
  const MOBILE_BREAKPOINT = 768; // matches Tailwind `md` and the <picture> media below

  let viewportWidth = $state(0);
  const isMobile = $derived(viewportWidth > 0 && viewportWidth < MOBILE_BREAKPOINT);

  // Row elements, in grid order. Written by `bind:this`, so holes are possible
  // mid-render; the observer filters them.
  let rows = $state<(HTMLElement | undefined)[]>([]);

  $effect(() => {
    // Reads isMobile/hasRollover/rows to re-run when they change. It must NEVER
    // read `activeIndex` — the observer callback writes it, and an effect that
    // both reads and writes the same state re-triggers itself and takes the
    // whole scheduler down with it.
    if (!isMobile || !hasRollover) return;

    const observed = rows.filter((el): el is HTMLElement => !!el);
    if (!observed.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = observed.indexOf(entry.target as HTMLElement);
          if (i >= 0 && logos[i]?.hasBackground) activeIndex = i;
        }
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    for (const el of observed) observer.observe(el);

    return () => {
      observer.disconnect();
      // Resizing up to desktop must not strand a backdrop on screen with
      // nothing hovered to justify it.
      activeIndex = -1;
    };
  });

  /**
   * imgix srcset for a field. Hand-rolled because this band needs a `<picture>`
   * (see the markup) and PrismicImage only ever renders a bare `<img>`.
   */
  const srcset = (field: Content.LogoGridSliceDefaultPrimaryLogosItem["logo"], widths: number[]) =>
    widths.map((w) => `${asImageSrc(field, { auto: ["format", "compress"], w })} ${w}w`).join(", ");

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

<svelte:window bind:innerWidth={viewportWidth} />

<SliceSection
  {slice}
  class="relative w-screen overflow-hidden bg-paper {pad.padTop
    ? 'pt-16 md:pt-32'
    : ''} {pad.padBottom ? 'pb-16 md:pb-32' : ''}"
>
  {#if hasRollover}
    <!-- Every rollover image is rendered up front and crossfaded by opacity
         rather than swapped into one <img>: switching `src` on hover would show
         a blank band for the length of the network fetch the first time each
         brand is hovered, which is precisely when it must not.

         `aria-hidden` + empty alt throughout — this is scene-setting behind the
         logos, and the logo's own link already names the brand. Nothing here is
         focusable, so it never enters the tab order. -->
    <div class="absolute inset-0 z-0" aria-hidden="true">
      {#each logos as item, i (i)}
        {#if item.hasBackground}
          <!-- `<picture>`, not PrismicImage, so the portrait crop is chosen by
               the BROWSER from a media query. Switching the field on the JS
               `isMobile` flag instead — as LogoSoup does — makes the server
               render the landscape set every time, so a phone downloads all
               nine landscape backdrops and then all nine portrait ones after
               hydration. Here only the matching set is ever requested, and it
               is right on the first paint, before any JS runs.

               `<picture>` is unstyled and unpositioned, so `absolute inset-0`
               on the inner <img> still resolves against the section. -->
          <picture>
            {#if item.hasMobileBackground}
              <source
                media="(max-width: {MOBILE_BREAKPOINT - 0.02}px)"
                srcset={srcset(item.active_background_mobile, [540, 720, 1080])}
                sizes="100vw"
              />
            {/if}
            <img
              src={asImageSrc(item.active_background, {
                auto: ["format", "compress"],
                w: 1280,
              }) ?? ""}
              srcset={srcset(item.active_background, [960, 1280, 1920])}
              sizes="100vw"
              alt=""
              loading="lazy"
              decoding="async"
              class="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-fast-slow motion-reduce:transition-none {activeIndex ===
              i
                ? 'opacity-100'
                : 'opacity-0'}"
            />
          </picture>
        {/if}
      {/each}
    </div>
  {/if}

  <!-- Above the backdrop. `relative` (not just z-10) so it establishes its own
       paint order against the absolutely-positioned images. -->
  <div class="relative z-10">
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
          <h2 class="type-kicker text-primary">
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
            <!-- Handlers sit on the <li>, which is NOT interactive: putting them
               on the <a> would mean the backdrop only responds once the pointer
               reaches the logo's exact bounds, and putting an interactive
               wrapper around the link is the nested-interactive fault the
               LogoSoup component already has. `focusin`/`focusout` bubble from
               the link inside, so keyboard users get the same rollover as mouse
               users without this element being focusable itself. -->
            <li
              bind:this={rows[i]}
              class="flex h-16 min-w-0 items-center justify-center md:h-20 lg:h-24 {columnAlign[
                i % 3
              ]}"
              onmouseenter={() => activate(i)}
              onmouseleave={clear}
              onfocusin={() => activate(i)}
              onfocusout={clear}
            >
              {#if item.href}
                <!-- Accessible name comes from the brand name; the image inside is
                   then decorative so the link is announced once. A plain <a>,
                   never a button wrapping a link. -->
                <!-- No `hover:opacity-70` here any more: the rollover IS the
                   affordance, and a per-logo dim fought it — the hovered logo
                   faded at the same moment its backdrop arrived. -->
                <PrismicLink
                  field={item.link}
                  aria-label={item.name || "View project"}
                  class="relative flex h-full max-w-[220px] min-w-0 items-center transition-opacity duration-500 ease-fast-slow motion-reduce:transition-none {isActive &&
                  activeIndex !== i
                    ? 'opacity-0'
                    : 'opacity-100'}"
                >
                  <PrismicImage
                    field={item.logo}
                    alt=""
                    class="max-h-full w-auto max-w-full object-contain transition-opacity duration-300 motion-reduce:transition-none {item.hasNegative &&
                    activeIndex === i
                      ? 'opacity-0'
                      : 'opacity-100'}"
                    imgixParams={{ auto: ["format", "compress"] }}
                    widths={[220, 440, 660]}
                    sizes="220px"
                    loading="lazy"
                    decoding="async"
                  />
                  {#if item.hasNegative}
                    <!-- Stacked and crossfaded rather than swapped on the same
                       <img>: a knockout logo only exists for brands whose
                       rollover art is dark, and swapping `src` mid-hover would
                       blink. Both are decorative — the link is already named. -->
                    <PrismicImage
                      field={item.logo_negative}
                      alt=""
                      class="absolute inset-0 max-h-full w-auto max-w-full object-contain transition-opacity duration-300 motion-reduce:transition-none {activeIndex ===
                      i
                        ? 'opacity-100'
                        : 'opacity-0'}"
                      imgixParams={{ auto: ["format", "compress"] }}
                      widths={[220, 440, 660]}
                      sizes="220px"
                      loading="lazy"
                      decoding="async"
                    />
                  {/if}
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
                  class="max-h-full w-auto max-w-[220px] min-w-0 object-contain transition-opacity duration-500 ease-fast-slow motion-reduce:transition-none {isActive &&
                  activeIndex !== i
                    ? 'opacity-0'
                    : 'opacity-100'}"
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
  </div>
</SliceSection>
