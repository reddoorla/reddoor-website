<script lang="ts">
  import { MAX_IMAGE_W } from "$lib/images";
  import type { ScreenWidthColumnsSlice } from "../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";

  let { slice }: { slice: ScreenWidthColumnsSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);
  const animationEnabled = $derived(
    slice.primary.isAnimated === null || slice.primary.isAnimated === true,
  );

  const pad = $derived(resolvePadding(slice.primary));
</script>

<SliceSection
  {slice}
  class="w-screen flex flex-row justify-center flex-wrap relative {pad.padTop
    ? 'pt-12'
    : ''} {pad.padBottom ? 'pb-12' : ''} {backgroundColorString}"
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
        <a
          href={item.link.url}
          aria-label={item.label || item.image.alt || "View linked media"}
          class="relative w-full flex flex-col items-center justify-start"
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
              imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
              widths={[400, 640, 800, 1200, 1600]}
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="lazy"
              decoding="async"
            />

            <VimeoEmbed
              vimeoId={item.vimeoId}
              background={!!item.loopvideo}
              hasPoster={isFilled.image(item.image)}
              class="object-cover {item.aspect !== 'free'
                ? 'h-full'
                : ''} relative w-full mx-auto z-10"
            />
          {:else}
            <PrismicImage
              class="w-full {item.aspect !== 'free' ? 'h-full' : ''} object-cover"
              field={item.image}
              imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
              widths={[400, 640, 800, 1200, 1600]}
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="lazy"
              decoding="async"
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
            imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
            widths={[400, 640, 800, 1200, 1600]}
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
          />

          <VimeoEmbed
            vimeoId={item.vimeoId}
            background={!!item.loopvideo}
            hasPoster={isFilled.image(item.image)}
            class="object-cover {item.aspect !== 'free'
              ? 'h-full'
              : ''} w-full mx-auto z-10 relative"
          />
        {:else}
          <PrismicImage
            class="w-full {item.aspect !== 'free' ? 'h-full' : ''} object-cover"
            field={item.image}
            imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
            widths={[400, 640, 800, 1200, 1600]}
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
          />
        {/if}
      </div>
    {/if}
  {/each}
</SliceSection>
