<script lang="ts">
  import { MAX_IMAGE_W } from "$lib/images";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
  import Video from "$lib/components/Video.svelte";
  import { captionsUrl, mediaUrl } from "$lib/video/media";
  import { asImageSrc } from "@prismicio/client";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";
  import type {
    ContentWidthImageSlice,
    ContentWidthImageSliceDefaultPrimaryImagesItem,
    GalleryDocumentData,
    GalleryDocumentDataImagesItem,
  } from "../../../../prismicio-types";
  import { isFilled } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { slice }: { slice: ContentWidthImageSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);

  const animationEnabled = $derived(
    slice.primary.isAnimated === null || slice.primary.isAnimated === true,
  );
  const itemDelayMax = $derived(slice.primary.hasGap ? 400 : 0);

  const pad = $derived(resolvePadding(slice.primary));

  // A video in a linked card would sit inside its <a>: a click on the player
  // or the pause button would follow the link (and a button in a link is
  // invalid). The old Vimeo iframe swallowed those clicks, so a card with a
  // video keeps its link on the label, or on a visually hidden link.
  // A player's poster, sized; Video sets it only when the player nears the
  // viewport (frame 0 would otherwise cover the still underneath). Built as
  // the underlay's own 1600w srcset URL, so it is usually a cache hit.
  const posterSrc = (field: Parameters<typeof asImageSrc>[0]) =>
    asImageSrc(field, { auto: ["format", "compress"], fit: "max", width: 1600 });

  const hasVideo = (item: { video_mp4: unknown; video_mp4_mobile: unknown }, id: unknown) =>
    Boolean(
      id ||
      mediaUrl(item.video_mp4 as Parameters<typeof mediaUrl>[0]) ||
      mediaUrl(item.video_mp4_mobile as Parameters<typeof mediaUrl>[0]),
    );

  type CwmImageItem = ContentWidthImageSliceDefaultPrimaryImagesItem;

  // A gallery-linked item renders as a slideshow. Its images are resolved via
  // `fetchLinks: ["gallery.images"]` in the page load, landing on `.data`. The
  // generated ContentRelationshipField type omits `.data`, so widen it here.
  // Returns the images (>=1) or null when unfilled/unresolved, in which case the
  // item falls through to the existing video/image branches.
  function galleryImages(item: CwmImageItem): GalleryDocumentData["images"] | null {
    const gallery = item.gallery as typeof item.gallery & { data?: GalleryDocumentData };
    if (!isFilled.contentRelationship(gallery)) return null;
    const images = gallery.data?.images;
    return images && images.length > 0 ? images : null;
  }

  // The carousel needs a defined height; "free" (no fixed aspect) falls back to 16/9.
  function slideshowAspectClass(item: CwmImageItem): string {
    switch (item.aspect) {
      case "square":
        return "aspect-square";
      case "4/3":
        return "aspect-4/3";
      case "3/4":
        return "aspect-3/4";
      case "9/16":
        return "aspect-9/16";
      default:
        return "aspect-video";
    }
  }
</script>

<SliceSection
  {slice}
  class="w-screen relative {pad.padTop ? 'pt-12' : ''} {pad.padBottom
    ? 'pb-12'
    : ''} {backgroundColorString}"
