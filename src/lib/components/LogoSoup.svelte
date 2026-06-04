<script lang="ts">
  import { PrismicImage, PrismicLink } from "@prismicio/svelte";
  import type { LogoSoupDocumentData, LogoSoupDocumentDataBrandsItem } from "../../prismicio-types";
  import ContentWidth from "./ContentWidth/ContentWidth.svelte";
  import { fade } from "svelte/transition";
  import { animateIn as anim } from "$lib/actions/animateIn";

  interface Props {
    data: { logoSoup: { data: LogoSoupDocumentData } };
  }

  let { data }: Props = $props();

  const logoSoupData = $derived<LogoSoupDocumentData>(data.logoSoup.data);
  const allBrands = $derived(logoSoupData.brands);
  const featuredBrands = $derived(
    allBrands.filter((brand: LogoSoupDocumentDataBrandsItem) => brand.isFeatured),
  );

  let showImage = $state(false);
  let brandIndex = $state(-1);
  let scrollY = $state(0);
  let viewportHeight = $state(0);
  let viewportWidth = $state(0);
  let mobileScrollActive = $state(false);
  let section: HTMLElement;

  const isMobile = $derived(viewportWidth > 0 && viewportWidth < 768);
  const brands = $derived<LogoSoupDocumentDataBrandsItem[]>(isMobile ? featuredBrands : allBrands);

  function handleScroll() {
    if (!isMobile || !section) return;
    const sectionTop = section.getBoundingClientRect().top;
    const sectionHeight = section.offsetHeight;

    let scrollProgress = 0;
    if (sectionTop < 0) scrollProgress = (Math.abs(sectionTop) + viewportHeight) / sectionHeight;

    if (scrollProgress > 1) scrollProgress = 1;

    let newIndex = Math.floor(scrollProgress * (brands.length + 2)) - 2;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > brands.length - 1) newIndex = brands.length - 1;

    if (newIndex > brands.length - 1) {
      mobileScrollActive = false;
      showImage = false;
    } else {
      mobileScrollActive = true;
    }

    if (newIndex !== brandIndex) {
      brandIndex = newIndex;
      showImage = true;
      mobileScrollActive = true;
    }
  }

  function navigateToBrand(index: number) {
    if (isMobile) {
      const targetScrollPosition = calculateScrollPositionForBrand(index);
      window.scrollTo({ top: targetScrollPosition });
    }
  }

  function calculateScrollPositionForBrand(index: number) {
    if (!isMobile || !section) return 0;

    const sectionHeight = section.offsetHeight;
    const sectionTop = section.getBoundingClientRect().top;
    const currentAbsolutePosition = window.scrollY + sectionTop;

    const targetProgress = (index + 2) / (brands.length + 2);
    return currentAbsolutePosition + targetProgress * sectionHeight - viewportHeight;
  }

  const nextBrand = () => {
    brandIndex = (brandIndex + 1) % brands.length;
  };

  const prevBrand = () => {
    brandIndex = (brandIndex - 1 + brands.length) % brands.length;
  };

  $effect(() => {
    // read scrollY so this effect re-runs on scroll
    const _trackScroll = scrollY;
    if (isMobile) handleScroll();
  });
</script>

<svelte:window bind:innerHeight={viewportHeight} bind:innerWidth={viewportWidth} bind:scrollY />

