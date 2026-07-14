<script lang="ts">
  import ContentWidthMedia from "$lib/slices/ContentWidthMedia/index.svelte";
  import type { ContentWidthImageSlice } from "../../../prismicio-types";

  // Unsplash is imgix-backed (like Prismic media), so PrismicImage's
  // auto=format,compress srcset resolves to real, loadable URLs.
  const img = (id: string, url: string) => ({
    id,
    url,
    alt: null,
    copyright: null,
    dimensions: { width: 1200, height: 800 },
    edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
  });

  // A ContentWidthMedia slice with a single gallery-linked item, resolved as
  // though `fetchLinks: ["gallery.images"]` ran on the page load (the gallery's
  // images live on `.data`). The slice simulator can't resolve content
  // relationships, so this fixture is the Playwright target for the slideshow
  // render path. /dev/* is robots-disallowed and not linked publicly.
  const slice = {
    id: "content_width_image$slideshow-fixture",
    slice_type: "content_width_image",
    slice_label: null,
    variation: "default",
    version: "fixture",
    primary: {
      label: "Gallery slideshow fixture",
      body: [],
      isFullContentWidth: true,
      background: "white",
      desktopcolumns: "1",
      isAnimated: false,
      hasTopPadding: true,
      hasBottomPadding: true,
      hasGap: false,
      hide: false,
      images: [
        {
          label: "",
          image: img("gi-0", "https://images.unsplash.com/photo-1491975474562-1f4e30bc9468"),
          vimeoid: "",
          loopvideo: false,
          link: { link_type: "Any" },
          aspect: "16/9",
          gallery: {
            link_type: "Document",
            id: "gallery-1",
            uid: "sample-gallery",
            type: "gallery",
            tags: [],
            lang: "en-us",
            slug: "sample-gallery",
            isBroken: false,
            data: {
              images: [
                {
                  image: img("g-0", "https://images.unsplash.com/photo-1491975474562-1f4e30bc9468"),
                },
                {
                  image: img("g-1", "https://images.unsplash.com/photo-1500534623283-312aade485b7"),
                },
                {
                  image: img("g-2", "https://images.unsplash.com/photo-1508739773434-c26b3d09e071"),
                },
              ],
            },
          },
        },
      ],
    },
  } as unknown as ContentWidthImageSlice;
</script>

<svelte:head>
  <title>slideshow fixture — Reddoor</title>
  <!-- Test-harness target, not a public page (robots.txt also Disallows /dev/). -->
  <meta name="robots" content="noindex" />
</svelte:head>

<ContentWidthMedia {slice} />
