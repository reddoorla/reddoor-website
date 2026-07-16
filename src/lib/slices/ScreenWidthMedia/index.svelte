<script lang="ts">
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";

  let { slice }: { slice: Content.ScreenWidthImageSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);

  // Fallback to legacy `hasPadding` for docs not yet migrated to top/bottom flags.
  const padding = $derived(
    slice.primary as {
      hasTopPadding?: boolean | null;
      hasBottomPadding?: boolean | null;
      hasPadding?: boolean | null;
    },
  );
  const padTop = $derived(padding.hasTopPadding ?? padding.hasPadding ?? false);
  const padBottom = $derived(padding.hasBottomPadding ?? padding.hasPadding ?? false);
</script>

{#if !slice.primary.hide}
  <section
    class="w-full relative overflow-hidden {padTop ? 'pt-12' : ''} {padBottom
      ? 'pb-12'
      : ''} {backgroundColorString}"
  >
    {#if slice.primary.vimeoid}
      <PrismicImage
        class="w-screen h-full object-cover absolute {padTop ? 'top-12' : 'top-0'} left-0 z-0"
        field={slice.primary.image}
        imgixParams={{ auto: ["format", "compress"] }}
        widths={[640, 960, 1280, 1920, 2560]}
        sizes="100vw"
        loading="lazy"
        decoding="async"
      />

      <VimeoEmbed
        vimeoId={slice.primary.vimeoid}
        background={!!slice.primary.loopvideo}
        hasPoster={isFilled.image(slice.primary.image)}
        allow="autoplay; fullscreen;"
        class="object-cover {slice.primary.aspect === 'square'
          ? 'aspect-square'
          : slice.primary.aspect === '4/3'
            ? 'aspect-4/3'
            : slice.primary.aspect === '3/4'
              ? 'aspect-3/4'
              : slice.primary.aspect === '16/9'
                ? 'aspect-video'
                : slice.primary.aspect === '9/16'
                  ? 'aspect-9/16'
                  : ''}  w-screen mx-auto relative z-10"
      />
    {:else}
      <PrismicImage
        class="w-screen object-cover {slice.primary.aspect === 'square'
          ? 'aspect-square'
          : slice.primary.aspect === '4/3'
            ? 'aspect-4/3'
            : slice.primary.aspect === '3/4'
              ? 'aspect-3/4'
              : slice.primary.aspect === '16/9'
                ? 'aspect-video'
                : slice.primary.aspect === '9/16'
                  ? 'aspect-9/16'
                  : ''}"
        field={slice.primary.image}
        imgixParams={{ auto: ["format", "compress"] }}
        widths={[640, 960, 1280, 1920, 2560]}
        sizes="100vw"
        loading="lazy"
        decoding="async"
      />
    {/if}
  </section>
{/if}
