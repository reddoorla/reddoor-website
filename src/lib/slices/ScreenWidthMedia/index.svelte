<script lang='ts'>
  import { PrismicImage } from "@prismicio/svelte";

  /** @type {import("@prismicio/client").Content.ScreenWidthImageSlice} */
  export let slice;
  let viewportHeight:number;
  let viewportWidth:number;

  let backgroundColorString = 'bg-'+slice.primary.background;

  let showVideo = false
  const handleLoad = () => showVideo = true;


</script>
<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />
{#if !slice.primary.hide}
<div class="w-full {slice.primary.hasPadding? "py-12":""} {backgroundColorString}">
{#if slice.primary.vimeoid}
          <PrismicImage class="w-screen object-cover absolute top-0 left-0 aspect-video" field={slice.primary.image} />
       
            <iframe 
	  					title="background video" 
	 					src={`https://player.vimeo.com/video/${slice.primary.vimeoid}?title=0${ slice.primary.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1":""}`}
	  					class="object-cover aspect-video w-screen mx-auto z-10 {showVideo?"opacity-0":"opacity-100"} transition-opacity duration-200"
	  					frameborder="0"
              allow="autoplay; fullscreen;"
              on:load={handleLoad}
					></iframe>
          {:else}
          <PrismicImage class="w-screen" field={slice.primary.image} />
  {/if}
</div>
{/if}
