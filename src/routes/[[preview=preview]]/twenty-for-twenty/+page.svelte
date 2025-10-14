<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import AnimateIn from "$lib/components/AnimateIn.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import progressImage from "$lib/assets/images/progressImage.jpg";
  import type { ImageField } from "@prismicio/client";
  import { PrismicImage } from "@prismicio/svelte";
  import { onMount } from "svelte";

  export let data;

  type ProjectCard = {
    number: number;
    name: string | null | undefined;
    image: ImageField | string | null | undefined;
    body: string | null | undefined;
    dates: string | null | undefined;
    mediums: string;
    href: string | null | undefined;
  };

  let projectCardArray: ProjectCard[] = data.projectCards || []; 
  let cardStackProgress = 0;
  let targetProgress = 0;
  let cardsSection: HTMLElement;
  let viewportHeight: number;
  let animationFrameId: number;

  // Smooth interpolation
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const calculateTargetProgress = () => {
    if (!cardsSection || typeof window === 'undefined') return;

    const cardsRect = cardsSection.getBoundingClientRect();
    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const sectionOffsetTop = cardsSection.offsetTop;
    
    const scrollStart = sectionOffsetTop;
    const scrollEnd = sectionOffsetTop + cardsRect.height - viewportHeight;
    const scrollRange = scrollEnd - scrollStart;
    
    const rawProgress = (pageScrollTop - scrollStart) / scrollRange;
    targetProgress = Math.max(0, Math.min(1, rawProgress));
  };

  const animate = () => {
    cardStackProgress = lerp(cardStackProgress, targetProgress, 0.15);
    
    animationFrameId = requestAnimationFrame(animate);
  };

  // Reactive function that recalculates on every cardStackProgress change
  $: calcCardTranslationInVH = (i: number) => {
    const l = projectCardArray.length-1;
    const p = cardStackProgress;
    
    if (p < i/l) return 100;
    if (p > (i+1)/l) return 0;
    return (1-l * (p - i/l)) * 100;
  }

  const handleScroll = () => {
    calculateTargetProgress();
  };

  onMount(() => {
    projectCardArray = data.projectCards;
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    animationFrameId = requestAnimationFrame(animate);

    handleScroll();
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  });
</script>

<svelte:window bind:innerHeight={viewportHeight} />

<section class="w-screen bg-paper py-16">
  <ContentWidth class="flex flex-col-reverse md:flex-row">
    <div class="md:w-1/2 flex flex-col">
      <h1 class="opacity-0 hidden md:block">20</h1>
      <h2 class="opacity-0 hidden md:block">for</h2>
      <p class="w-4/5 max-w-md">
        As we step into our 20th year in business, our team has taken a moment
        to look back — revisiting the clients and projects that have shaped who
        we are today. From early partnerships to defining milestones, these 20
        selections represent some of our favorite projects. The ones that
        refined our craft, deepened our client relationships, and shaped our
        approach to design and branding.
      </p>
      <div class="large-body text-primary w-4/5 max-w-md mt-8">
        Through it all, one constant has remained: clear stories brought to life
        through <span class="underline-offset-[25%] underline"
          >compelling design.</span
        >
      </div>
    </div>
    <div class="md:w-1/2 flex flex-col text-primary items-center">
      <div class="flex flex-col text-primary items-center relative ">
        <h1>20</h1>
        <h2 class="-mt-4">for</h2>
        <iframe
          title="background video"
          src={`https://player.vimeo.com/video/1125997849?background=1&muted=1&loop=1&autoplay=1`}
          class="aspect-square w-full mix-blend-multiply opacity-90 scale-110 -mt-8"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </ContentWidth>
</section>

<section
  class="w-screen relative"
  style="height:{100 * (projectCardArray.length+1)}vh"
  bind:this={cardsSection}
