<script lang="ts">
  import type { SlideshowSlice } from "../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
  import { isFilled } from "@prismicio/client";
  import SliceSection from "$lib/components/SliceSection.svelte";

  let { slice }: { slice: SlideshowSlice } = $props();

  const backgroundColorString = $derived(`bg-${slice.primary.backgroundcolor}`);
  const hasImages = $derived(slice.primary.images.length > 0);
  const hasText = $derived(!!slice.primary.label || isFilled.richText(slice.primary.body));
</script>

<!-- Gated on having ANY content (a truly empty just-added slice renders
     nothing), while authored label/body text still shows even before images
     are added — only the blank aspect-video band itself needs images. -->
{#if hasImages || hasText}
  <SliceSection
    {slice}
    animate={!!slice.primary.isAnimated}
    class="w-full py-12 {backgroundColorString}"
  >
    <ContentWidth>
      <div class="w-full flex flex-col md:flex-row md:w-full">
        <!-- Text Content -->
        <div
          class="{slice.primary.isFullContentWidth
            ? 'w-0'
            : 'w-full md:w-1/5 pb-4 md:pb-0 md:pr-4'} h-full overflow-hidden"
        >
          {#if slice.primary.label}
            <!-- Caption/kicker, not a section heading: non-heading <p> keeps it
                 out of the document outline. Weight 200 (body) preserves the look
                 — the old font-bold was suppressed by unlayered element rules. -->
            <p class="font-extralight text-primary">{slice.primary.label}</p>
          {/if}
          <RichTextBody field={slice.primary.body} />
        </div>

        <!-- Slideshow -->
        <div
          class="{slice.primary.isFullContentWidth
            ? 'w-full'
            : 'w-full md:w-4/5'} flex flex-row flex-wrap"
        >
          <Slideshow
            slides={slice.primary.images}
            hasNavDots={!!slice.primary.hasNavDots}
            aspectClass="aspect-video"
          >
            {#snippet slide(media)}
              <PrismicImage
                field={(media as (typeof slice.primary.images)[number]).image}
                class="h-full w-full object-contain"
                imgixParams={{ auto: ["format", "compress"] }}
                widths={[400, 640, 800, 1200, 1600]}
                sizes="(min-width: 768px) 80vw, 100vw"
                loading="lazy"
                decoding="async"
              />
            {/snippet}
          </Slideshow>
        </div>
      </div>
    </ContentWidth>
  </SliceSection>
{/if}
