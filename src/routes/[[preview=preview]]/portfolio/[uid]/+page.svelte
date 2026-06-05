<script lang="ts">
  import { PrismicImage, SliceZone } from "@prismicio/svelte";

  import { components } from "$lib/slices";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import type { PageData } from "./$types";
  import { mediumString } from "$lib/utils/projectServices";

  let { data }: { data: PageData } = $props();

  const services = $derived(mediumString(data.page));
</script>

<div class="w-screen h-[80vh] relative">
  <PrismicImage
    field={data.page.data.hero}
    class="w-full h-full absolute object-cover"
    loading="eager"
    fetchpriority="high"
  />
  <div
    class="w-full h-full absolute"
    style="background: linear-gradient(rgba(0, 0, 0, 0.42) 0%, rgba(215, 25, 32, 0.86) 100%); z-index: 0;"
  ></div>
  <ContentWidth class="h-full flex flex-col justify-between items-start">
    <div></div>
    <h5 class="text-white md:w-3/5 md:pr-[10%] mx-auto z-10">
      {data.page.data.tagline || ""}
    </h5>
    <div class=" text-white w-full z-10 mb-12 md:w-3/5 mx-auto">
      <div class="w-full border-b-1 border-b-white flex justify-between pb-4">
        <div class="font-extralight">{services}</div>
        <div class="h-6 w-20 flex flex-row justify-between text-white">
          {#if data.prevProject}
            <a href={"/portfolio/" + data.prevProject.uid} aria-label="Previous project">
              <i class="fa-thin fa-sharp fa-chevron-left fa-2xl bump hover:text-light"></i></a
            >
          {/if}
          {#if data.nextProject}
            <a href={"/portfolio/" + data.nextProject.uid} aria-label="Next project">
              <i class="fa-thin fa-sharp fa-chevron-right fa-2xl bump hover:text-light"></i></a
            >
          {/if}
        </div>
      </div>
      <h1 class="mt-4">{data.heroHeading || ""}</h1>
    </div>
  </ContentWidth>
</div>

<SliceZone slices={data.page.data.slices} {components} />

<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between" animateIn>
    <h3 class="text-white md:w-3/5">
      Isn’t it time to arm your brand with a clear story and compelling design?
    </h3>
    <div use:anim={{ delayMax: 1600 }}>
      <a href="/contact">
        <DefaultButton
          class="mt-6 text-white border-white border-1 hover:bg-mid/10"
          text="MEET WITH US"
          filled={false}
        />
      </a>
    </div>
  </ContentWidth>
</div>

<div class="bg-paper w-screen py-24">
  <ContentWidth>
    <h4 class="text-primary text-left w-full">Related Projects</h4>
    <div class="w-full mt-12 flex flex-col md:flex-row gap-12 md:gap-0">
      <div class="w-1/5"></div>
      {#if data.relatedProjectOne}
        <div class="w-full md:w-2/5 md:pr-2 aspect-4/3 relative">
          <a
            href={"/portfolio/" + (data.relatedProjectOne.uid || "")}
            class="h-full w-full flex flex-col justify-end relative"
          >
            <img
              src={data.relatedProjectOne.data.hero.url || ""}
              alt={(data.relatedProjectOne.data.title || "") + " Hero Image"}
              class="absolute w-full h-full object-cover"
              fetchpriority="low"
            />
            <div
              class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
              style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
            ></div>
            <div class="w-full flex flex-row justify-between p-6 z-10">
              <div>
                <p class="text-white uppercase">
                  {data.relatedProjectOne.data.title || ""}
                </p>
                <p class="text-light">
                  {mediumString(data.relatedProjectOne) || ""}
                </p>
              </div>
              <div class="brightness-200 hover:brightness-50 transition bump">
                <img src={arrowButton} alt="" class="h-full" />
              </div>
            </div>
          </a>
        </div>
      {/if}
      {#if data.relatedProjectTwo}
        <div class="w-full md:w-2/5 md:pl-2 aspect-4/3 relative">
          <a
            href={"/portfolio/" + data.relatedProjectTwo.uid}
            class="h-full w-full flex flex-col justify-end relative"
          >
            <img
              src={data.relatedProjectTwo.data.hero.url || ""}
              alt={(data.relatedProjectTwo.data.title || "") + " Hero Image"}
              class="absolute w-full h-full object-cover"
              fetchpriority="low"
            />
            <div
              class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
              style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
            ></div>
            <div class="w-full flex flex-row justify-between p-6 z-10">
              <div>
                <p class="text-white uppercase">
                  {data.relatedProjectTwo.data.title || ""}
                </p>
                <p class="text-light">
                  {mediumString(data.relatedProjectTwo) || ""}
                </p>
              </div>
              <div class="brightness-200 hover:brightness-50 transition bump">
                <img src={arrowButton} alt="" class="h-full" />
              </div>
            </div>
          </a>
        </div>
      {/if}
    </div>
  </ContentWidth>
</div>
