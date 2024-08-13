<script>
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicEmbed, PrismicImage, PrismicRichText } from "@prismicio/svelte";

  /** @type {import("@prismicio/client").Content.ContentWidthImageSlice} */
  export let slice;
  let backgroundColorString = 'bg-'+slice.primary.background;

  let videoId="";


</script>

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="w-screen py-12 {backgroundColorString}"
>
<ContentWidth>
  <div class="w-full flex flex-col md:flex-row md:w-full">
    <div class="{slice.primary.isFullContentWidth? "w-0":"w-full md:w-1/5"} h-full overflow-hidden">
      <h6 class="text-primary">{slice.primary.label||''}</h6>
      <PrismicRichText field={slice.primary.body} />
    </div>
    <div class="{slice.primary.isFullContentWidth? "w-full":"w-full md:w-4/5"} flex flex-row flex-wrap">
      
        {#each slice.primary.images as item}
        <div class="pr-6 pb-6 relative w-full flex items-center justify-center {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
          
          {#if item.vimeoid}
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoid}?title=0`}
	  					class="object-cover aspect-video w-full mx-auto z-10"
	  					frameborder="0"
						
					></iframe>
          {:else}
          <PrismicImage class="w-full" field={item.image} />
  
          {/if}
          </div>
        {/each}
      
    </div>
  </div>
</ContentWidth>
  
</section>
