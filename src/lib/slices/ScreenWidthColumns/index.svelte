<script lang='ts'>
  import type { ScreenWidthColumnsSlice } from "../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  export let slice:ScreenWidthColumnsSlice;
  let backgroundColorString = 'bg-'+slice.primary.background;
  
  let showVideo = false
  const handleLoad = () => showVideo = true;
</script>

{#if !slice.primary.hide}

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="w-screen flex flex-row justify-center flex-wrap {slice.primary.hasPadding? "py-12" : ""} {backgroundColorString}"
>

      
        {#each slice.primary.media as item}
        {#if isFilled.link(item.link)}
        <AnimateIn isOff={slice.primary.isAnimated!==null&&!slice.primary.isAnimated} class="{slice.primary.hasGap ? "pr-6 pb-6" : ""} relative w-full flex flex-col items-center justify-start {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
        <a href={item.link.url} class="relative w-full flex flex-col items-center justify-start">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
          {/if}
          {#if item.vimeoId}
          <PrismicImage class="w-full object-cover absolute top-0 left-0" field={item.image} />
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-full mx-auto z-10 {showVideo?"opacity-0":"opacity-100"} transition-opacity duration-200"
	  					frameborder="0"
              allow="autoplay"
              on:load={handleLoad}
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover" field={item.image} />
  
          {/if}
        </a>
        </AnimateIn>
        {:else}
        
        <AnimateIn isOff={slice.primary.isAnimated!==null&&!slice.primary.isAnimated} class="{slice.primary.hasGap ? "pr-6 pb-6" : ""} relative w-full flex flex-col items-center justify-start {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
          {/if}
          {#if item.vimeoId}
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-full mx-auto z-10"
	  					frameborder="0"
              allow="autoplay"
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover" field={item.image} />
  
          {/if}
        </AnimateIn>
          {/if}
        {/each}
      
 

  
</section>
{/if}