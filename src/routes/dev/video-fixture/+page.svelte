<script lang="ts">
  import { onMount } from "svelte";
  import Video from "$lib/components/Video.svelte";
  import ContentWidthMedia from "$lib/slices/ContentWidthMedia/index.svelte";
  import type { ContentWidthImageSlice } from "../../../../prismicio-types";

  // Every branch of the shared Video component (P1-74), for
  // tests/smoke/video.spec.ts: each mode self-hosted, with no file (Vimeo
  // plays), and with a file that 404s (Vimeo takes over). The file urls are on
  // Prismic's CDN host and never exist; the spec answers them through
  // page.route. The far cases sit two screens down, for the
  // play-near-the-viewport and visitor's-pause checks.
  onMount(() => document.documentElement.setAttribute("data-hydrated", "true"));

  const cdn = (name: string) => `https://reddoor-la.cdn.prismic.io/reddoor-la/${name}`;
  const VIMEO = "76979871";
  const cases = [
    {
      id: "bg-hosted",
      mode: "background",
      mp4: cdn("bg-1080.mp4"),
      mobile: cdn("bg-phone-720.mp4"),
    },
    { id: "bg-empty", mode: "background", mp4: null, mobile: null },
    {
      id: "bg-dead",
      mode: "background",
      mp4: cdn("dead-1080.mp4"),
      mobile: cdn("dead-phone-720.mp4"),
    },
    {
      id: "player-hosted",
      mode: "player",
      mp4: cdn("pl-1080.mp4"),
      mobile: cdn("pl-phone-720.mp4"),
    },
    { id: "player-empty", mode: "player", mp4: null, mobile: null },
    { id: "player-dead", mode: "player", mp4: cdn("dead-1080.mp4"), mobile: null },
    { id: "bg-phone-only", mode: "background", mp4: null, mobile: cdn("only-phone-720.mp4") },
  ] as const;

  // Linked cards with a video (ContentWidthMedia): the player and the pause
  // button must not sit inside the card's link.
  const fileField = (name: string) => ({
    link_type: "Media",
    kind: "file",
    id: `fixture-${name}`,
    name,
    url: cdn(name),
    size: "1",
  });
  const linkedItem = (label: string, loop: boolean, name: string) => ({
    image: {
      url: "https://images.prismic.io/reddoor-la/fixture.png?auto=format,compress",
      alt: `${label} still`,
      dimensions: { width: 1600, height: 900 },
      id: "fixture",
      edit: { x: 0, y: 0, zoom: 1, background: "transparent" },
      copyright: null,
    },
    vimeoid: VIMEO,
    video_mp4: fileField(name),
    video_mp4_mobile: { link_type: "Any" },
    video_captions: { link_type: "Any" },
    label,
    loopvideo: loop,
    link: { link_type: "Web", url: "/linked-target" },
    aspect: "16/9",
    gallery: { link_type: "Document" },
  });
  const linkedCards = {
    id: "fixture-linked-cards",
    slice_type: "content_width_image",
    slice_label: null,
    variation: "default",
    version: "initial",
    primary: {
      images: [
        linkedItem("Linked player", false, "linked-player-1080.mp4"),
        linkedItem("Linked loop", true, "linked-loop-1080.mp4"),
      ],
      label: null,
      background: "white",
      desktopcolumns: "2",
      isFullContentWidth: false,
      body: [],
      hasGap: true,
      isAnimated: false,
    },
    items: [],
  } as unknown as ContentWidthImageSlice;
</script>

<main class="bg-paper">
  <h1 class="sr-only">Video fixtures</h1>
  {#each cases as c (c.id)}
    <section data-case={c.id} class="relative aspect-video w-80">
      <Video
        mode={c.mode}
        mp4={c.mp4}
        mobileMp4={c.mobile}
        vimeoId={VIMEO}
        hasPoster={false}
        title="Fixture {c.id}"
        captions={c.id === "player-hosted" ? cdn("pl.en.vtt") : null}
        poster={c.mode === "player" ? cdn("pl-poster.png") : null}
        class="absolute inset-0 h-full w-full object-cover"
      />
    </section>
  {/each}
  <div style="height: 250vh" aria-hidden="true"></div>
  <section data-case="bg-far" class="relative aspect-video w-80">
    <Video
      mode="background"
      mp4={cdn("far-1080.mp4")}
      vimeoId={VIMEO}
      hasPoster={false}
      class="absolute inset-0 h-full w-full object-cover"
    />
  </section>
  <section data-case="player-far" class="relative aspect-video w-80">
    <Video
      mode="player"
      mp4={cdn("pl-far-1080.mp4")}
      vimeoId={VIMEO}
      poster={cdn("pl-far-poster.png")}
      title="Fixture player-far"
      class="absolute inset-0 h-full w-full object-cover"
    />
  </section>
  <!-- Last on the page: these cards change height as their posters and
       metadata arrive, which would move anything below them across the
       play/pause margin while a test is clicking it. -->
  <div data-case="linked-cards"><ContentWidthMedia slice={linkedCards} /></div>
  <div style="height: 50vh" aria-hidden="true"></div>
</main>
