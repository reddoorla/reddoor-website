<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import arrowButton from "$lib/assets/icons/arrowButton.svg";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import { isFilled, asLink } from "@prismicio/client";
  import type { ProjectDocument } from "../../../../prismicio-types";
  import type { PageData } from "./$types";
  import { mediumString } from "$lib/utils/projectServices";

  let { data }: { data: PageData } = $props();

  const pageData = $derived(data.page.data);
  const featuredProject = $derived<ProjectDocument | undefined>(data.featuredProject);
  const projects = $derived<ProjectDocument[]>(data.projects);
</script>

<div class="w-screen h-[80vh] relative">
  <PrismicImage
    field={pageData.hero}
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
      {pageData.tagline || ""}
    </h5>
    <div class=" text-white w-full z-10 mb-12 md:w-3/5 mx-auto">
      <h1 class="mt-4">{data.title.slice(0, -18) || ""}</h1>
    </div>
  </ContentWidth>
</div>

<section class="w-full py-12">
  <ContentWidth class="flex flex-col items-center" animateIn>
    <div class="w-full md:w-3/5 rich-text">
      <PrismicRichText field={pageData.body} />
    </div>
  </ContentWidth>
</section>

<ContentWidth class="flex flex-col items-end">
  <div class="w-full md:w-4/5">
    <div class="w-full md:pr-6 aspect-4/3 lg:aspect-video relative">
      <a
        href={"/portfolio/" + data.featuredProject?.uid || ""}
        class="h-full w-full flex flex-col justify-end items-end relative"
      >
        <img
          src={pageData.featuredImageOverride.url || featuredProject?.data.hero.url || ""}
          alt={featuredProject?.data.title || "" + " Hero Image"}
          class="absolute w-full h-full object-cover"
        />
        <div
          class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
          style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
        ></div>
        <div class="w-full flex flex-row justify-between p-6 z-10">
          <div class="w-4/5">
            <p class="text-white uppercase">
              {pageData.featuredTitleOverride || featuredProject?.data.title || ""}
            </p>
            <p class="text-light">
              {pageData.featuredSubtitleOverride ||
                (featuredProject && mediumString(featuredProject)) ||
                ""}
            </p>
          </div>
          <div class="brightness-200 hover:brightness-50 transition bump w-12 h-12">
            <img src={arrowButton} alt="" class="h-full" />
          </div>
        </div>
      </a>
    </div>

    <div class="w-full flex flex-col lg:flex-row mt-6 flex-wrap relative">
      {#each projects as project, i (project.uid)}
        <div class="md:pr-6 pb-6 w-full lg:w-1/2 aspect-4/3 transition-opacity duration-700">
          <a
            href={isFilled.link(pageData.projects[i].linkOverride)
              ? asLink(pageData.projects[i].linkOverride)
              : "/portfolio/" + project.uid}
            target={isFilled.link(pageData.projects[i].linkOverride) ? "_blank" : undefined}
            class="h-full w-full flex flex-col justify-end relative"
          >
            <img
              src={pageData.projects[i].imageOverride.url || project.data.hero.url || ""}
              alt={project.data.title + " Hero Image"}
              class="absolute w-full h-full object-cover"
              fetchpriority="low"
            />
            <div
              class="w-full h-full absolute top-0 left-0 hover:opacity-60 transition-opacity duration-700"
              style="background: linear-gradient(180deg, rgba(12, 19, 35, 0.15) 0%, rgba(12, 19, 35, 0.80) 81.09%) 50% / cover no-repeat;"
            ></div>

            <div
              use:anim={{ delayMax: 800 }}
              class="w-full flex flex-row justify-between items-end p-6 z-10"
            >
              <div class="w-4/5">
                <p class="text-white uppercase">
                  {pageData.projects[i].titleOverride || project.data.title}
                </p>
                <p class="text-light">
                  {pageData.projects[i].subtitleOverride || mediumString(project) || ""}
                </p>
              </div>
              <div class="brightness-200 hover:brightness-50 transition bump w-12 h-12">
                <img src={arrowButton} alt="" class="w-full" />
              </div>
            </div>
          </a>
        </div>
      {/each}
    </div>
  </div>
</ContentWidth>

<div class="py-12"></div>

<SliceZone slices={data.page.data.slices} {components} />

<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <h3 class="text-white md:w-3/5">
      Isn’t it time to arm your brand with a clear story and compelling design?
    </h3>
    <a href="/contact">
      <DefaultButton
        class="mt-6 text-white border-white border-1 hover:bg-mid/10"
        text="MEET WITH US"
        filled={false}
      />
    </a>
  </ContentWidth>
</div>
