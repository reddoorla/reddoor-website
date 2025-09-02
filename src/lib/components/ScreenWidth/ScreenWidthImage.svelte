<script lang="ts">
  import type { ImageField } from "@prismicio/client";
  import placeholder from "../../assets/images/background_placeholder.svg";
  import { PrismicImage } from "@prismicio/svelte";
  
  export let src = '';
  export let field = undefined;
  export let altText = "background image";
  export let placeholderSide = "right";
  export let vimeoId = "";
  export let darken = false;
  export let backdrop = false;
  
  let viewportHeight: number = 1024;
  let viewportWidth: number = 768;
  let videoLoaded = false;
  let showVideo = false;
  
  function handleVideoLoad() {
    videoLoaded = true;

	console.log('loaded')
    // Quick fade transition
    setTimeout(() => {
      showVideo = true;
    }, 100);
  }

  const handleVideoError = (error:any) => {
	console.log(error);
	showVideo=false;

  }
  
  // Fallback timeout - hide video if it doesn't load
  let timeoutId: NodeJS.Timeout;
  
  $: if (vimeoId) {
    timeoutId = setTimeout(() => {
      if (!videoLoaded) {
        showVideo = false;
      }
    }, 8000); // 8 second timeout
  }
  
  // Clear timeout when component is destroyed
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
</script>

<svelte:window
  bind:innerHeight={viewportHeight}
  bind:innerWidth={viewportWidth}
/>

<section
  class="h-screen w-screen overflow-clip {$$props.class || ''}
  {backdrop
    ? 'fixed -z-10 top-0 left-0'
    : 'relative'}"
>
  <div
    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video
    {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full': 'w-screen min-h-full'}"
  >
    <!-- Image fallback - always present -->
    {#if !field}
      <img
        {src}
        alt={altText}
        class="absolute bottom-0 {placeholderSide}-0 h-full w-full object-cover -z-10
        {src === placeholder ? 'lg:w-[45%] md:h-auto' : ''}
        {showVideo ? 'transition-opacity duration-300 opacity-0' : 'opacity-100'}"
      />
    {:else}
      <PrismicImage
        {field}
        class="absolute h-full w-full object-cover -z-10
        {showVideo ? 'transition-opacity duration-300 opacity-0' : 'opacity-100'}"
      />
    {/if}

    <!-- Video - only show if vimeoId exists and hasn't failed -->
    {#if vimeoId}
      <iframe
        title="background video"
        src={`https://player.vimeo.com/video/${vimeoId}?background=1&muted=1&loop=1&autoplay=1`}
        class="aspect-video absolute {viewportHeight * 16 > viewportWidth * 9
          ? 'h-screen min-w-full'
          : 'w-screen min-h-full'} contrast-[1.15] -z-10
        {showVideo ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300"
        frameborder="0"
        allowfullscreen
        on:load={handleVideoLoad}
		on:error={handleVideoError}
      ></iframe>
    {/if}

    {#if darken}
      <div
        class="bg-darken-gradient pointer-events-none absolute w-full h-full top-0 left-0 -z-10"
      ></div>
    {/if}
  </div>
  <slot/>
</section>

<style>
  .bg-darken-gradient {
    background: linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0.45) 100%
    );
  }
</style>