>
  <ContentWidth>
    <div class="w-full flex flex-col {slice.primary.isFullContentWidth ? '' : 'md:flex-row'}">
      <div
        use:anim={{ enabled: animationEnabled }}
        class="{slice.primary.isFullContentWidth
          ? 'w-full'
          : 'w-full md:w-1/5 pb-4 md:pb-0 md:pr-4'} h-full overflow-hidden"
      >
        {#if slice.primary.label}
          <!-- Caption/kicker, not a section heading: non-heading <p> keeps it
                 out of the document outline. Weight 200 (body) preserves the look
                 — the old font-bold was suppressed by unlayered element rules. -->
          <p class="font-extralight text-primary">{slice.primary.label}</p>
        {/if}
        <RichTextBody field={slice.primary.body} />
      </div>

      <div
        class="{slice.primary.isFullContentWidth
          ? 'w-full'
          : 'w-full md:w-4/5'} flex flex-row justify-center flex-wrap"
      >
        {#each slice.primary.images as item, i (i)}
          {@const gallerySlides = galleryImages(item)}
          {#if gallerySlides}
            <!-- Gallery-linked item → inline slideshow. Ignores item.link (the
                   carousel owns clicks/swipe; a wrapping <a> would fight controls). -->
            <div
              use:anim={{ enabled: animationEnabled, delayMax: itemDelayMax }}
              class="{slice.primary.hasGap
                ? 'pr-6 pb-6'
                : ''} relative w-full flex flex-col items-center justify-start {slice.primary
                .desktopcolumns === '2'
                ? 'lg:w-1/2'
                : ''} {slice.primary.desktopcolumns === '3' ? 'lg:w-1/3' : ''}"
            >
              {#if item.label}
                <div class="w-full border-b-1 border-dark label mb-8">
                  {item.label}
                </div>
              {/if}
              <Slideshow slides={gallerySlides} aspectClass={slideshowAspectClass(item)} hasNavDots>
                {#snippet slide(media)}
                  <PrismicImage
                    class="w-full h-full object-cover"
                    field={(media as GalleryDocumentDataImagesItem).image}
                    imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
                    widths={[400, 640, 800, 1200, 1600]}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    loading="lazy"
                    decoding="async"
                  />
                {/snippet}
              </Slideshow>
            </div>
          {:else if isFilled.link(item.link)}
            <div
              use:anim={{
                enabled: animationEnabled,
                delayMax: itemDelayMax,
              }}
              class="{slice.primary.hasGap
                ? 'pr-6 pb-6'
                : ''} relative w-full flex flex-col items-center justify-start {hasVideo(
                item,
                item.vimeoid,
              )
                ? ''
                : 'cursor-pointer'} {slice.primary.desktopcolumns === '2' ? 'lg:w-1/2' : ''} {slice
                .primary.desktopcolumns === '3'
                ? 'lg:w-1/3'
                : ' '}
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
                  "
            >
              <svelte:element
                this={hasVideo(item, item.vimeoid) ? "div" : "a"}
                href={hasVideo(item, item.vimeoid) ? undefined : item.link.url}
                aria-label={hasVideo(item, item.vimeoid)
                  ? undefined
                  : item.label || item.image.alt || "View linked media"}
                class="relative w-full flex flex-col items-center justify-start"
              >
                {#if item.label && hasVideo(item, item.vimeoid)}
                  <a
                    href={item.link.url}
                    class="relative z-10 w-full border-b-1 border-dark label mb-8 cursor-pointer block"
                  >
                    {item.label}
                  </a>
                {:else if item.label}
                  <div class="w-full border-b-1 border-dark label mb-8 cursor-pointer">
                    {item.label}
                  </div>
                {:else if hasVideo(item, item.vimeoid)}
                  <a
                    href={item.link.url}
                    class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:bg-white focus:px-2"
                    >{item.image.alt || "View linked media"}</a
                  >
                {/if}

                {#if item.vimeoid || mediaUrl(item.video_mp4) || mediaUrl(item.video_mp4_mobile)}
                  <PrismicImage
                    class="w-full h-full object-cover absolute top-0 left-0 z-0"
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
                    vimeoId={item.vimeoid}
                    mode={item.loopvideo ? "background" : "player"}
                    poster={posterSrc(item.image)}
                    captions={captionsUrl(item.video_captions)}
                    title={item.label || item.image?.alt || undefined}
                    hasPoster={isFilled.image(item.image)}
                    class="object-cover w-full {item.aspect !== 'free'
                      ? 'h-full'
                      : ''} relative mx-auto z-10"
                  />
                {:else}
                  <PrismicImage
                    class="w-full {item.aspect !== 'free'
                      ? 'h-full'
                      : ''} object-cover cursor-pointer"
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
                ? 'pr-6 pb-6'
                : ''} relative w-full flex flex-col items-center justify-start
                      {slice.primary.desktopcolumns === '2' ? 'lg:w-1/2' : ''} {slice.primary
                .desktopcolumns === '3'
                ? 'lg:w-1/3'
                : ''}
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
                        : ''}"
            >
              {#if item.label}
                <div class="w-full border-b-1 border-dark label mb-8">
                  {item.label}
                </div>
              {/if}

              {#if item.vimeoid || mediaUrl(item.video_mp4) || mediaUrl(item.video_mp4_mobile)}
                <!-- Poster is absolute against the padded (pr-6/pb-6) cell, so
                       subtract the gap when hasGap to match the video box instead
                       of bleeding into the gap. -->
                <PrismicImage
                  class="object-cover absolute top-0 left-0 z-0 {slice.primary.hasGap
                    ? 'w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]'
                    : 'w-full h-full'}"
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
                  vimeoId={item.vimeoid}
                  mode={item.loopvideo ? "background" : "player"}
                  poster={posterSrc(item.image)}
                  captions={captionsUrl(item.video_captions)}
                  title={item.label || item.image?.alt || undefined}
                  controlClass={slice.primary.hasGap ? "bottom-10 right-10" : "bottom-4 right-4"}
                  hasPoster={isFilled.image(item.image)}
                  class="object-cover w-full {item.aspect !== 'free' ? 'h-full' : ''} relative z-10"
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
      </div>
    </div>
  </ContentWidth>
</SliceSection>
