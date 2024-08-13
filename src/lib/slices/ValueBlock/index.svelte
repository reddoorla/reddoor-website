<script>
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicRichText, PrismicImage } from "@prismicio/svelte";
  /** @type {import("@prismicio/client").Content.ValueBlockSlice} */
  export let slice;
</script>

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="w-screen py-12 bg-paper-red"
>
<ContentWidth>
  <div class="w-full flex flex-col md:flex-row md:w-full">
    <div class="w-full md:w-1/5 h-full overflow-hidden pt-4">
      <h6 class="text-white">{slice.primary.eyebrow||''}</h6>
    </div>
    <div class="w-full md:w-3/5 text-white flex flex-col gap-2 p-4">
        <h3 class="mb-4">{slice.primary.title||''}</h3>
    
        <PrismicRichText field={slice.primary.body} />
       

    </div>
    <PrismicImage field={slice.primary.drawn_image} class="w-3/5 md:w-1/5 absolute right-0 top-1/2 -translate-y-1/2" />
  </div>
</ContentWidth>
  
</section>