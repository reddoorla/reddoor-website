<script lang='ts'>
  import { PrismicImage } from "@prismicio/svelte";

  /** @type {import("@prismicio/client").Content.ScreenWidthImageSlice} */
  export let slice;
  let viewportHeight:number;
  let viewportWidth:number;

  let backgroundColorString = 'bg-'+slice.primary.background;
  
</script>
<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />
<div class="w-full {slice.primary.hasPadding? "py-12":""} {backgroundColorString}">
{#if slice.primary.vimeoid}
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${slice.primary.vimeoid}?title=0${ slice.primary.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-screen mx-auto z-10"
	  					frameborder="0"
              allow="autoplay; fullscreen;"
					></iframe>
          {:else}
          <PrismicImage class="w-screen" field={slice.primary.image} />
  {/if}
</div>
