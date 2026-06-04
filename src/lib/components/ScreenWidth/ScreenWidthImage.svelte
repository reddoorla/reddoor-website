<script lang="ts">
  import placeholder from "../../assets/images/background_placeholder.svg";
  import { PrismicImage } from "@prismicio/svelte";
  import Img from "$lib/components/Img.svelte";
  import type { Snippet } from "svelte";
  import type { ImageField } from "@prismicio/client";

  interface Props {
    src?: string;
    img?: unknown;
    field?: ImageField | undefined;
    altText?: string;
    placeholderSide?: string;
    vimeoId?: string;
    darken?: boolean;
    backdrop?: boolean;
    alt?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    src = "",
    img,
    field = undefined,
    altText = "background image",
    placeholderSide = "right",
    vimeoId = "",
    darken = false,
    backdrop = false,
    alt = "",
    class: className = "",
    children,
  }: Props = $props();

  let viewportHeight = $state(1024);
  let viewportWidth = $state(768);
  let showVideo = $state(true);

  const handleVideoError = () => {
    showVideo = false;
  };
</script>

<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />

<section
  class="h-screen w-screen overflow-clip {className}
  {backdrop ? 'fixed -z-10 top-0 left-0' : 'relative'}"
>
  <div
    class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video
    {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'}"
  >
    <!-- Image fallback - always present -->

    {#if img}
      <Img
        src={img}
        alt={alt || altText}
        class="absolute bottom-0 {placeholderSide}-0 h-full w-full object-cover -z-10"
      />
    {:else if !field && src}
      <img
        {src}
        alt={alt || altText}
        class="absolute bottom-0 {placeholderSide}-0 h-full w-full object-cover -z-10
        {src === placeholder ? 'lg:w-[45%] md:h-auto' : ''}
        "
      />
    {:else}
      <PrismicImage {field} class="absolute h-full w-full object-cover -z-10" />
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
        onerror={handleVideoError}
      ></iframe>
    {/if}

    {#if darken}
      <div
        class="bg-darken-gradient pointer-events-none absolute w-full h-full top-0 left-0 -z-10"
      ></div>
    {/if}
  </div>
  {@render children?.()}
</section>

<style>
  .bg-darken-gradient {
    background: linear-gradient(0deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.45) 100%);
  }

  img:not([src]) {
    font-size: 0; /* Hide the alt text visually */
    position: relative; /* Establish a positioning context for the pseudo-element */
  }

  img:not([src])::after {
    content: ""; /* Or a custom fallback message */
    display: block;
    font-size: 1rem; /* Reset font size for the custom content */
  }
</style>
