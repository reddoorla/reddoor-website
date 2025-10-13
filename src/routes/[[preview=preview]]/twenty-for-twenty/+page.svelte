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
  let cardsSection:HTMLElement;
  let viewportHeight:number;

 const handleScroll = () => {
    if(!cardsSection||typeof window === 'undefined')return;


    const cardsRect = cardsSection.getBoundingClientRect();



            
        const pageScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const sectionOffsetTop = cardsSection.offsetTop;
        
        const scrollStart = sectionOffsetTop;
        const scrollEnd = sectionOffsetTop + cardsRect.height - viewportHeight;
        const scrollRange = scrollEnd - scrollStart;
        
        const rawProgress = (pageScrollTop - scrollStart) / scrollRange;
    

    cardStackProgress = Math.max(0, Math.min(1, rawProgress));

  }



onMount(() => {
     projectCardArray = data.projectCards;
     window.addEventListener("scroll", handleScroll);
     
     return () => {
       window.removeEventListener("scroll", handleScroll);
     };
   });

</script>

<svelte:window bind:innerHeight={viewportHeight} />

<section class="w-screen bg-paper py-16 md:pt-48 md:pb-24">
  <ContentWidth class="flex flex-col-reverse md:flex-row">
    <div class="md:w-1/2 flex flex-col">
      <h1 class="opacity-0 hidden md:block">20</h1>
      <h2 class="opacity-0 hidden md:block">for</h2>
      <h1 class="opacity-0 md:-mb-20 hidden md:block">20</h1>
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
      <div class="flex flex-col text-primary items-center relative">
        <h1>20</h1>
        <h2>for</h2>
        <iframe
          title="background video"
          src={`https://player.vimeo.com/video/1125997849?background=1&muted=1&loop=1&autoplay=1`}
          class="aspect-square w-full mix-blend-multiply opacity-90 scale-110"
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
  <div class="h-screen w-screen sticky top-0">
    <ContentWidth class="flex flex-col md:flex-row  py-12 md:py-24">
      <div class="md:w-2/5">
        <p class="w-full max-w-sm">
          We’ll continue to build on this collection throughout the year,
          leading up to our 20th anniversary on October 2, 2026. Thanks for
          joining us on the journey!
        </p>
        <div class="w-2/3 h-2 relative overflow-hidden rounded-full mt-4 bg-mid">
            <div class="w-full h-full bg-primary absolute -left-[100%]" style="transform: translateX({100*cardStackProgress}%);"/>
        </div>
      </div>
      <div class="w-[125%] md:w-3/5 aspect-square p-6 sm:translate-y-0 -translate-x-[10%] md:translate-x-0" >
        <div class="h-full w-4/5 relative">
 
          {#each projectCardArray as card, i}
            <a
              href={card.href}
              class="absolute top-0 sm:left-12 w-full h-full flex flex-col justify-between bg-paper shadow-md shadow-black/20 hover:shadow-lg hover:z-10 hover:shadow-black/40 p-5 md:p-9 hover:scale-[102%] hover:-translate-y-2 active:shadow-black/90 active:-translate-y-8 active:rotate-0 transition-all duration-200 ease-out -rotate-3"
              style="transform: translateX( calc( 100vh - {cardStackProgress * 100}vh ) ) rotate(-3deg);"
            >
              <div class="w-full aspect-square relative inset-shadow">
                {#if typeof card.image === "string"}
                  <img
                    src={card.image}
                    alt="stack of catalogs"
                    class="w-full h-full object-cover"
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
    line-height: 100%; /* 247.555px */
  }
  h2 {
    font-family: Besley;
    font-size: 55px;
    font-style: normal;
    font-weight: 400;
    line-height: 125%; /* 68.75px */
  }

  @media only screen and (max-width: 1200px) {
    h1.number {
      font-size: 160px;
    }
  }

  @media only screen and (max-width: 1024px) {
    h1.number {
      font-size: 80px;
      line-height: 125%; /* 68.75px */
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
