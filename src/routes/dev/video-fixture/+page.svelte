<script lang="ts">
  import { onMount } from "svelte";
  import Video from "$lib/components/Video.svelte";

  // Every branch of the shared Video component (P1-74), for
  // tests/smoke/video.spec.ts: each mode self-hosted, with no file (Vimeo
  // plays), and with a file that 404s (Vimeo takes over). The file urls are on
  // Prismic's CDN host and never exist; the spec answers them through
  // page.route. The last case sits two screens down, for the
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
  ] as const;
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
  <div style="height: 50vh" aria-hidden="true"></div>
</main>
