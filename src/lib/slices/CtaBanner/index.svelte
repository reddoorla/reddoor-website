<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";
  import { asLink } from "@prismicio/client";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.CtaBannerSlice } = $props();

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);
  const padding = $derived(resolvePadding(slice.primary));

  // Full literal class strings so Tailwind's scanner keeps them; `bg-paper`
  // and `bg-paper-red` are app.css classes, the rest are utilities.
  const background = $derived(slice.primary.background ?? "paper-red");
  const backgroundClass = $derived(
    (
      {
        white: "bg-white",
        gray: "bg-gray",
        red: "bg-red",
        paper: "bg-paper",
        "paper-red": "bg-paper-red",
      } as Record<string, string>
    )[background] ?? "bg-paper-red",
  );

  // The two red grounds carry white type; the light grounds carry black.
  const isDarkGround = $derived(background === "red" || background === "paper-red");

  const href = $derived(asLink(slice.primary.buttonLink) ?? "");
  // Gate on the resolved URL, not `isFilled` — same guard FeaturedProject and
  // IndustryHero already apply. A document link whose target is unpublished (or
  // whose type has no route) is "filled" but resolves to null, and DefaultButton
  // renders its no-href branch as `<button onclick={() => {}}>`: this page's
  // terminal CTA would look right and silently swallow every click. Nothing in
  // the axe gate fires on a no-op button.
  const hasButton = $derived(href !== "" && !!slice.primary.buttonLabel);
</script>

<SliceSection
  {slice}
  class="w-full {backgroundClass} {padding.padTop ? 'pt-28.75' : ''} {padding.padBottom
    ? 'pb-42'
    : ''}"
>
  <!-- `md:items-baseline` sets the button's text on the headline's first
       baseline instead of on its top edge (Tim's MarkUp round on /boise, pin
       5). The two sit at the same top today, so a 14px button label rides ~19px
       above a 60px/84px headline's baseline. Stacked below `md` there is no
       row to align against, so `items-start` stays. -->
  <ContentWidth
    animateIn={isAnimated}
    class="flex flex-col items-start justify-between gap-8 md:flex-row md:items-baseline"
  >
    <div class="cta-heading max-w-189.25 {isDarkGround ? 'text-white' : 'text-black'}">
      <!-- The CMS supplies a heading2; RichTextBody normalizes the announced level
           for the page outline while the class below pins the visual. `font-sans`
           is load bearing — the global `h2` rule is Besley 60px, and without the
           family pin the serif leaks into this extra-light sans. -->
      <RichTextBody field={slice.primary.heading} />
    </div>

    {#if hasButton}
      <!-- The button is the last thing above the footer, and the second half of
           pin 5 is that it should start where the footer's link column starts.
           Both boxes end at ContentWidth's right edge, but the button is only
           as wide as its label (193px against the column's 275px at 1512), so
           its left edge floated 82px inside the footer's. The wrapper borrows
           the footer's own column width — `w-full md:w-1/3 lg:w-1/5`, the
           layout's footer column — rather than a literal px, so the two stay
           together when either changes. -->
      <div class="w-full shrink-0 md:w-1/3 lg:w-1/5">
        <DefaultButton
          {href}
          text={slice.primary.buttonLabel ?? ""}
          filled={false}
          red={!isDarkGround}
          class="uppercase tracking-[0.08em] {isDarkGround
            ? 'border-white text-white hover:bg-white hover:text-black'
            : ''}"
        />
      </div>
    {/if}
  </ContentWidth>
</SliceSection>

<style>
  /* Pragmatica Extra Light 60/1.4 — the board's CTA headline. Every property the
     global `h2` element rule sets is re-stated (family included) because that
     rule lives in @layer base and would otherwise supply Besley at its own size.
     :global reaches the heading node RichTextHeading emits. */
  .cta-heading :global(h1),
  .cta-heading :global(h2),
  .cta-heading :global(h3) {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 60px;
    font-weight: 200;
    line-height: 1.4;
    color: inherit;
  }
  @media (max-width: 1024px) {
    .cta-heading :global(h1),
    .cta-heading :global(h2),
    .cta-heading :global(h3) {
      font-size: 44px;
    }
  }
  @media (max-width: 768px) {
    .cta-heading :global(h1),
    .cta-heading :global(h2),
    .cta-heading :global(h3) {
      font-size: 34px;
      line-height: 1.3;
    }
  }
</style>
