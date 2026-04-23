<script lang='ts'>
    import { onMount } from "svelte";
    import { createSwipeAction } from "$lib/utils/swipeAction";
    import placeholder from "../../assets/images/background_placeholder.svg";
    import ContentWidth from "../ContentWidth/ContentWidth.svelte";
    import FourByThreeImage from "../FullWidth/FourByThreeImage.svelte";
    import chevronLeft from "$lib/assets/icons/chevron-left.svg"
    import chevronRight from "$lib/assets/icons/chevron-right.svg"

    interface Props {
        imageArray?: string[];
        altText?: string;
        class?: string;
    }

    let {
        imageArray = [placeholder, placeholder, placeholder, placeholder],
        altText = "background image",
        class: className = ''
    }: Props = $props();

    const SLIDER_TRANSITION_LENGTH_IN_MS = 2000;
    const SLIDER_INTERVAL_IN_MS = 5000;

    // svelte-ignore state_referenced_locally
    let sliderIndex = $state(imageArray.length - 1);
    let isSlideAnimated = $state(true);

    const resetSliderToStart = () => {
        setTimeout(() => isSlideAnimated = false, SLIDER_TRANSITION_LENGTH_IN_MS);
        setTimeout(() => sliderIndex = 0, SLIDER_TRANSITION_LENGTH_IN_MS + 20);
        setTimeout(() => isSlideAnimated = true, SLIDER_TRANSITION_LENGTH_IN_MS + 40);
    };

    const resetSliderToEnd = () => {
        setTimeout(() => isSlideAnimated = false, SLIDER_TRANSITION_LENGTH_IN_MS);
        setTimeout(() => sliderIndex = imageArray.length - 1, SLIDER_TRANSITION_LENGTH_IN_MS + 20);
        setTimeout(() => isSlideAnimated = true, SLIDER_TRANSITION_LENGTH_IN_MS + 40);
    };

    const slideRight = () => {
        sliderIndex++;
        clearInterval(sliderInterval);
        sliderInterval = setInterval(() => slideRight(), SLIDER_INTERVAL_IN_MS);
        if (sliderIndex == imageArray.length)
            resetSliderToStart();
    };
    const slideLeft = () => {
        sliderIndex--;
        clearInterval(sliderInterval);
        sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);
        if (sliderIndex < 0)
            resetSliderToEnd();
    };

    let sliderInterval: ReturnType<typeof setInterval>;

    const handleSwipe = (e: CustomEvent<{ direction: "left" | "top" | "right" | "bottom" | null }>) => {
        if (e.detail.direction === "left") slideRight();
        if (e.detail.direction === "right") slideLeft();
    };

    const swipe = createSwipeAction(handleSwipe);

    const progressPosistion = $derived(sliderIndex * 100);
    const progressWrapForwardPosition = $derived(sliderIndex == imageArray.length ? 0 : 100);
    const progressWrapBackwardPosition = $derived(sliderIndex == -1 ? imageArray.length * 100 - 100 : imageArray.length * 100);

    onMount(() => {
        sliderInterval = setInterval(() => slideLeft(), SLIDER_INTERVAL_IN_MS);
        return () => clearInterval(sliderInterval);
    });

    const tripledImages = $derived([...imageArray, ...imageArray, ...imageArray]);
</script>

<section class="pb-32 {className}">
    <div use:swipe class="h-[320px] py-2 relative" >
    <div  class="h-full flex flex-row flex-nowrap {isSlideAnimated ? 'transition-transform duration-2000': ''}"
    style= "width:{352*tripledImages.length}px; margin-left:calc(50vw - 176px); transform:translateX({-(sliderIndex+imageArray.length)*352}px); ">


        {#each tripledImages as _image, i (i)}
        <div class="w-[360px] h-full mx-4">
            <FourByThreeImage alt={altText} class="h-full object-cover -z-10"/>
        </div>
        {/each}


    </div>
    <div class="absolute flex justify-center w-full bottom-0 left-0">
      <ContentWidth class="h-full relative w-full">
        <div class="h-2 w-5/6 m-auto bg-light rounded-full relative overflow-hidden translate-y-[16px]">
          <div class="h-full rounded-full absolute top-0 right-0 bg-dark {isSlideAnimated ? 'transition-transform duration-2000': ''}" style="width:{1/imageArray.length*100}%; transform:translateX({-progressPosistion}%);"></div>
          <div class="h-full rounded-full absolute top-0 right-0 bg-dark {isSlideAnimated ? 'transition-transform duration-2000': ''}" style="width:{1/imageArray.length*100}%; transform:translateX({progressWrapForwardPosition}%);"></div>
          <div class="h-full rounded-full absolute top-0 right-0 bg-dark {isSlideAnimated ? 'transition-transform duration-2000': ''}" style="width:{1/imageArray.length*100}%; transform:translateX({-progressWrapBackwardPosition}%);"></div>
        </div>

        <button onclick={slideLeft} class="absolute -left-2 h-6 w-6 rounded-full border-[#C2D1D9] border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-500 hover:bg-[#424B5A] hover:border-[#424B5A] active:bg-black bump" aria-label="Previous image">
          <img alt='chevron-left' src={chevronLeft} class='-translate-x-px' />
        </button>
        <button onclick={slideRight} class="absolute -right-2  translate-y-[-0.7px] h-6 w-6 rounded-full border-[#C2D1D9] border-2 p-1 flex align-middle cursor-pointer transition-all duration-500 justify-center hover:bg-[#424B5A] hover:border-[#424B5A] active:bg-black bump" aria-label="Next image">
          <img alt='chevron-right' src={chevronRight} class='translate-x-px ' />
        </button>
      </ContentWidth>

    </div>
</div>
</section>
