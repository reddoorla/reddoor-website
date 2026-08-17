<script lang="ts">
  import { resolvePadding } from "$lib/utils/slicePadding";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { isFilled, type Content, type RichTextField } from "@prismicio/client";

  let { slice }: { slice: Content.LeadTextSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

  // Default-on animation, matching the RichText slice's convention (null = legacy
  // docs authored before the flag existed → treat as animated).
  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // TYPEGEN NOTE: the "rail" variation was just added to model.json, so the
  // committed prismicio-types.d.ts still types `slice.variation` as the literal
  // "default" and knows nothing about `subBody`. Once types are regenerated,
  // `Content.LeadTextSliceRail` exists and this block collapses to a plain
  // `slice.variation === "rail"` narrowing (drop RailPrimary and both casts).
  type RailPrimary = Content.LeadTextSliceDefaultPrimary & { subBody?: RichTextField };
  const isRail = $derived((slice.variation as string) === "rail");
  const subBody = $derived((slice.primary as RailPrimary).subBody);
</script>

<SliceSection {slice} class="w-full {pad.padTop ? 'pt-7.5' : ''} {pad.padBottom ? 'pb-7.5' : ''}">
  {#if isRail}
    <!-- Landing-page grid: the eyebrow becomes the rail label (RailRow renders
         it as the section's h2, pinned to the same red kicker treatment the
         default variation uses) beside the content column. RailRow wraps
         ContentWidth itself, so there is no ContentWidth here. -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated}>
      <!-- 20px board gap between the Besley lead line and the sans paragraph.
           A `gap` rather than a margin on the second block: `body` is optional
           in Prismic, and a margin would leave an orphan 20px offset (and an
           empty `.lead-body` wrapper) on a subBody-only section. -->
      <div class="flex flex-col gap-5">
        {#if isFilled.richText(slice.primary.body)}
          <div class="lead-body">
            <RichTextBody field={slice.primary.body} />
          </div>
        {/if}
        {#if isFilled.richText(subBody)}
          <div class="sub-body">
            <RichTextBody field={subBody} />
          </div>
        {/if}
      </div>
    </RailRow>
  {:else}
    <ContentWidth animateIn={isAnimated}>
      <div class="w-full md:w-3/5 mx-auto">
        {#if slice.primary.eyebrow}
          <!-- The eyebrow names the section, so it's the section heading (h2, one
               level under the page's masthead h1). Utilities override the base
               `h2` element rule (which lives in @layer base), pinning the small
               red kicker look instead of the global 60px Besley heading. -->
          <h2 class="mb-4 type-kicker text-primary">
            {slice.primary.eyebrow}
          </h2>
        {/if}
        <div class="lead-body">
          <RichTextBody field={slice.primary.body} />
        </div>
      </div>
    </ContentWidth>
  {/if}
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

  /* Rail variation only: the landing page's "Body 1" — Pragmatica Light 21/30 —
     under the Besley lead. Every property the base `p` rule sets (18/30, weight
     200, inherited body gray) is pinned, family included, so nothing leaks in. */
  .sub-body :global(p) {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 21px;
    font-weight: 300;
    line-height: 30px;
    color: #000;
  }
  .sub-body :global(p:not(:last-child)) {
    margin-bottom: 1.25rem;
  }
  /* Preflight gives <strong> `font-weight: bolder`, which against a 300 base
     computes to a barely-visible 400 — pin the real bold. */
  .sub-body :global(strong) {
    font-weight: 700;
  }
  .sub-body :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .sub-body :global(a:hover) {
    color: #aa1419;
  }
  @media (prefers-reduced-motion: reduce) {
    .sub-body :global(a) {
      transition: none;
    }
  }
  @media (max-width: 768px) {
    /* Step down to the site's base paragraph metrics on small screens. */
    .sub-body :global(p) {
      font-size: 18px;
      line-height: 30px;
    }
  }
</style>
