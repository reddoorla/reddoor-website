<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import Slideshow from "$lib/components/Slideshow/Slideshow.svelte";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";
  import type {
    ContentWidthImageSlice,
    ContentWidthImageSliceDefaultPrimaryImagesItem,
    GalleryDocumentData,
    GalleryDocumentDataImagesItem,
  } from "../../../prismicio-types";
  import { isFilled } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { slice }: { slice: ContentWidthImageSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.background);

  const animationEnabled = $derived(
    slice.primary.isAnimated === null || slice.primary.isAnimated === true,
  );
  const itemDelayMax = $derived(slice.primary.hasGap ? 400 : 0);

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

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-screen relative {padTop ? 'pt-12' : ''} {padBottom
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
                <Slideshow
                  slides={gallerySlides}
                  aspectClass={slideshowAspectClass(item)}
                  hasNavDots
                >
                  {#snippet slide(media)}
                    <PrismicImage
                      class="w-full h-full object-cover"
                      field={(media as GalleryDocumentDataImagesItem).image}
                      imgixParams={{ auto: ["format", "compress"] }}
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
                  : ''} relative w-full flex flex-col items-center justify-start cursor-pointer {slice
                  .primary.desktopcolumns === '2'
                  ? 'lg:w-1/2'
                  : ''} {slice.primary.desktopcolumns === '3' ? 'lg:w-1/3' : ' '}
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
                <a
                  href={item.link.url}
                  aria-label={item.label || item.image.alt || "View linked media"}
                  class="relative w-full flex flex-col items-center justify-start"
                >
                  {#if item.label}
                    <div class="w-full border-b-1 border-dark label mb-8 cursor-pointer">
                      {item.label}
                    </div>
                  {/if}

                  {#if item.vimeoid}
                    <PrismicImage
                      class="w-full h-full object-cover absolute top-0 left-0 z-0"
                      field={item.image}
                      imgixParams={{ auto: ["format", "compress"] }}
                      widths={[400, 640, 800, 1200, 1600]}
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      loading="lazy"
                      decoding="async"
                    />
                    <VimeoEmbed
                      vimeoId={item.vimeoid}
                      background={!!item.loopvideo}
                      hasPoster={isFilled.image(item.image)}
                      class="object-cover w-full {item.aspect !== 'free'
                        ? 'h-full'
                        : ''} mx-auto z-10"
                    />
                  {:else}
                    <PrismicImage
                      class="w-full {item.aspect !== 'free'
                        ? 'h-full'
                        : ''} object-cover cursor-pointer"
                      field={item.image}
                      imgixParams={{ auto: ["format", "compress"] }}
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

                {#if item.vimeoid}
                  <!-- Poster is absolute against the padded (pr-6/pb-6) cell, so
                       subtract the gap when hasGap to match the video box instead
                       of bleeding into the gap. -->
                  <PrismicImage
                    class="object-cover absolute top-0 left-0 z-0 {slice.primary.hasGap
                      ? 'w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]'
                      : 'w-full h-full'}"
                    field={item.image}
                    imgixParams={{ auto: ["format", "compress"] }}
                    widths={[400, 640, 800, 1200, 1600]}
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    loading="lazy"
                    decoding="async"
                  />
                  <VimeoEmbed
                    vimeoId={item.vimeoid}
                    background={!!item.loopvideo}
                    hasPoster={isFilled.image(item.image)}
                    class="object-cover w-full {item.aspect !== 'free' ? 'h-full' : ''} z-10"
                  />
                {:else}
                  <PrismicImage
                    class="w-full {item.aspect !== 'free' ? 'h-full' : ''} object-cover"
                    field={item.image}
                    imgixParams={{ auto: ["format", "compress"] }}
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
  </section>
{/if}
