<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { fade, fly } from "svelte/transition";
  import { page } from "$app/state";
  import { PrismicImage, PrismicLink } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import type { OpeningAnimationDocumentDataSlidesItem } from "../../prismicio-types";

  import printedReddoorLogo from "$lib/assets/icons/logos/reddoor_logo.png";
  import { isInHero } from "$lib/stores/isInHero.svelte";
  import drawnLogo from "$lib/assets/icons/logos/staticReddoor.png";
  import { untrack } from "svelte";

  const NAV_LINKS = [
    { label: "Portfolio", href: "/portfolio" },
    { label: "About", href: "/about" },
    { label: "20 for 20", href: "/twenty-for-twenty" },
    { label: "Meet With Us", href: "/contact" },
  ];

  const MASK_BASE = 0.25;
  const MASK_GROWTH = 14;
  const MASK_MAX = MASK_BASE + MASK_GROWTH;
  const HERO_EXIT_PCT = 99;
  const COMPELLING_DESKTOP_PCT = 30;
  const COMPELLING_MOBILE_PCT = 10;
  const MOBILE_BREAKPOINT_PX = 768;
  const ROTATE_INTERVAL_MS = 5000;
  const INTRO_FADE_MS = 400;
  const HEADLINE_INTRO = "Arm your brand with";

  type Props = { slides: OpeningAnimationDocumentDataSlidesItem[] };
  let { slides }: Props = $props();

  let isOverlayVisible = $state(false);

  let viewportHeight = $state(0);
  let viewportWidth = $state(0);
  let transitioning = $state(true);
  let openingSection: HTMLElement;
  let percentageScrolled = $state(0);
  let maskScale = $state(MASK_BASE);
  let showCompelling = $state(false);
  let showButtons = $state(false);
  let reducedMotion = $state(false);
  let scrollFrame = 0;

  const isScrolledPastHero = $derived(percentageScrolled >= HERO_EXIT_PCT);

  let currentImageIndex = $state(0);
  const safeIndex = $derived(slides.length ? currentImageIndex % slides.length : 0);
  const changeBackgroundImage = () => {
    if (slides.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % slides.length;
  };

  const currentSlide = $derived(slides[safeIndex]);

  const scrollThroughHero = () => {
    if (!openingSection) return;
    const targetY = openingSection.offsetTop + openingSection.offsetHeight - viewportHeight;
    window.scrollTo({ top: targetY });
  };

  const updateScroll = () => {
    if (!openingSection) return;
    const rect = openingSection.getBoundingClientRect();
    const scrollable = rect.height - viewportHeight;
    const pct =
      scrollable <= 0
        ? 100
        : Math.min(Math.max(100 - ((rect.bottom - viewportHeight) / scrollable) * 100, 0), 100);

    percentageScrolled = pct;
    isInHero.value = pct < HERO_EXIT_PCT;

    if (reducedMotion) return;

    maskScale = MASK_BASE + (pct / 100) * MASK_GROWTH;
    const threshold =
      viewportWidth < MOBILE_BREAKPOINT_PX ? COMPELLING_MOBILE_PCT : COMPELLING_DESKTOP_PCT;
    if (pct > threshold) {
      showCompelling = true;
      showButtons = true;
    }
  };

  const handleScroll = () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      updateScroll();
    });
  };

  $effect(() => {
    isInHero.value = true;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion = mq.matches;
    const handleMQ = (e: MediaQueryListEvent) => (reducedMotion = e.matches);
    mq.addEventListener("change", handleMQ);

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Bootstrap call only — wrapped in untrack so this effect doesn't re-run
    // on viewport state changes and tear down the listener it just registered.
    untrack(() => updateScroll());

    const transitionTimer = setTimeout(() => (transitioning = false), INTRO_FADE_MS);

    return () => {
      // Reset the global flag so the layout nav reappears on the next page —
      // otherwise navigating away mid-hero leaves isInHero stuck at true.
      isInHero.value = false;
      window.removeEventListener("scroll", handleScroll);
      mq.removeEventListener("change", handleMQ);
      clearTimeout(transitionTimer);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    };
  });

  // Reduced-motion: skip the scroll-driven scale/reveal and render the final frame directly.
  $effect(() => {
    if (!reducedMotion) return;
    maskScale = MASK_MAX;
    showCompelling = true;
    showButtons = true;
  });

  // Rotate background images only while visibly inside the hero and motion is allowed.
  $effect(() => {
    if (reducedMotion || isScrolledPastHero || slides.length < 2) return;
    const id = setInterval(changeBackgroundImage, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  });
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

{#if transitioning}
  <div class="bg-white w-screen h-dvh fixed top-0 left-0 z-50" transition:fade></div>
{/if}

{#if isOverlayVisible}
  <div
    class="w-screen h-lvh fixed inset-0 bg-paper z-50 overflow-hidden"
    transition:fly={{ y: "-100%" }}
  >
    <div class="flex items-start justify-between px-6 md:px-20 py-2.5">
      <a
        href="/"
        onclick={() => (isOverlayVisible = false)}
        class="block w-30 md:w-37.75 mix-blend-multiply opacity-85"
        aria-label="Reddoor home"
      >
        <img src={drawnLogo} alt="Reddoor" class="w-full h-auto block" />
      </a>
      <button
        class="text-black opacity-95 hover:opacity-100 transition mt-3"
        onclick={() => (isOverlayVisible = false)}
        aria-label="Close menu"
      >
        <i class="fa-sharp fa-thin fa-xmark fa-2xl"></i>
      </button>
    </div>

    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-8 md:gap-10 opacity-85"
    >
      {#each NAV_LINKS as item (item.href)}
        {@const isActive =
          item.href === "/"
            ? page.url.pathname === "/"
            : page.url.pathname === item.href || page.url.pathname.startsWith(item.href + "/")}
        <a
          href={item.href}
          onclick={() => (isOverlayVisible = false)}
          class="relative text-primary py-2 whitespace-nowrap font-['Besley'] text-[40px] md:text-[60px] leading-tight after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[1.5px] after:bg-primary after:origin-left after:transition-transform after:duration-300 after:ease-out {isActive
            ? 'after:scale-x-100'
            : 'after:scale-x-0 hover:after:scale-x-100'}"
        >
          {item.label}
        </a>
      {/each}
    </div>
  </div>
{/if}

<div class="w-screen" bind:this={openingSection} style:--mask-scale={maskScale}>
  <div class="h-dvh w-screen fixed bottom-0 left-0 bg-paper-red">
    <ContentWidth
      class="flex flex-col justify-center items-center h-full z-10 relative {percentageScrolled > 30
        ? 'opacity-0 '
        : 'opacity-100'}"
    >
      <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
        <h1 class="text-white text-left w-fit opacity-0" role="presentation">
          {HEADLINE_INTRO}
        </h1>
        <h1 class="text-white text-left w-fit">a clear story...</h1>
      </div>
      <i
        class="fa-light fa-arrow-down fa-2xl opacity-50 absolute bottom-12 text-white bob-always"
        aria-hidden="true"
      ></i>
    </ContentWidth>

    <div class="fixed top-0 left-0 w-screen h-dvh overflow-hidden z-20">
      <ContentWidth class="h-32 flex justify-between items-center">
        <img src={drawnLogo} class="brightness-0 invert h-20" alt="reddoor" />
        <button
          class="opacity-100 hover:opacity-60 transition"
          onclick={() => (isOverlayVisible = true)}
          in:fade={{ delay: 400 }}
          out:fade
          aria-label="Open menu"
        >
          <i class="fa-sharp fa-bars fa-xl text-white"></i>
        </button>
      </ContentWidth>
      <div class="fixed top-0 left-0 w-lvw h-dvh z-20" style="clip-path: url(#mask-path);">
        {#each slides as slide, index (index)}
          <PrismicImage
            field={viewportWidth < MOBILE_BREAKPOINT_PX && slide.background_image_mobile_crop
              ? slide.background_image_mobile_crop
              : slide.background_image}
            loading={index === 0 ? "eager" : "lazy"}
            fetchpriority={index === 0 ? "high" : "auto"}
            class="absolute h-full w-full object-cover will-change-[opacity] transition-opacity duration-1000 ease-fast-slow {index ===
            safeIndex
              ? 'opacity-100'
              : ' delay-1000 opacity-0'}"
          />
        {/each}

        <div class="w-screen h-dvh bg-black opacity-25 fixed pointer-events-none"></div>

        <button
          type="button"
          class="absolute inset-0 cursor-pointer bg-transparent border-0"
          onclick={scrollThroughHero}
          aria-label="Scroll to continue"
        ></button>

        {#if currentSlide}
          {#key safeIndex}
            <div
              class="hidden lg:block h-dvh w-screen fixed top-0 left-0 pointer-events-none"
              in:fade={{ delay: 400 }}
              out:fade
            >
              <ContentWidth class="flex flex-col items-start justify-end h-full pb-4 lg:pb-16">
                {#if currentSlide.project_name}
                  {#if isFilled.link(currentSlide.project_link)}
                    <PrismicLink field={currentSlide.project_link} class="pointer-events-auto">
                      <p class="text-white text-left underline underline-offset-4">
                        {currentSlide.project_name}
                      </p>
                    </PrismicLink>
                  {:else}
                    <p class="text-white text-left">
                      {currentSlide.project_name}
                    </p>
                  {/if}
                {/if}
                <p class="text-white text-left">
                  {currentSlide.services}
                </p>
              </ContentWidth>
            </div>
          {/key}
        {/if}

        {#if isInHero.value}
          <ContentWidth
            class="flex flex-row justify-between items-center absolute top-8 left-0 right-0"
          >
            <img
              src={printedReddoorLogo}
              alt="reddoor logo"
              class="w-12"
              in:fade={{ delay: 400 }}
              out:fade
            />
          </ContentWidth>
        {/if}

        <ContentWidth
          class="flex flex-col justify-center items-center h-full pointer-events-none z-30"
        >
          <div
            class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full z-20"
          >
            <h1
              class="text-white text-left md:translate-x-[14.5px] lg:translate-x-[7.5px] opacity-0"
              role="presentation"
            >
              {HEADLINE_INTRO}
            </h1>
            <h1
              class="text-white text-left transition duration-1000 ease-fast-slow {showCompelling
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-[50%]'}"
            >
              compelling design
            </h1>
            <div
              class="w-full flex flex-col md:flex-row md:gap-4 mt-8 transition duration-1000 ease-fast-slow {showButtons
                ? 'opacity-100 translate-y-0 delay-1000'
                : 'opacity-0 translate-y-[50%]'}"
            >
              <DefaultButton class="" href="/portfolio" text="View Our Work" />
            </div>
          </div>
        </ContentWidth>
      </div>

      <svg class="pointer-events-none w-0 h-0" aria-hidden="true">
        <defs>
          <clipPath id="mask-path">
            <path
              d="M 0,183.85 V 78.73 L 126.46,0 H 290.72 V 183.85 Z"
              style="transform: translate(50vw, 50vh) scale(var(--mask-scale)) translate(-145.36px, -91.93px); transform-origin: 0 0;"
            />
          </clipPath>
        </defs>
      </svg>
    </div>
  </div>

  <div class="h-dvh w-screen fixed bottom-0 left-0 pointer-events-none">
    <ContentWidth class="flex flex-col justify-center items-center h-full relative">
      <div class="absolute w-fit lg:w-1/2 right-0 top-1/2 lg:-translate-x-12 translate-y-20 h-full">
        <h1 class="text-white text-left w-fit">{HEADLINE_INTRO}</h1>
      </div>
      <i
        class="fa-light fa-arrow-down fa-2xl opacity-50 absolute bottom-12 text-white bob-always"
        aria-hidden="true"
      ></i>
    </ContentWidth>
  </div>

  <!-- Scrollable space to enable scrolling -->
  <div class="h-dvh w-screen"></div>
  <div class="h-dvh w-screen"></div>
  <div class="h-dvh w-screen"></div>
  <div class="h-dvh w-screen"></div>
  <div class="lg:h-dvh w-screen"></div>
</div>
