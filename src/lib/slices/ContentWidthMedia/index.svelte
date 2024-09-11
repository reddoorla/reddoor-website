<script lang='ts'>
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";


 import type { ContentWidthImageSlice } from "../../../prismicio-types";
  import { isFilled } from "@prismicio/client";
  export let slice:ContentWidthImageSlice;
  let backgroundColorString = 'bg-'+slice.primary.background;

  let videoId="";


</script>

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="w-screen {slice.primary.hasPadding? "py-12" : ""} {backgroundColorString}"
>
<ContentWidth>
  <div class="w-full flex flex-col {slice.primary.isFullContentWidth?"":"md:flex-row"}">
    <div class="{slice.primary.isFullContentWidth? "w-full":"w-full md:w-1/5"} h-full overflow-hidden pr-6">
      <h6 class="text-primary">{slice.primary.label||''}</h6>
      <PrismicRichText field={slice.primary.body} />
    </div>
    <div class="{slice.primary.isFullContentWidth? "w-full":"w-full md:w-4/5"} flex flex-row justify-center flex-wrap">
        
      
        {#each slice.primary.images as item}
        {#if isFilled.link(item.link)}
        <a href={item.link.url} class="{slice.primary.hasGap ? "pr-6 pb-6" : ""} relative w-full flex flex-col items-center justify-start cursor-pointer {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8 cursor-pointer">{item.label}</div>
          {/if}
          {#if item.vimeoid}
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoid}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-full mx-auto z-10"
	  					frameborder="0"
              allow="autoplay"
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover cursor-pointer" field={item.image} />
  
          {/if}
          </a>
        {:else}
        
        <div class="{slice.primary.hasGap ? "pr-6 pb-6" : ""} relative w-full flex flex-col items-center justify-start {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
          {/if}
          {#if item.vimeoid}
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoid}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-full mx-auto z-10"
	  					frameborder="0"
              allow="autoplay"
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover" field={item.image} />
  
          {/if}
          </div>
          {/if}
        {/each}
      
    </div>
  </div>
</ContentWidth>
  
</section>
