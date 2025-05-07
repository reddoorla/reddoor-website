<script lang='ts'>
  import { PrismicImage, PrismicLink } from "@prismicio/svelte";
import type { LogoSoupDocument } from "../../prismicio-types";
  import ContentBox from "./FullWidth/ContentBox.svelte";
  import ContentWidth from "./ContentWidth/ContentWidth.svelte";
  import { fade } from "svelte/transition";
  import AnimateIn from "./AnimateIn.svelte";


    export let data;

    const brands = data.logoSoup.data.brands

    let showImage = false;
    let brandIndex = 0;

    let viewportHeight:number;
	let viewportWidth:number;

    const nextBrand = () => {
        brandIndex = (brandIndex + 1) % brands.length;
        
    }

    const prevBrand = () => {
        brandIndex = (brandIndex - 1 + brands.length) % brands.length;
    }

</script>

<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} />

<div class='h-lvh w-screen relative overflow-hidden'>
    <div
	  class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video transition-opacity duration-500
      {showImage?'':'opacity-0'}  
		{viewportHeight * 16 > viewportWidth * 9 ? 'h-lvh min-w-full': 'w-screen min-h-full'}"
	>
        {#each brands as brand, i }        
            <PrismicImage field={brand.active_background} class='absolute h-full w-full object-cover transition-opacity duration-700 ease-fast-slow {showImage&&brandIndex===i?'':'opacity-0'}' />
        {/each}
    </div>
    <ContentWidth class='h-full py-32 flex flex-row justify-end relative'>
        <AnimateIn class='absolute left-0 top-40'>
            <h6 class='åtransition duration-300 ease-fast-slow {showImage?'text-white':'text-red'}'>
                Join these brands <br/> in fighting mediocrity.
            </h6>
        </AnimateIn>
        
        <div class='w-3/5 h-full flex flex-row justify-between items-center flex-wrap gap-12'>
            {#each brands as brand, i }
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <AnimateIn class='w-1/4 relative'>
                <div  on:mouseenter={() => {showImage = true; brandIndex = i}} on:mouseleave={() => {showImage = false}}>
                    <PrismicLink field={brand.project_link}  >
                        <PrismicImage field={brand.logo_negative} class='h-full absolute transition-opacity duration-300 ease-fast-slow {showImage&&brandIndex===i?'':'opacity-0'}' loading='eager'/>
                        <PrismicImage field={brand.logo_color}  class='h-full transition-opacity duration-300 ease-fast-slow {showImage?'opacity-0':''}' loading='eager'/>
                    </PrismicLink>
                </div>
            </AnimateIn>
            {/each}
        </div>

        <!-- svelte-ignore a11y-no-static-element-interactions -->
         <AnimateIn class="absolute  bottom-[20%] left-0 w-64">
        <div class='pt-10' on:mouseenter={() => {showImage = true}} on:mouseleave={() => {showImage = false}}>
            {#key brandIndex}
                <p class='underline underline-offset-4 text-white transition duration-300 ease-fast-slow' in:fade>
                    {showImage?brands[brandIndex].name:''}
                </p>
                <p class='{showImage?'text-white':'text-red'} transition duration-300 ease-fast-slow' in:fade>
                    {showImage?brands[brandIndex].services:'Browse Our Work'}
                </p>
            {/key}
            <div class='mt-8 gap-8 flex flex-row'>
                <button on:click={prevBrand} class='{showImage?'text-white hover:text-primary':'text-primary hover:text-white'} bump'>
                    <i class='fa-sharp fa-regular fa-arrow-left fa-2xl' />        
                </button>
                <button on:click={nextBrand} class='{showImage?'text-white hover:text-primary':'text-primary hover:text-white'} bump'>
                    <i class='fa-sharp fa-regular fa-arrow-right fa-2xl' />        
                </button>
            </div>
        </div>
         </AnimateIn>
    </ContentWidth>

</div>

