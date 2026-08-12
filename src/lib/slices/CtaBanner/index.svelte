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
  <ContentWidth
    animateIn={isAnimated}
    class="flex flex-col items-start justify-between gap-8 md:flex-row"
  >
    <div class="cta-heading max-w-189.25 {isDarkGround ? 'text-white' : 'text-black'}">
      <!-- The CMS supplies a heading2; RichTextBody normalizes the announced level
           for the page outline while the class below pins the visual. `font-sans`
           is load bearing — the global `h2` rule is Besley 60px, and without the
           family pin the serif leaks into this extra-light sans. -->
      <RichTextBody field={slice.primary.heading} />
    </div>

    {#if hasButton}
      <DefaultButton
        {href}
        text={slice.primary.buttonLabel ?? ""}
        filled={false}
        red={!isDarkGround}
        class="shrink-0 uppercase tracking-[0.08em] {isDarkGround
          ? 'border-white text-white hover:bg-white hover:text-black'
          : ''}"
      />
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
