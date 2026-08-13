<script lang="ts">
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";

  let { slice }: { slice: Content.ScreenWidthImageSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);

  const pad = $derived(resolvePadding(slice.primary, false));

  /**
   * Author-selected aspect ratio. Full literal class names — Tailwind's scanner
   * cannot see a composed `aspect-${x}`.
   */
  const ASPECT_CLASS: Record<string, string> = {
    square: "aspect-square",
    "4/3": "aspect-4/3",
    "3/4": "aspect-3/4",
    "16/9": "aspect-video",
    "9/16": "aspect-9/16",
  };
  const aspectClass = $derived(ASPECT_CLASS[slice.primary.aspect ?? ""] ?? "");

  /**
   * Video MUST end up with an aspect ratio; an image need not.
   *
   * An <img> carries intrinsic dimensions, so leaving the ratio unset just lets
   * it lay out naturally. An <iframe> has none — with no ratio it falls back to
   * the CSS default iframe height of 150px, so a full-bleed video renders as a
   * 1440x150 letterbox slot. That is exactly what /portfolio/msot was doing:
   * its document has no `aspect` set, and the ternary here quietly resolved to
   * "". 16/9 is the right default for video and matches the `aspect` field's own
   * placeholder.
   */
  const videoAspectClass = $derived(aspectClass || "aspect-video");
</script>

<SliceSection
  {slice}
  class="w-full relative overflow-hidden {pad.padTop ? 'pt-12' : ''} {pad.padBottom
    ? 'pb-12'
    : ''} {backgroundColorString}"
>
  {#if slice.primary.vimeoid}
    <PrismicImage
      class="w-screen h-full object-cover absolute {pad.padTop ? 'top-12' : 'top-0'} left-0 z-0"
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
      class="{videoAspectClass} relative z-10 mx-auto w-screen object-cover"
    />
  {:else}
    <PrismicImage
      class="w-screen object-cover {aspectClass}"
      field={slice.primary.image}
      imgixParams={{ auto: ["format", "compress"] }}
      widths={[640, 960, 1280, 1920, 2560]}
      sizes="100vw"
      loading="lazy"
      decoding="async"
    />
  {/if}
</SliceSection>
