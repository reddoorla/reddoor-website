<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicRichText, PrismicImage } from "@prismicio/svelte";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.ValueBlockSlice } = $props();
</script>

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-screen py-12 bg-paper-red relative"
  >
    <ContentWidth>
      <div class="w-full flex flex-col xl:flex-row xl:w-full">
        <div class="w-full xl:w-1/5 h-full overflow-hidden pt-4">
          <h6 class="text-white">{slice.primary.eyebrow || ""}</h6>
        </div>
        <div class="w-full xl:w-2/5 text-white flex flex-col gap-2 p-4 rich-text">
          <h3 class="mb-4">{slice.primary.title || ""}</h3>

          <PrismicRichText field={slice.primary.body} />
        </div>
      </div>
    </ContentWidth>
    <PrismicImage
      field={slice.primary.drawn_image}
      class="w-3/5 md:w-1/3 absolute right-0 top-1/2 -translate-y-1/2 mix-blend-multiply"
    />
  </section>
{/if}
