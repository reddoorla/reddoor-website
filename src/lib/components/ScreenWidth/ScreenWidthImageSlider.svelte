<script lang='ts'>
    import { onMount } from "svelte";
    import { createSwipeAction } from "$lib/utils/swipeAction";
    import placeholder from "../../assets/images/background_placeholder.svg";
    import ContentWidth from "../ContentWidth/ContentWidth.svelte";
    import chevronLeft from "$lib/assets/icons/chevron-left.svg"
    import chevronRight from "$lib/assets/icons/chevron-right.svg"
    import type { Snippet } from 'svelte';

    interface Props {
        imageArray?: string[];
        altText?: string;
        dotFloat?: string;
        hasArrows?: boolean;
        children?: Snippet;
    }

    let {
        imageArray = [placeholder, placeholder, placeholder, placeholder],
        altText = "background image",
        dotFloat = "left",
        hasArrows = false,
        children
    }: Props = $props();

    const SLIDER_TRANSITION_LENGTH_IN_MS = 2000;
    const SLIDER_INTERVAL_IN_MS = 5000;

    let sliderIndex = $state(0);
    let isSlideAnimated = $state(true);

    const resetSlider = () => {
        setTimeout(() => isSlideAnimated = false, SLIDER_TRANSITION_LENGTH_IN_MS);
        setTimeout(() => sliderIndex = sliderIndex % imageArray.length, SLIDER_TRANSITION_LENGTH_IN_MS + 20);
        setTimeout(() => isSlideAnimated = true, SLIDER_TRANSITION_LENGTH_IN_MS + 40);
    };

    const slideLeft = () => {
        sliderIndex++;
        if (sliderIndex % imageArray.length == 0 && sliderIndex !== 0)
            resetSlider();
    };
    const slideRight = () => {
        sliderIndex--;
        if (sliderIndex % imageArray.length == 0 && sliderIndex !== 0)
            resetSlider();
    };

    const setSliderIndex = (index: number) => {
        sliderIndex = index;
        clearInterval(sliderInterval);
        sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);
    };

    let sliderInterval: ReturnType<typeof setInterval>;

    const handleSwipe = (e: CustomEvent<{ direction: "left" | "top" | "right" | "bottom" | null }>) => {
        if (e.detail.direction === "left") slideLeft();
        if (e.detail.direction === "right") slideRight();
    };

    const swipe = createSwipeAction(handleSwipe);

    onMount(() => {
        sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);
        return () => clearInterval(sliderInterval);
    });

    const tripledImages = $derived([...imageArray, ...imageArray, ...imageArray]);
</script>

<section>
    <div use:swipe class="h-[160vw] sm:h-[90vw] xl:h-[60vw] lg:max-h-screen relative overflow-hidden" >
    <div  class="h-full flex flex-row flex-nowrap {isSlideAnimated ? 'transition-transform duration-2000': ''}"
    style= "width:{100*tripledImages.length}vw; transform:translateX({-(sliderIndex+imageArray.length)*100}vw); ">


        {#each tripledImages as image, i (i)}
        <div class="w-screen">
            <img src={image} alt={altText} class=" h-full w-full object-cover -z-10"/>
        </div>
        {/each}


    </div>
    <div class="absolute flex justify-center w-full h-full top-0 left-0">
        <ContentWidth class="h-full relative w-full">
        {@render children?.()}
        <div class="absolute h-10 flex align-middle justify-start {dotFloat === "left" ? "left-[4%]  xl:left-8" : ""} {dotFloat === "left" ? "left-[4%]  xl:left-8 translate-x-[2px]" : ""} {dotFloat === "right" ? "right-[4%]  xl:right-8 translate-x-[-2px]" : ""} {dotFloat === "center" ? "left-1/2 -translate-x-1/2" : ""}  bottom-10">
            {#each  imageArray as _image, i (i)}
                <button class="h-[10px] w-[10px] border-2  rounded-full transition-colors duration-1000 cursor-pointer active:translate-y-[-0.5px] hover:opacity-60 mr-4
                                {(sliderIndex%imageArray.length>=0&&sliderIndex%imageArray.length===i)|| (sliderIndex%imageArray.length<=0&&imageArray.length+sliderIndex%imageArray.length===i) ? "bg-dark border-dark" : "border-light"}"
                    onclick={()=>setSliderIndex(i)}
                    aria-label="image {i} of {imageArray.length}"
                ></button>
            {/each}
        </div>

    </ContentWidth>
        {#if hasArrows}
            <button onclick={slideRight} class="absolute top-1/2 -translate-y-1/2 left-6" aria-label="Previous image"><img src={chevronLeft} alt="" class="w-3 md:w-4" /></button>
            <button onclick={slideLeft} class="absolute top-1/2 -translate-y-1/2 right-6" aria-label="Next image"><img src={chevronRight} alt="" class="w-3 md:w-4" /></button>
        {/if}
    </div>
</div>
</section>
