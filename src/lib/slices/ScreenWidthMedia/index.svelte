<script lang='ts'>
  import { PrismicImage } from "@prismicio/svelte";

  /** @type {import("@prismicio/client").Content.ScreenWidthImageSlice} */
  export let slice;
  let viewportHeight:number;
  let viewportWidth:number;
</script>
<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />

<PrismicImage field={slice.primary.image} class="object-cover aspect-video {viewportHeight * 16 > viewportWidth * 9 ? 'h-screen min-w-full' : 'w-screen min-h-full'}"/>