>
  <div class="h-screen w-screen sticky top-0 overflow-hidden">
    <ContentWidth class="flex flex-col md:flex-row py-24">
      <div class="md:w-2/5">
        <p class="w-full max-w-sm">
          We'll continue to build on this collection throughout the year,
          leading up to our 20th anniversary on October 2, 2026. Thanks for
          joining us on the journey!
        </p>
        <div class="w-2/3 h-2 relative overflow-hidden rounded-full mt-4 bg-mid">
          <div 
            class="progress-bar w-full h-full bg-primary absolute rounded-xl" 
            style="transform: translate3d({-100 + (100*cardStackProgress)}%, 0, 0);"
          />
        </div>
      </div>
      <div class="w-[125%] md:w-3/5 aspect-square p-6 sm:translate-y-0 -translate-x-[2%] md:translate-x-0">
        <div class="h-full w-4/5 relative cards-container">
          {#each projectCardArray as card, i}
            <a
              href={card.href}
              class="card-item absolute top-0 sm:left-12 w-full h-full flex flex-col justify-between bg-paper shadow-md shadow-black/20 p-5 md:p-9 -rotate-3"
              style="transform: translate3d({calcCardTranslationInVH(i-1)}vh, 0, 0) rotate({((2*(i%2)-1))*(i+1)/projectCardArray.length*6}deg);"
            >
              <div class="w-full aspect-square relative inset-shadow">
                {#if typeof card.image === "string"}
                  <img
                    src={card.image}
                    alt="stack of catalogs"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                {:else}
                  <PrismicImage
                    field={card.image}
                    class="w-full h-full object-cover"
                  />
                {/if}

                <h1
                  class="text-primary mix-blend-multiply absolute top-0 right-0 xl:right-9 xl:top-9 number"
                >
                  {card.number.toString().padStart(2, "0")}
                </h1>
                <div class="card-overlay opacity-0 bg-dark/20 backdrop-blur-lg h-full w-full absolute top-0 left-0 flex items-center justify-center">
                  <p class="text-white text-center">{card.body||"Go to project!"}</p>
                </div>
              </div>
              <div
                class="w-full h-full flex flex-col justify-between pt-4 xl:pt-6"
              >
                <h5 class="text-black">{card.name}</h5>
                <div
                  class="flex flex-col sm:flex-row md:flex-col xl:flex-row justify-between flex-wrap"
                >
                  <p class="text-primary uppercase">{card.mediums}</p>
                  <p class="text-primary uppercase">{card.dates}</p>
                </div>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </ContentWidth>
  </div>
</section>

<section
  class="w-screen py-48 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center"
>
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <AnimateIn>
      <h3 class="text-white md:w-3/5">
        It's time to arm your brand with a clear story and compelling design
      </h3>
    </AnimateIn>
    <AnimateIn>
      <a href="/contact">
        <DefaultButton
          class="mt-6 text-white border-white border-1 hover:bg-mid hover:bg-opacity-10"
          text="MEET WITH US"
          filled={false}
        />
      </a>
    </AnimateIn>
  </ContentWidth>
</section>

<style>
  h1 {
    font-size: 240px;
    font-style: normal;
    font-weight: 700;
    line-height: 100%;
  }
  
  h2 {
    font-family: Besley;
    font-size: 55px;
    font-style: normal;
    font-weight: 400;
    line-height: 125%;
  }

  /* Performance optimizations for iOS Safari */
  .cards-container {
    transform: translate3d(0, 0, 0);
  }

  .card-item {
    will-change: transform;
    transform-origin: center center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    -webkit-transform: translate3d(0, 0, 0);
    pointer-events: auto;
    isolation: isolate;
  }

  @media (hover: hover) {
    .card-item:hover {
      z-index: 10;
      transform: scale(1.02) translateY(-0.5rem);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease-out;
    }

    .card-item:hover .card-overlay {
      opacity: 1;
      transition: opacity 0.3s ease;
    }
  }

  .card-item:active {
    transform: translateY(-2rem);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9);
  }

  .progress-bar {
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .card-overlay {
    -webkit-backdrop-filter: blur(16px);
    pointer-events: none;
  }

  @media only screen and (max-width: 1200px) {
    h1.number {
      font-size: 160px;
    }
  }

  @media only screen and (max-width: 1024px) {
    h1.number {
      font-size: 80px;
      line-height: 125%;
    }
  }

  @media only screen and (max-width: 768px) {
    h1.number {
      font-size: 160px;
    }
  }

  @media only screen and (max-width: 540px) {
    h1.number {
      font-size: 80px;
    }
    p {
      font-size: 14px;
      line-height: 120%;
    }
  }

  .postcard-shadow {
    box-shadow: 0 4px 4px 0 rgba(0, 0, 0, 0.15);
  }

  .inset-shadow::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.15) inset;
    pointer-events: none;
  }
</style>