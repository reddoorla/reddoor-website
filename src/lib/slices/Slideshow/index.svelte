<script lang="ts">
  import { createSwipeAction } from "$lib/utils/swipeAction";
  import type { SlideshowSlice } from "../../../prismicio-types";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { slice }: { slice: SlideshowSlice } = $props();

  const SLIDER_INTERVAL_IN_MS = 5000;
  const TRANSITION_DURATION_MS = 1600;

  const mediaArray = $derived(slice.primary.images);
  const tripledArray = $derived([...mediaArray, ...mediaArray, ...mediaArray]);
  const slideWidth = $derived(100 / tripledArray.length);

  let currentIndex = $state(0);
  let sliderInterval: ReturnType<typeof setInterval> | null = null;
  let isPlaying = $state(true);
  let isTransitioning = $state(false);

  const getTranslateX = (index: number) => {
    return -(index + mediaArray.length) * slideWidth;
  };

  const startAutoPlay = () => {
    if (!isPlaying) return;
    stopAutoPlay();
    sliderInterval = setInterval(() => moveSlide(1), SLIDER_INTERVAL_IN_MS);
  };

  const stopAutoPlay = () => {
    if (sliderInterval) {
      clearInterval(sliderInterval);
      sliderInterval = null;
    }
  };

  const moveSlide = (direction: number) => {
    if (isTransitioning) return;

    isTransitioning = true;
    currentIndex += direction;

    setTimeout(() => {
      if (currentIndex >= mediaArray.length) {
        currentIndex = currentIndex % mediaArray.length;
      } else if (currentIndex < 0) {
        currentIndex = mediaArray.length + (currentIndex % mediaArray.length);
      }
      isTransitioning = false;
    }, TRANSITION_DURATION_MS);

    if (isPlaying) {
      startAutoPlay();
    }
  };

  const slideLeft = () => moveSlide(-1);
  const slideRight = () => moveSlide(1);

  const handleSwipe = (
    e: CustomEvent<{ direction: "left" | "top" | "right" | "bottom" | null }>,
  ) => {
    if (e.detail.direction === "left") {
      slideRight();
    } else if (e.detail.direction === "right") {
      slideLeft();
    }
  };

  const swipe = createSwipeAction(handleSwipe);

  const togglePlayPause = () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      startAutoPlay();
    } else {
      stopAutoPlay();
    }
  };

  const goToSlide = (index: number) => {
    if (isTransitioning) return;
    currentIndex = index;
    if (isPlaying) {
      startAutoPlay();
    }
  };

  $effect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  });

  const backgroundColorString = $derived(`bg-${slice.primary.backgroundcolor}`);
  const translateX = $derived(getTranslateX(currentIndex));
  const displayIndex = $derived(
    ((currentIndex % mediaArray.length) + mediaArray.length) % mediaArray.length,
  );
</script>

{#if !slice.primary.hide}
  <div
    use:anim={{ enabled: !!slice.primary.isAnimated }}
    class="w-full py-12 {backgroundColorString}"
  >
    <ContentWidth>
      <div class="w-full flex flex-col md:flex-row md:w-full">
        <!-- Text Content -->
        <div
          class="{slice.primary.isFullContentWidth
            ? 'w-0'
            : 'w-full md:w-1/5 pb-4 md:pb-0 md:pr-4'} h-full overflow-hidden"
        >
          <h6 class="text-primary">{slice.primary.label || ""}</h6>
          <PrismicRichText field={slice.primary.body} />
        </div>

        <!-- Slideshow -->
        <div
          class="{slice.primary.isFullContentWidth
            ? 'w-full'
            : 'w-full md:w-4/5'} flex flex-row flex-wrap"
        >
          <div use:swipe class="w-full h-full relative overflow-hidden aspect-video">
            <!-- Slides Container -->
            <div
              class="flex flex-row flex-nowrap transition-transform ease-[cubic-bezier(0.25,0.1,0.25,1)]"
              style="
              width: {tripledArray.length * 100}%;
              transform: translateX({translateX}%);
              transition-duration: {isTransitioning ? TRANSITION_DURATION_MS : 0}ms;
            "
            >
              {#each tripledArray as media, i (i)}
                <div class="h-full z-0" style="width: {slideWidth}%;">
                  <PrismicImage field={media.image} class="h-full w-full object-contain" />
                </div>
              {/each}
            </div>

            <!-- Navigation Controls -->
            <div
              class="ml-8 h-6 w-[72px] flex justify-between z-10 absolute bottom-2 lg:bottom-6 left-0"
            >
              <button
                onclick={slideLeft}
                disabled={isTransitioning}
                class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-1 hover:bg-primary hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-default"
                aria-label="Previous slide"
              >
                <i
                  class="translate-y-[-1.75px] translate-x-[-0.75px] fa-solid fa-sharp fa-chevron-left scale-90"
                ></i>
              </button>

              <button
                onclick={slideRight}
                disabled={isTransitioning}
                class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle cursor-pointer transition-all duration-300 active:-translate-y-1 justify-center hover:bg-primary hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-default"
                aria-label="Next slide"
              >
                <i
                  class="translate-y-[-1.75px] translate-x-[0.75px] fa-solid fa-sharp fa-chevron-right scale-90"
                ></i>
              </button>
            </div>

            <!-- Play/Pause Button -->
            <button
              onclick={togglePlayPause}
              class="absolute bottom-2 lg:bottom-6 right-2 lg:right-6 h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-1 hover:bg-primary hover:border-primary hover:text-white"
              aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
            >
              {#if isPlaying}
                <i class="translate-y-[-1.5px] fa-solid fa-sharp fa-pause scale-90"></i>
              {:else}
                <i class="translate-y-[-1.5px] translate-x-px fa-solid fa-sharp fa-play scale-75"
                ></i>
              {/if}
            </button>

            {#if slice.primary.hasNavDots}
              <div
                class="absolute bottom-2 lg:bottom-6 left-1/2 transform -translate-x-1/2 flex gap-1.5"
              >
                {#each mediaArray as _, i (i)}
                  <button
                    onclick={() => goToSlide(i)}
                    disabled={displayIndex === i}
                    class="w-2 h-2 rounded-full transition-all duration-300 opacity-60 hover:opacity-100 {displayIndex ===
                    i
                      ? 'bg-primary'
                      : 'bg-mid'}"
                    aria-label="Go to slide {i + 1}"
                  ></button>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    </ContentWidth>
  </div>
{/if}