<section bind:this={section}>
  {#if !isMobile}
    <section class="h-lvh w-screen relative overflow-hidden">
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video transition-opacity duration-500
    {showImage && brandIndex > -1 ? '' : 'opacity-0'}
    {viewportHeight * 16 > viewportWidth * 9 ? 'h-lvh min-w-full' : 'w-screen min-h-full'}"
      >
        {#each brands as brand, i (brand.name || i)}
          <PrismicImage
            field={isMobile && brand.active_background_mobile_crop
              ? brand.active_background_mobile_crop
              : brand.active_background}
            class="absolute h-full w-full object-cover transition-opacity duration-700 ease-fast-slow
        {showImage && brandIndex === i ? '' : 'opacity-0'}"
          />
        {/each}
      </div>
      <ContentWidth class="h-full py-32 flex flex-row justify-end relative">
        <div use:anim class="absolute left-0 top-40">
          <h6
            class="transition duration-300 ease-fast-slow {showImage && brandIndex > -1
              ? 'text-white'
              : 'text-red'}"
          >
            Join these brands <br /> in fighting mediocrity.
          </h6>
        </div>

        <div class="w-3/5 h-full flex flex-row justify-between items-center flex-wrap gap-12">
          {#each brands as brand, i (brand.name || i)}
            <div use:anim class="w-1/4 relative">
              <button
                type="button"
                class="block w-full text-left bg-transparent border-0 p-0 cursor-pointer"
                onmouseenter={() => {
                  showImage = true;
                  brandIndex = i;
                }}
                onmouseleave={() => {
                  showImage = false;
                  brandIndex = -1;
                }}
                onfocus={() => {
                  showImage = true;
                  brandIndex = i;
                }}
                onblur={() => {
                  showImage = false;
                  brandIndex = -1;
                }}
                aria-label="Preview {brand.name}"
              >
                <PrismicLink field={brand.project_link}>
                  <PrismicImage
                    field={brand.logo_negative}
                    class="h-full absolute transition-opacity duration-300 ease-fast-slow {showImage &&
                    brandIndex === i
                      ? ''
                      : 'opacity-0'}"
                    loading="eager"
                  />
                  <PrismicImage
                    field={brand.logo_color}
                    class="h-full transition-opacity duration-300 ease-fast-slow {showImage &&
                    brandIndex > -1
                      ? 'opacity-0'
                      : ''}"
                    loading="eager"
                  />
                </PrismicLink>
              </button>
            </div>
          {/each}
        </div>

        <div use:anim class="absolute bottom-[20%] left-0 w-64">
          <div
            class="pt-10"
            role="presentation"
            onmouseleave={() => {
              showImage = false;
            }}
          >
            {#key brandIndex}
              {#if brandIndex >= 0 && brands[brandIndex]}
                <PrismicLink field={brands[brandIndex].project_link}>
                  <p
                    class="underline underline-offset-4 text-white transition duration-300 ease-fast-slow"
                    in:fade
                  >
                    {showImage && brandIndex > -1 ? brands[brandIndex].name : ""}
                  </p>
                </PrismicLink>
                <p
                  class="{showImage
                    ? 'text-white'
                    : 'text-red'} transition duration-300 ease-fast-slow"
                  in:fade
                >
                  {showImage && brandIndex > -1 ? brands[brandIndex].services : "Browse Our Work"}
                </p>
              {:else}
                <p class="text-red transition duration-300 ease-fast-slow">Browse Our Work</p>
              {/if}
            {/key}
            <div
              class="mt-8 gap-8 flex flex-row w-fit"
              role="presentation"
              onmouseenter={() => {
                showImage = true;
              }}
            >
              <button
                onclick={prevBrand}
                aria-label="Previous brand"
                class="{showImage && brandIndex > -1
                  ? 'text-white hover:text-primary'
                  : 'text-primary hover:text-white'} bump"
              >
                <i class="fa-sharp fa-regular fa-arrow-left fa-2xl"></i>
              </button>
              <button
                onclick={nextBrand}
                aria-label="Next brand"
                class="{showImage && brandIndex > -1
                  ? 'text-white hover:text-primary'
                  : 'text-primary hover:text-white'} bump"
              >
                <i class="fa-sharp fa-regular fa-arrow-right fa-2xl"></i>
              </button>
            </div>
          </div>
        </div>
      </ContentWidth>
    </section>
  {:else}
    <!-- Mobile Version -->
    <section class="h-lvh w-screen sticky top-0 overflow-hidden">
      <div
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video transition-opacity duration-500
        {mobileScrollActive ? '' : 'opacity-0'}
        {viewportHeight * 16 > viewportWidth * 9 ? 'h-lvh min-w-full' : 'w-screen min-h-full'}"
      >
        {#each brands as brand, i (brand.name || i)}
          <PrismicImage
            field={brand.active_background}
            class="absolute h-full w-full object-cover transition-opacity duration-700 ease-fast-slow
            {mobileScrollActive && brandIndex === i ? '' : 'opacity-0'}"
          />
        {/each}
      </div>

      <div class="absolute bottom-0 left-0 w-screen h-lvh bg-black opacity-25"></div>
      <div class="h-lvh w-screen flex flex-col items-center justify-evenly absolute top-0 left-0">
        <h6
          class="text-center mb-12 transition duration-300 ease-fast-slow {mobileScrollActive
            ? 'text-white'
            : 'text-red'}"
        >
          Join these brands <br /> in fighting mediocrity.
        </h6>

        <!-- Mobile logo display -->
        <div class="relative h-24 w-full flex justify-center items-center mb-16">
          {#each brands as brand, i (brand.name || i)}
            <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <PrismicLink field={brand.project_link}>
                <PrismicImage
                  field={brand.logo_negative}
                  class="h-24 w-auto transition-opacity duration-300 ease-fast-slow object-contain {mobileScrollActive &&
                  brandIndex === i
                    ? ''
                    : 'opacity-0'}"
                  loading="eager"
                />
              </PrismicLink>
            </div>
          {/each}
        </div>

        <!-- Brand info on mobile -->
        <div class="brand-info text-center">
          {#key brandIndex}
            {#if brandIndex >= 0 && brands[brandIndex]}
              <PrismicLink field={brands[brandIndex].project_link}>
                <p
                  class="underline underline-offset-4 text-white transition duration-300 ease-fast-slow"
                  in:fade
                >
                  {mobileScrollActive ? brands[brandIndex].name : ""}
                </p>
              </PrismicLink>
              <p
                class="{mobileScrollActive
                  ? 'text-white'
                  : 'text-red'} transition duration-300 ease-fast-slow"
                in:fade
              >
                {mobileScrollActive ? brands[brandIndex].services : "Scroll to explore our work"}
              </p>
            {:else}
              <p class="text-red transition duration-300 ease-fast-slow">
                Scroll to explore our work
              </p>
            {/if}
          {/key}
        </div>

        <!-- Progress indicator -->
        <div class="absolute bottom-1/2 translate-y-1/2 left-6 flex justify-center">
          <div class="flex flex-col gap-2">
            {#each brands as brand, i (brand.name || i)}
              <button
                onclick={() => navigateToBrand(i + 1)}
                aria-label="Jump to {brand.name}"
                class="w-1.5 h-1.5 rounded-full transition-all duration-300 z-20
                {i === brandIndex ? 'bg-white scale-125' : 'bg-white/50 scale-100'}"
              >
              </button>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <!-- Spacer section to control scroll length -->
    <div class="h-[500vh]"></div>
  {/if}
</section>
