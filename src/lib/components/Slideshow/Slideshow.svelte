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

  // While actively auto-advancing, the chrome fades out (video-player style) and
  // returns on hover or keyboard focus; paused/non-autoplaying it stays put.
  // Keyboard focus always reveals it, keeping the WCAG 2.2.2 pause reachable.
  const chromeHidden = $derived(canAutoplay && isPlaying);
  const controlReveal = $derived(
    chromeHidden
      ? "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
      : "opacity-100",
  );

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
    if (isTransitioning || !isCarousel || i === displayIndex) return;
    // Same transition bookkeeping as moveSlide — without it the track's
    // transition-duration stays 0 and dot-clicks snap instead of sliding.
    isTransitioning = true;
    currentIndex = i;
    setTimeout(
      () => {
        isTransitioning = false;
      },
      reduceMotion ? 0 : transitionMs,
    );
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
    class="h-6 w-6 rounded-full border-mid border-1 p-1 flex items-center justify-center cursor-pointer transition-all duration-300 active:-translate-y-1 hover:bg-primary hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-default"
  >
    {@render inner()}
  </button>
{/snippet}

<div class="@container group w-full h-full relative overflow-hidden {aspectClass}">
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

    <!-- Controls bar: prev/next (left), nav dots (floated centered), play/pause
         (right) as three equal flex columns, so the dots stay centered on the
         carousel regardless of the side controls. Below the ~400px container
         width the arrows and dots collapse (auto-run, chrome-less); while
         auto-advancing each control fades out and returns on hover or keyboard
         focus (keeping the WCAG 2.2.2 pause reachable). -->
    <div class="absolute bottom-2 lg:bottom-6 left-0 right-0 px-6 flex items-center z-10">
      <div
        class="flex-1 hidden @min-[400px]:flex items-center justify-start gap-3 transition-opacity duration-300 {controlReveal}"
      >
        {#snippet chevL()}<ChevronLeft
            class="size-3.5 -translate-x-px"
            strokeWidth={1.5}
          />{/snippet}
        {#snippet chevR()}<ChevronRight
            class="size-3.5 translate-x-px"
            strokeWidth={1.5}
          />{/snippet}
        {@render controlButton(slideLeft, "Previous slide", isTransitioning, chevL)}
        {@render controlButton(slideRight, "Next slide", isTransitioning, chevR)}
      </div>

      <div
        class="flex-1 flex items-center justify-center transition-opacity duration-300 {controlReveal}"
      >
        {#if hasNavDots}
          <div class="hidden @min-[400px]:flex items-center gap-1.5">
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
      </div>

      <!-- Play/pause: the WCAG 2.2.2 pause mechanism, rendered only when motion
           actually runs (canAutoplay) — so under reduced motion there is no
           misleading no-op button. Faded out while auto-advancing and revealed
           on hover or keyboard focus; keyboard focus keeps it reachable at any
           size. -->
      <div
        class="flex-1 flex items-center justify-end transition-opacity duration-300 {controlReveal}"
      >
        {#if canAutoplay}
          {#snippet playIcon()}
            {#if isPlaying}
              <Pause class="size-3.5" strokeWidth={1.5} />
            {:else}
              <Play class="size-3.5" strokeWidth={1.5} />
            {/if}
          {/snippet}
          {@render controlButton(
            togglePlayPause,
            isPlaying ? "Pause slideshow" : "Play slideshow",
            false,
            playIcon,
          )}
        {/if}
      </div>
    </div>
  {:else}
    <!-- 0 or 1 slide: render the single slide, no carousel chrome. -->
    <div class="h-full w-full">
      {#if count}{@render slide(slides[0], 0)}{/if}
    </div>
  {/if}
</div>
