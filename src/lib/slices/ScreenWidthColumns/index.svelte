<script lang="ts">
  import { MAX_IMAGE_W } from "$lib/images";
  import type { ScreenWidthColumnsSlice } from "../../../../prismicio-types";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import Video from "$lib/components/Video.svelte";
  import { captionsUrl, mediaUrl } from "$lib/video/media";
  import { asImageSrc } from "@prismicio/client";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";

  let { slice }: { slice: ScreenWidthColumnsSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);
  const animationEnabled = $derived(
    slice.primary.isAnimated === null || slice.primary.isAnimated === true,
  );

  const pad = $derived(resolvePadding(slice.primary));

  // A video in a linked card would sit inside its <a>: a click on the player
  // or the pause button would follow the link (and a button in a link is
  // invalid). The old Vimeo iframe swallowed those clicks, so a card with a
  // video keeps its link on the label, or on a visually hidden link.
  // A player's poster, sized; Video sets it only when the player nears the
  // viewport (frame 0 would otherwise cover the still underneath). Built as
  // the underlay's own 1600w srcset URL (an editor's crop keeps its `rect`
  // and loses its `w`/`h`, as in the srcset), so it is often a cache hit.
  const posterSrc = (field: Parameters<typeof asImageSrc>[0]) =>
    asImageSrc(field, {
      auto: ["format", "compress"],
      fit: "max",
      w: undefined,
      h: undefined,
      width: 1600,
    });

  const hasVideo = (item: { video_mp4: unknown; video_mp4_mobile: unknown }, id: unknown) =>
    Boolean(
      id ||
      mediaUrl(item.video_mp4 as Parameters<typeof mediaUrl>[0]) ||
      mediaUrl(item.video_mp4_mobile as Parameters<typeof mediaUrl>[0]),
    );
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
        <svelte:element
          this={hasVideo(item, item.vimeoId) ? "div" : "a"}
          href={hasVideo(item, item.vimeoId) ? undefined : item.link.url}
          aria-label={hasVideo(item, item.vimeoId)
            ? undefined
            : item.label || item.image.alt || "View linked media"}
          class="relative w-full flex flex-col items-center justify-start"
        >
          {#if item.label && hasVideo(item, item.vimeoId)}
            <a
              href={item.link.url}
              class="relative z-10 w-full border-b-1 border-dark label mb-8 block"
            >
              {item.label}
            </a>
          {:else if item.label}
            <div class="w-full border-b-1 border-dark label mb-8">
              {item.label}
            </div>
          {:else if hasVideo(item, item.vimeoId)}
            <a
              href={item.link.url}
              class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:bg-white focus:px-2"
              >{item.image.alt || "View linked media"}</a
            >
          {/if}
          {#if item.vimeoId || mediaUrl(item.video_mp4) || mediaUrl(item.video_mp4_mobile)}
            <PrismicImage
              class="w-full h-full object-cover absolute top-0 left-0"
              field={item.image}
              imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
              widths={[400, 640, 800, 1200, 1600]}
              sizes="(min-width: 1024px) 50vw, 100vw"
              loading="lazy"
              decoding="async"
            />

            <Video
              mp4={mediaUrl(item.video_mp4)}
              mobileMp4={mediaUrl(item.video_mp4_mobile)}
              vimeoId={item.vimeoId}
              mode={item.loopvideo ? "background" : "player"}
              poster={posterSrc(item.image)}
              captions={captionsUrl(item.video_captions)}
              title={item.label || item.image?.alt || undefined}
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
        </svelte:element>
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
        {#if item.vimeoId || mediaUrl(item.video_mp4) || mediaUrl(item.video_mp4_mobile)}
          <PrismicImage
            class="w-full h-full object-cover absolute top-0 left-0"
            field={item.image}
            imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
            widths={[400, 640, 800, 1200, 1600]}
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading="lazy"
            decoding="async"
          />

          <Video
            mp4={mediaUrl(item.video_mp4)}
            mobileMp4={mediaUrl(item.video_mp4_mobile)}
            vimeoId={item.vimeoId}
            mode={item.loopvideo ? "background" : "player"}
            poster={posterSrc(item.image)}
            captions={captionsUrl(item.video_captions)}
            title={item.label || item.image?.alt || undefined}
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
