<script lang='ts'>
  import type { ScreenWidthColumnsSlice } from "../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import { onMount } from "svelte";
  export let slice:ScreenWidthColumnsSlice;
  let backgroundColorString = 'bg-'+slice.primary.background;
  
  let showVideos = new Array<boolean>(slice.primary.media.length).fill(true);
  let frames = new Array<HTMLIFrameElement|undefined>(slice.primary.media.length);

  onMount(()=>{
   
  })
</script>

{#if !slice.primary.hide}

<section
  data-slice-type={slice.slice_type}
  data-slice-variation={slice.variation}
  class="w-screen flex flex-row justify-center flex-wrap relative {slice.primary.hasPadding? "py-12" : ""} {backgroundColorString}"
>

      
        {#each slice.primary.media as item, i}
        {#if isFilled.link(item.link)}
        <AnimateIn isOff={slice.primary.isAnimated!==null&&!slice.primary.isAnimated} class="{slice.primary.hasGap ? "mr-6 mb-6" : ""} relative w-full flex flex-col items-center justify-start {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
        <a href={item.link.url} class="relative w-full flex flex-col items-center justify-start">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
          {/if}
          {#if item.vimeoId}
          <PrismicImage class="w-full object-cover absolute top-0 left-0" field={item.image} />
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video relative w-full mx-auto z-10 {showVideos[i]?"opacity-100":"opacity-0"} transition-opacity duration-200"
	  					frameborder="0"
              allow="autoplay"
              bind:this={frames[i]}
              on:error={()=>showVideos[i]=false}
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover" field={item.image} />
  
          {/if}
        </a>
        </AnimateIn>
        {:else}
        
        <AnimateIn isOff={slice.primary.isAnimated!==null&&!slice.primary.isAnimated} class="{slice.primary.hasGap ? "mr-6 mb-6" : ""} relative w-full flex flex-col items-center justify-start {slice.primary.desktopcolumns==="2" ? "md:w-1/2":""} {slice.primary.desktopcolumns==="3" ? "md:w-1/3":""}">
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">{item.label}</div>
          {/if}
          {#if item.vimeoId}
          <PrismicImage class="w-full object-cover absolute top-0 left-0" field={item.image} />
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-full mx-auto z-10 relative {showVideos[i]?"opacity-100":"opacity-0"} transition-opacity duration-200"
	  					frameborder="0"
              allow="autoplay"
              bind:this={frames[i]}
              on:error={()=>showVideos[i]=false}
					></iframe>
          {:else}
          <PrismicImage class="w-full object-cover" field={item.image} />
  
          {/if}
        </AnimateIn>
          {/if}
        {/each}
      
 

  
</section>
{/if}