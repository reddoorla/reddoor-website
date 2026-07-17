<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.LeadTextSlice } = $props();

  // Default-on animation, matching the RichText slice's convention (null = legacy
  // docs authored before the flag existed → treat as animated).
  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);
</script>

<SliceSection {slice} class="w-full py-7.5">
  <ContentWidth animateIn={isAnimated}>
    <div class="w-full md:w-3/5 mx-auto">
      {#if slice.primary.eyebrow}
        <!-- The eyebrow names the section, so it's the section heading (h2, one
               level under the page's masthead h1). Utilities override the base
               `h2` element rule (which lives in @layer base), pinning the small
               red kicker look instead of the global 60px Besley heading. -->
        <h2 class="mb-4 font-sans text-base font-bold leading-normal text-primary">
          {slice.primary.eyebrow}
        </h2>
      {/if}
      <div class="lead-body">
        <RichTextBody field={slice.primary.body} />
      </div>
    </div>
  </ContentWidth>
</SliceSection>

<style>
  /* Serif "lead" paragraph (Besley 26) — distinct from the site's sans
     `.rich-text p` (23px). Scoped :global reaches the <p> nodes PrismicRichText
     emits (they carry no class of their own). */
  .lead-body :global(p) {
    font-family: "Besley", serif;
    font-size: 26px;
    font-weight: 400;
    line-height: 1.45;
    color: #000;
  }
  .lead-body :global(p:not(:last-child)) {
    margin-bottom: 1.25rem;
  }
  .lead-body :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .lead-body :global(a:hover) {
    color: #aa1419;
  }
  @media (max-width: 768px) {
    .lead-body :global(p) {
      font-size: 22px;
      line-height: 1.5;
    }
  }
</style>
