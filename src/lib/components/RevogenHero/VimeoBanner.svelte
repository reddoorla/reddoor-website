<script lang="ts">
  // Full-bleed background-video banner (used for the Rubrik Zero Labs full-bleed).
  // A static poster sits underneath; the muted/looping Vimeo embed is layered on
  // top. All the gating (engagement + proximity before the player loads, poster
  // under prefers-reduced-motion, heartbeat-based reveal that survives iOS's
  // muted-autoplay suspension, __cf_bm cookie kept out of automated audits)
  // lives in the shared VimeoEmbed — this component originated that logic and
  // now just supplies the frame and poster.
  import Img from "$lib/components/Img.svelte";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";

  interface Props {
    vimeoId: string;
    poster: unknown; // ?as=run import
    alt: string;
  }
  let { vimeoId, poster, alt }: Props = $props();
</script>

<section class="w-screen aspect-video relative overflow-hidden bg-black">
  <!-- Poster (fallback: pre-play, reduced-motion, iOS suspension) -->
  <Img
    src={poster}
    {alt}
    class="absolute inset-0 h-full w-full object-cover"
    loading="eager"
    fetchpriority="high"
  />

  <!-- The 16:9 embed fills the 16:9 frame exactly, so the video keeps its
       native aspect ratio with no cropping on any breakpoint. -->
  <VimeoEmbed
    {vimeoId}
    background
    title={alt}
    allow="autoplay; fullscreen; picture-in-picture"
    class="absolute inset-0 h-full w-full"
  />
</section>
