<script lang="ts">
  import type { ScreenWidthColumnsSlice } from "../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { slice }: { slice: ScreenWidthColumnsSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);
  const hiddenVideos = $state(new Set<number>());
  const animationEnabled = $derived(
    slice.primary.isAnimated === null || slice.primary.isAnimated === true,
  );

  // Fallback to legacy `hasPadding` for docs not yet migrated to top/bottom flags.
  const padding = $derived(
    slice.primary as {
      hasTopPadding?: boolean | null;
      hasBottomPadding?: boolean | null;
      hasPadding?: boolean | null;
    },
  );
  const padTop = $derived(padding.hasTopPadding ?? padding.hasPadding ?? true);
  const padBottom = $derived(padding.hasBottomPadding ?? padding.hasPadding ?? true);
</script>

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-screen flex flex-row justify-center flex-wrap relative {padTop
      ? 'pt-12'
      : ''} {padBottom ? 'pb-12' : ''} {backgroundColorString}"
  >
    {#each slice.primary.media as item, i (i)}
      {#if isFilled.link(item.link)}
        <div
          use:anim={{ enabled: animationEnabled }}
          class="
            {slice.primary.hasGap ? 'mr-6 mb-6' : ''}
            {item.aspect === 'square'
            ? 'aspect-square'
            : item.aspect === '4/3'
              ? 'aspect-4/3'
              : item.aspect === '3/4'
                ? 'aspect-3/4'
                : item.aspect === '16/9'
                  ? 'aspect-video'
                  : item.aspect === '9/16'
                    ? 'aspect-9/16'
                    : ''}
            relative w-full flex flex-col items-center justify-start
            {slice.primary.desktopcolumns === '2'
            ? 'lg:w-1/2'
            : slice.primary.desktopcolumns === '3'
              ? 'lg:w-1/3'
              : ''}"
        >
          <a href={item.link.url} class="relative w-full flex flex-col items-center justify-start">
            {#if item.label}
              <div class="w-full border-b-1 border-dark label mb-8">
                {item.label}
              </div>
            {/if}
            {#if item.vimeoId}
              <PrismicImage
                class="w-full h-full object-cover absolute top-0 left-0"
                field={item.image}
              />

              <iframe
                title="background video"
                src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1" : ""}`}
                class="object-cover {item.aspect !== 'free'
                  ? 'h-full'
                  : ''} relative w-full mx-auto z-10 {!hiddenVideos.has(i)
                  ? 'opacity-100'
                  : 'opacity-0'} transition-opacity duration-200"
                frameborder="0"
                allow="autoplay"
                onerror={() => hiddenVideos.add(i)}
              ></iframe>
            {:else}
              <PrismicImage
                class="w-full {item.aspect !== 'free' ? 'h-full' : ''} object-cover"
                field={item.image}
              />
            {/if}
          </a>
        </div>
      {:else}
        <div
          use:anim={{ enabled: animationEnabled }}
          class="{slice.primary.hasGap
            ? 'mr-6 mb-6'
            : ''} relative w-full flex flex-col items-center justify-start
            {item.aspect === 'square'
            ? 'aspect-square'
            : item.aspect === '4/3'
              ? 'aspect-4/3'
              : item.aspect === '3/4'
                ? 'aspect-3/4'
                : item.aspect === '16/9'
                  ? 'aspect-video'
                  : item.aspect === '9/16'
                    ? 'aspect-9/16'
                    : ''}
            relative w-full flex flex-col items-center justify-start
            {slice.primary.desktopcolumns === '2'
            ? 'lg:w-1/2'
            : slice.primary.desktopcolumns === '3'
              ? 'lg:w-1/3'
              : ''}"
        >
          {#if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">
              {item.label}
            </div>
          {/if}
          {#if item.vimeoId}
            <PrismicImage
              class="w-full h-full object-cover absolute top-0 left-0"
              field={item.image}
            />

            <iframe
              title="background video"
              src={`https://player.vimeo.com/video/${item.vimeoId}?title=0${item.loopvideo ? "&background=1&loop=1&autoplay=1&muted=1" : ""}`}
              class="object-cover {item.aspect !== 'free'
                ? 'h-full'
                : ''} w-full mx-auto z-10 relative
              {!hiddenVideos.has(i) ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200"
              frameborder="0"
              allow="autoplay"
              onerror={() => hiddenVideos.add(i)}
            ></iframe>
          {:else}
            <PrismicImage
              class="w-full {item.aspect !== 'free' ? 'h-full' : ''} object-cover"
              field={item.image}
            />
          {/if}
        </div>
      {/if}
    {/each}
  </section>
{/if}
