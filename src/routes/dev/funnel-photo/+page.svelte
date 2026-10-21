<script lang="ts">
  import { page } from "$app/state";
  import SchedulePage from "$lib/components/funnel/SchedulePage.svelte";
  import { DEFAULT_FUNNEL_COPY, type FunnelCopy } from "$lib/funnel-copy/copy";
  import { sampleVisitor } from "$lib/funnel-copy/preview";

  /**
   * /schedule with Tim's photo set, for the smoke test: no document in Prismic
   * has one yet, and the test must not depend on whether one is ever uploaded.
   * The image is the favicon, so it loads offline; absolute, because the
   * Prismic image helpers parse it as a URL.
   */
  const copy: FunnelCopy = {
    ...DEFAULT_FUNNEL_COPY,
    tim_photo: {
      id: "fixture",
      url: `${page.url.origin}/favicon.png`,
      alt: "Tim Holmes at the studio",
      copyright: null,
      dimensions: { width: 100, height: 100 },
      edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
    },
  };
</script>

<SchedulePage
  {copy}
  preview={{ ...sampleVisitor(new Date("2026-10-21T12:00:00Z")), state: "default" }}
/>
