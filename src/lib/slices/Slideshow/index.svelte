<script lang="ts">


  import { onMount } from "svelte";
  import { swipe } from "svelte-gestures";
  import type { SlideshowSlice } from "../../../prismicio-types";
  import chevronLeft from "../../assets/icons/chevron-left.svg";
  import chevronRight from "../../assets/icons/chevron-right.svg";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

    
  export let slice:SlideshowSlice;



const mediaArray = slice.primary.images;

  const SLIDER_INTERVAL_IN_MS = 5000;
  let sliderIndex = 0;
  let sliderInterval: NodeJS.Timeout;
  let sliderWidth = 100 / mediaArray.length / 5;
  let isSlideAnimated = true;


  const resetSlider = () => {
    setTimeout(() => isSlideAnimated = false, 500);
    setTimeout(() => sliderIndex = mediaArray.length, 520);
    setTimeout(() => isSlideAnimated = true, 540);
  }

  const slideLeft = () => {
      sliderIndex++;
      clearInterval(sliderInterval);
    sliderInterval = setInterval(()=>slideLeft(), SLIDER_INTERVAL_IN_MS);
      if(sliderIndex%mediaArray.length==0&&sliderIndex!==0) 
          resetSlider();
  }

  const slideRight = () => {
    sliderIndex--;
    clearInterval(sliderInterval);
    
sliderInterval = setInterval(()=>slideRight(), SLIDER_INTERVAL_IN_MS);
  if(sliderIndex%mediaArray.length==0&&sliderIndex!==0 && sliderIndex<0)
      resetSlider();

      console.log(sliderIndex);
  }

  const handleSwipe = (e:CustomEvent<{ direction: "left" | "top" | "right" | "bottom"; target: EventTarget; }>) => {
    if(e.detail.direction==="left") 
      slideLeft();

      if(e.detail.direction==="right") 
      slideRight();
  }

  let backgroundColorString = 'bg-'+slice.primary.backgroundcolor;

  onMount(() => {
    sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);
  });

  const quintupledPropsArray = [...mediaArray, ...mediaArray, ...mediaArray, ...mediaArray, ...mediaArray];
</script>

<div class="w-full py-12 {backgroundColorString}">
  <ContentWidth>

    <div class="w-full flex flex-col md:flex-row md:w-full">
      <div class="{slice.primary.isFullContentWidth? "w-0":"w-full md:w-1/5"} h-full overflow-hidden">
        <h6 class="text-primary">{slice.primary.label||''}</h6>
        <PrismicRichText field={slice.primary.body} />
      </div>
      <div class="{slice.primary.isFullContentWidth? "w-full":"w-full md:w-4/5"} flex flex-row flex-wrap">
    <div use:swipe on:swipe={handleSwipe} class="w-full h-full relative overflow-hidden aspect-video">
      <div class="flex flex-row flex-nowrap  {isSlideAnimated ? 'transition-transform duration-500 ease-in-out' : ''}" style="width: {quintupledPropsArray.length * 100}%; transform: translateX(-{(sliderIndex+mediaArray.length) * sliderWidth}%);">
        {#each quintupledPropsArray as media, i (i)}
          <div class="h-full z-0" style="width: {sliderWidth}%;">

            <PrismicImage field={media.image} />
          </div>
        {/each}
      </div>

      <div class="ml-8 h-6 w-16 flex justify-between z-10 absolute bottom-2 lg:bottom-6 left-0">
        <button on:click={slideRight} class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-1  hover:bg-primary hover:border-primary hover:text-white">
          <i class='-translate-y-[1.5px] fa-solid fa-chevron-left' />
        </button>
        <button on:click={slideLeft} class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle cursor-pointer transition-all duration-300 active:-translate-y-1 justify-center hover:bg-primary hover:border-primary hover:text-white">
          <i class='-translate-y-[1.5px] fa-solid fa-chevron-right' />
        </button>
      </div>
    </div>
  </ContentWidth>
</div>