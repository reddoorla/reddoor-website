<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import type { ImageField } from "@prismicio/client";
  import { PrismicImage } from "@prismicio/svelte";
  import { slugForCard, parseCardNumberFromHash } from "$lib/twenty-for-twenty/hash";

  type ProjectCard = {
    number: number;
    name: string | null | undefined;
    image: ImageField | string | null | undefined;
    body: string | null | undefined;
    dates: string | null | undefined;
    mediums: string;
    href: string | null | undefined;
  };

  let { data }: { data: { projectCards: ProjectCard[] } } = $props();

  const projectCardArray = $derived<ProjectCard[]>(data.projectCards || []);

  let cardStackProgress = $state(0);
  let targetProgress = $state(0);
  let cardsSection: HTMLElement;
  let viewportHeight = $state(0);
  let animationFrameId = 0;

  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  const calculateTargetProgress = () => {
    if (!cardsSection || typeof window === "undefined") return;

    const cardsRect = cardsSection.getBoundingClientRect();
    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const sectionOffsetTop = cardsSection.offsetTop;

    const scrollStart = sectionOffsetTop;
    const scrollEnd =
      sectionOffsetTop + cardsRect.height - viewportHeight - (40 * viewportHeight) / 100;
    const scrollRange = scrollEnd - scrollStart;

    const rawProgress = (pageScrollTop - scrollStart) / scrollRange;
    targetProgress = Math.max(0, Math.min(1, rawProgress));
  };

  const animate = () => {
    cardStackProgress = lerp(cardStackProgress, targetProgress, 0.15);
    animationFrameId = requestAnimationFrame(animate);
  };

  const calcCardTranslationInVH = (i: number) => {
    const l = projectCardArray.length - 1;
    const p = cardStackProgress;

    if (p < i / l) return 100;
    if (p > (i + 1) / l) return 0;
    return (1 - l * (p - i / l)) * 100;
  };

  const scrollTargetForCard = (cardIndex: number) => {
    if (!cardsSection || typeof window === "undefined") return null;
    const cardsRect = cardsSection.getBoundingClientRect();
    const sectionOffsetTop = cardsSection.offsetTop;
    const scrollStart = sectionOffsetTop;
    const scrollEnd =
      sectionOffsetTop + cardsRect.height - viewportHeight - (40 * viewportHeight) / 100;
    const L = projectCardArray.length;
    if (L === 0) return null;
    const progress = L === 1 ? 0 : cardIndex / (L - 1);
    return {
      scrollY: scrollStart + progress * (scrollEnd - scrollStart),
      progress,
    };
  };

  const resolveHashToScroll = () => {
    if (typeof window === "undefined") return;
    const number = parseCardNumberFromHash(window.location.hash);
    if (number === null) return;
    const cardIndex = projectCardArray.findIndex((c) => c.number === number);
    if (cardIndex < 0) return;
    const target = scrollTargetForCard(cardIndex);
    if (!target) return;
    window.scrollTo({ top: target.scrollY, behavior: "instant" });
    targetProgress = target.progress;
    cardStackProgress = target.progress;
  };

  let lastWrittenHash = "";

  const syncHashFromScroll = () => {
    if (typeof window === "undefined") return;
    if (!cardsSection) return;
    const L = projectCardArray.length;
    if (L === 0) return;

    const cardsRect = cardsSection.getBoundingClientRect();
    const sectionOffsetTop = cardsSection.offsetTop;
    const scrollStart = sectionOffsetTop;
    // Extend the upper bound past the animation-complete point so the trailing
    // grace at the bottom of the section belongs to the last card's hash,
    // rather than clearing the hash as soon as progress hits 1.
    const scrollEnd = sectionOffsetTop + cardsRect.height - viewportHeight;
    const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;

    const inside = pageScrollTop >= scrollStart && pageScrollTop <= scrollEnd;

    if (!inside) {
      if (lastWrittenHash && window.location.hash === lastWrittenHash) {
        const url = window.location.pathname + window.location.search;
        window.history.replaceState(null, "", url);
        lastWrittenHash = "";
      }
      return;
    }

    const cardIndex = Math.max(0, Math.min(L - 1, Math.floor(targetProgress * (L - 1))));
    const card = projectCardArray[cardIndex];
    const nextHash = "#" + slugForCard(card);
    if (nextHash === lastWrittenHash) return;
    if (nextHash === window.location.hash) {
      lastWrittenHash = nextHash;
      return;
    }
    window.history.replaceState(null, "", nextHash);
    lastWrittenHash = nextHash;
  };

  const handleScroll = () => {
    calculateTargetProgress();
    syncHashFromScroll();
  };

  function easeInQuint(x: number): number {
    return x * x * x * x * x;
  }

  $effect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("hashchange", resolveHashToScroll);
    animationFrameId = requestAnimationFrame(animate);
    handleScroll();
    resolveHashToScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("hashchange", resolveHashToScroll);
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
      <p class="md:w-4/5 max-w-lg large-body">
        As we step into our 20th year in business, our team has taken a moment to look back —
        revisiting the clients and projects that have shaped who we are today. From early
        partnerships to defining milestones, these 20 selections represent some of our favorite
        projects. The ones that refined our craft, deepened our client relationships, and shaped our
        approach to design and branding.
      </p>
      <p class=" text-primary md:w-4/5 max-w-lg mt-8 large-body">
        Through it all, one constant has remained: clear stories brought to life through <span
          class="underline-offset-[25%] underline">compelling design.</span
        >
      </p>
    </div>
    <div class="md:w-1/2 flex flex-col text-primary items-center">
      <div class="flex flex-col text-primary items-center relative">
        <h1>20</h1>
        <h2 class="-mt-8">for</h2>
        <iframe
          title="background video"
          src="https://player.vimeo.com/video/1125997849?background=1&muted=1&loop=1&autoplay=1"
          class="aspect-square w-full mix-blend-multiply opacity-90 scale-110 -mt-12"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </div>
  </ContentWidth>
