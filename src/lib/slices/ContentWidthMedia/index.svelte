<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import type { ContentWidthImageSlice } from "../../../prismicio-types";
  import { isFilled } from "@prismicio/client";
  import AnimateIn from "$lib/components/AnimateIn.svelte";

  let { slice }: { slice: ContentWidthImageSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);

  // Track which videos have failed to load (rather than a pre-sized boolean array, which
  // would require reading slice.primary.images.length in a state initializer).
  const hiddenVideos = $state(new Set<number>());
</script>

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-screen relative {slice.primary.hasPadding
      ? 'py-12'
      : ''} {backgroundColorString}"
  >
    <ContentWidth>
      <div
        class="w-full flex flex-col {slice.primary.isFullContentWidth
          ? ''
          : 'md:flex-row'}"
      >
        <AnimateIn
          isOff={slice.primary.isAnimated !== null && !slice.primary.isAnimated}
          class="{slice.primary.isFullContentWidth
            ? 'w-full'
            : 'w-full md:w-1/5'} h-full overflow-hidden pr-6"
        >
          <h6 class="text-primary">{slice.primary.label || ""}</h6>
          <PrismicRichText field={slice.primary.body} />
        </AnimateIn>

        <div
          class="{slice.primary.isFullContentWidth
            ? 'w-full'
            : 'w-full md:w-4/5'} flex flex-row justify-center flex-wrap"
        >
          {#each slice.primary.images as item, i (i)}
            {#if isFilled.link(item.link)}
              <AnimateIn
                isOff={slice.primary.isAnimated !== null &&
                  !slice.primary.isAnimated}
                transitionDelayMax={slice.primary.hasGap ? 400 : 0}
                class="{slice.primary.hasGap
                  ? 'pr-6 pb-6'
                  : ''} relative w-full flex flex-col items-center justify-start cursor-pointer {slice
                  .primary.desktopcolumns === '2'
                  ? 'lg:w-1/2'
                  : ''} {slice.primary.desktopcolumns === '3'
                  ? 'lg:w-1/3'
                  : ' '}
                  {item.aspect==="square" ? "aspect-square" :
                    item.aspect==="4/3" ? "aspect-4/3" :
                    item.aspect==="3/4" ? "aspect-3/4" :
                    item.aspect==="16/9" ? "aspect-video" :
                    item.aspect==="9/16" ? "aspect-9/16" :
                    ""
                  }
                  "
              >
                <a
                  href={item.link.url}
                  class="relative w-full flex flex-col items-center justify-start"
                >
                  {#if item.label}
                    <div
                      class="w-full border-b-1 border-dark label mb-8 cursor-pointer"
                    >
                      {item.label}
                    </div>
                  {/if}

                  {#if item.vimeoid}
                    <PrismicImage
                      class="w-full h-full object-cover absolute top-0 left-0 z-0"
                      field={item.image}
                    />
                    <iframe
                      title="background video"
                      src={`https://player.vimeo.com/video/${item.vimeoid}?title=0${item.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1" : ""}`}
                      class="object-cover w-full {item.aspect!=="free"?"h-full":""} mx-auto z-10
                        {!hiddenVideos.has(i)
                        ? 'opacity-100'
                        : 'opacity-0'} transition-opacity duration-300"
                      frameborder="0"
                      allow="autoplay"
                      onerror={() => hiddenVideos.add(i)}
                    ></iframe>
                  {:else}
                    <PrismicImage
                      class="w-full {item.aspect!=="free"?"h-full":""} object-cover cursor-pointer"
                      field={item.image}
                    />
                  {/if}
                </a>
              </AnimateIn>
            {:else}
              <AnimateIn
                isOff={slice.primary.isAnimated !== null &&
                  !slice.primary.isAnimated}
                class="{slice.primary.hasGap
                  ? 'pr-6 pb-6'
                  : ''} relative w-full flex flex-col items-center justify-start
                      {slice.primary.desktopcolumns === '2'
                  ? 'lg:w-1/2'
                  : ''} {slice.primary.desktopcolumns === '3'
                  ? 'lg:w-1/3'
                  : ''}
                  {item.aspect==="square" ? "aspect-square" :
                    item.aspect==="4/3" ? "aspect-4/3" :
                    item.aspect==="3/4" ? "aspect-3/4" :
                    item.aspect==="16/9" ? "aspect-video" :
                    item.aspect==="9/16" ? "aspect-9/16" :
                    ""
                  }"
              >
                {#if item.label}
                  <div class="w-full border-b-1 border-dark label mb-8">
                    {item.label}
                  </div>
                {/if}

                <PrismicImage
                  class="w-full {item.aspect!=="free"?"h-full":""} object-cover"
                  field={item.image}
                />

                {#if item.vimeoid}
                  <PrismicImage
                    class="w-full h-full object-cover absolute top-0 left-0 z-0"
                    field={item.image}
                  />
                  <iframe
                    title="background video"
                    src={`https://player.vimeo.com/video/${item.vimeoid}?title=0${item.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1" : ""}`}
                    class="object-cover w-full {item.aspect!=="free"?"h-full":""} z-10 {!hiddenVideos.has(i)
                      ? 'opacity-100'
                      : 'opacity-0'} transition-opacity duration-300"
                    frameborder="0"
                    allow="autoplay"
                    onerror={() => hiddenVideos.add(i)}
                  ></iframe>
                {/if}
              </AnimateIn>
            {/if}
          {/each}
        </div>
      </div>
    </ContentWidth>
  </section>
{/if}
