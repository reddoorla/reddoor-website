<script lang="ts">
  import type { Snippet } from "svelte";
  import { createSwipeAction } from "$lib/utils/swipeAction";
  import { ChevronLeft, ChevronRight, Pause, Play } from "@lucide/svelte";

  let {
    slides,
    slide,
    aspectClass = "aspect-video",
    hasNavDots = false,
    interval = 5000,
    transitionMs = 1600,
    autoplay = true,
  }: {
    slides: unknown[];
    slide: Snippet<[unknown, number]>;
    aspectClass?: string;
    hasNavDots?: boolean;
    interval?: number;
    transitionMs?: number;
    autoplay?: boolean;
  } = $props();

  const count = $derived(slides.length);
  const isCarousel = $derived(count > 1);

  // Reduced motion: no autoplay, instant transitions. SSR-safe (client only).
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const on = () => (reduceMotion = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  const canAutoplay = $derived(autoplay && isCarousel && !reduceMotion);

  // Infinite loop via a tripled track (mirrors the original slice).
  const tripled = $derived([...slides, ...slides, ...slides]);
  const slideWidth = $derived(100 / tripled.length);

  let currentIndex = $state(0);
  let isPlaying = $state(true);
  let isTransitioning = $state(false);
  let sliderInterval: ReturnType<typeof setInterval> | null = null;

  const translateX = $derived(-(currentIndex + count) * slideWidth);
  const displayIndex = $derived(count ? ((currentIndex % count) + count) % count : 0);

  const stopAutoPlay = () => {
    if (sliderInterval) {
      clearInterval(sliderInterval);
      sliderInterval = null;
    }
  };
  const startAutoPlay = () => {
    stopAutoPlay();
    if (!isPlaying || !canAutoplay) return;
    sliderInterval = setInterval(() => moveSlide(1), interval);
  };

  const moveSlide = (direction: number) => {
    if (isTransitioning || !isCarousel) return;
    isTransitioning = true;
    currentIndex += direction;
    setTimeout(
      () => {
        if (currentIndex >= count) currentIndex = currentIndex % count;
        else if (currentIndex < 0) currentIndex = count + (currentIndex % count);
        isTransitioning = false;
      },
      reduceMotion ? 0 : transitionMs,
    );
    if (isPlaying) startAutoPlay();
  };

  const slideLeft = () => moveSlide(-1);
  const slideRight = () => moveSlide(1);
  const goToSlide = (i: number) => {
    if (isTransitioning) return;
    currentIndex = i;
    if (isPlaying) startAutoPlay();
  };
  const togglePlayPause = () => {
    isPlaying = !isPlaying;
    if (isPlaying) startAutoPlay();
    else stopAutoPlay();
  };

  const handleSwipe = (
    e: CustomEvent<{ direction: "left" | "top" | "right" | "bottom" | null }>,
  ) => {
    if (e.detail.direction === "left") slideRight();
    else if (e.detail.direction === "right") slideLeft();
  };
  const swipe = createSwipeAction(handleSwipe);

  $effect(() => {
    // Re-run when autoplay eligibility changes.
    void canAutoplay;
    void isPlaying;
    void interval;
    startAutoPlay();
    return stopAutoPlay;
  });
</script>

{#snippet controlButton(onclick: () => void, label: string, disabled: boolean, inner: Snippet)}
  <button
    {onclick}
    {disabled}
    aria-label={label}
    class="h-6 w-6 rounded-full border-mid border-2 p-1 flex align-middle justify-center cursor-pointer transition-all duration-300 active:-translate-y-1 hover:bg-primary hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-default"
  >
    {@render inner()}
  </button>
{/snippet}

<div class="@container w-full h-full relative overflow-hidden {aspectClass}">
  {#if isCarousel}
    <div
      use:swipe
      class="flex flex-row flex-nowrap transition-transform ease-[cubic-bezier(0.25,0.1,0.25,1)] h-full"
      style="width: {tripled.length *
        100}%; transform: translateX({translateX}%); transition-duration: {isTransitioning &&
      !reduceMotion
        ? transitionMs
        : 0}ms;"
    >
      {#each tripled as item, i (i)}
        <div class="h-full z-0" style="width: {slideWidth}%;">{@render slide(item, i)}</div>
      {/each}
    </div>

    <!-- Prev/next: hidden below ~400px container width (auto-run). -->
    <div
      class="ml-8 h-6 w-[72px] hidden @min-[400px]:flex justify-between z-10 absolute bottom-2 lg:bottom-6 left-0"
    >
      {#snippet chevL()}<ChevronLeft
          class="size-[1em] translate-y-[-1.75px] translate-x-[-0.75px] scale-90"
          strokeWidth={2}
        />{/snippet}
      {#snippet chevR()}<ChevronRight
          class="size-[1em] translate-y-[-1.75px] translate-x-[0.75px] scale-90"
          strokeWidth={2}
        />{/snippet}
      {@render controlButton(slideLeft, "Previous slide", isTransitioning, chevL)}
      {@render controlButton(slideRight, "Next slide", isTransitioning, chevR)}
    </div>

    <!-- Play/pause: hidden below ~400px. -->
    <div class="hidden @min-[400px]:block absolute bottom-2 lg:bottom-6 right-2 lg:right-6 z-10">
      {#snippet playIcon()}
        {#if isPlaying}
          <Pause class="size-[1em] translate-y-[-1.5px] scale-90" strokeWidth={2} />
        {:else}
          <Play class="size-[1em] translate-y-[-1.5px] translate-x-px scale-75" strokeWidth={2} />
        {/if}
      {/snippet}
      {@render controlButton(
        togglePlayPause,
        isPlaying ? "Pause slideshow" : "Play slideshow",
        false,
        playIcon,
      )}
    </div>

    {#if hasNavDots}
      <div
        class="hidden @min-[400px]:flex absolute bottom-2 lg:bottom-6 left-1/2 -translate-x-1/2 gap-1.5 z-10"
      >
        {#each slides as _, i (i)}
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
  {:else}
    <!-- 0 or 1 slide: render the single slide, no carousel chrome. -->
    <div class="h-full w-full">
      {#if count}{@render slide(slides[0], 0)}{/if}
    </div>
  {/if}
</div>