</section>

<section
  class="w-screen relative z-10"
  style="height:{60 * (projectCardArray.length + 1.5)}vh"
  bind:this={cardsSection}
>
  <div class="h-screen w-screen sticky top-0 overflow-hidden z-10">
    <ContentWidth class="flex flex-col md:flex-row py-12 md:py-24">
      <div class="md:w-2/5">
        <p class="w-full max-w-lg large-body">
          We'll continue to build on this collection throughout the year, leading up to our 20th
          anniversary on October 2, 2026. Thanks for joining us on the journey!
        </p>
        <div
          class="w-2/3 h-1.5 hidden md:block relative overflow-hidden rounded-full mt-8 bg-light"
        >
          <div
            class="progress-bar w-full h-full bg-primary absolute rounded-xl"
            style="transform: translate3d({-100 + 100 * cardStackProgress}%, 0, 0);"
          ></div>
        </div>
      </div>
      <div
        class="w-[125%] md:w-3/5 max-h-[80vh] aspect-square p-6 sm:translate-y-0 translate-x-[-2%] sm:translate-x-[-2%] md:translate-x-0 card-square"
      >
        <div class="h-full w-4/5 relative cards-container">
          {#each projectCardArray as card, i (card.number)}
            <!-- Transform wrapper div -->
            <div
              class="card-transform-wrapper absolute top-0 sm:left-12 w-full h-full"
              style="transform: translate3d({calcCardTranslationInVH(i - 1)}vw, 0, 0) rotate({(((2 *
                (i % 2) -
                1) *
                (i + 1)) /
                projectCardArray.length) *
                6 *
                easeInQuint((100 - calcCardTranslationInVH(i - 1)) / 100)}deg);"
            >
              <!-- Anchor with its own transitions -->
              <a
                href={card.href}
                class="card-item w-full h-full flex flex-col justify-between bg-paper shadow-md hover:shadow-black/35 hover:shadow-lg translate-y-0 active:-translate-y-6 active:shadow-black/25 shadow-black/15 p-[4.5%] transition-all duration-300"
              >
                <div class="w-full aspect-square relative inset-shadow-sm">
                  {#if typeof card.image === "string"}
                    <img
                      src={card.image}
                      alt="stack of catalogs"
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <PrismicImage field={card.image} class="w-full h-full object-cover" />
                  {/if}

                  <h1
                    class="text-primary mix-blend-multiply absolute top-[6.5%] right-[6.5%] number"
                  >
                    {card.number.toString().padStart(2, "0")}
                  </h1>
                  <div
                    class="opacity-0 bg-dark/20 backdrop-blur-lg hover:opacity-100 transition-opacity duration-300 h-full w-full absolute top-0 left-0 flex items-center justify-center"
                  >
                    <p class="text-white text-center p-4">
                      {card.body || "Go to project!"}
                    </p>
                  </div>
                </div>
                <div class="w-full h-full flex flex-col justify-between pt-4 xl:pt-6">
                  <h5 class="text-black">{card.name}</h5>
                  <div class="flex flex-row lg:flex-col xl:flex-row justify-between flex-wrap">
                    <p class="text-primary uppercase card-label">
                      {card.mediums}
                    </p>
                    <p class="text-primary uppercase card-label">
                      {card.dates}
                    </p>
                  </div>
                </div>
              </a>
            </div>
          {/each}
        </div>
      </div>
      <div class="w-full h-2 md:hidden relative overflow-hidden rounded-full mt-4 bg-mid">
        <div
          class="progress-bar w-full h-full bg-primary absolute rounded-xl"
          style="transform: translate3d({-100 + 100 * cardStackProgress}%, 0, 0);"
        ></div>
      </div>
    </ContentWidth>
  </div>
</section>

<section
  class="w-screen py-48 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center relative"
>
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <div use:anim>
      <h3 class="text-white md:w-3/5">
        It's time to arm your brand with a clear story and compelling design
      </h3>
    </div>
    <div use:anim>
      <a href="/contact">
        <DefaultButton
          class="mt-6 text-white border-white border-1 hover:bg-mid/10"
          text="MEET WITH US"
          filled={false}
        />
      </a>
    </div>
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

  /* Transform wrapper handles position and rotation */
  .card-transform-wrapper {
    will-change: transform;
    transform-origin: center center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    pointer-events: none; /* Let events pass through to the anchor */
  }

  /* Card item handles its own transitions */
  .card-item {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    pointer-events: auto; /* Re-enable pointer events on the anchor */
    isolation: isolate;
  }

  .card-square {
    aspect-ratio: 1;
    width: min(110vw, 80vh);
    height: min(110vw, 80vh);
  }

  @media (min-width: 600px) {
    .card-square {
      width: min(100vw, 80vh);
      height: min(100vw, 80vh);
    }
  }

  @media (min-width: 768px) {
    .card-square {
      width: min(50vw, 80vh);
      height: min(50vw, 80vh);
    }
  }

  .progress-bar {
    will-change: transform;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
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
    p.card-label {
      font-size: 12px;
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
  }

  .inset-shadow-sm::after {
    content: "";
    position: absolute;
    inset: 0;
    box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.15) inset;
    pointer-events: none;
  }
</style>
