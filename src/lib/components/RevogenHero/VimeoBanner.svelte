<script lang="ts">
  // Full-bleed background-video banner (used for the Rubrik Zero Labs full-bleed).
  // A static poster sits underneath; the muted/looping Vimeo embed is layered on
  // top. All the gating (engagement + proximity before the player loads, poster
  // under prefers-reduced-motion, heartbeat-based reveal that survives iOS's
  // muted-autoplay suspension, __cf_bm cookie kept out of automated audits)
  // lives in the shared VimeoEmbed — this component originated that logic and
  // now just supplies the frame and poster.
  import Img from "$lib/components/Img.svelte";
  import Video from "$lib/components/Video.svelte";

  interface Props {
    vimeoId: string;
    poster: unknown; // ?as=run import
    alt: string;
    /** Self-hosted renditions; Vimeo plays when neither is set or they fail. */
    mp4?: string | null;
    mobileMp4?: string | null;
  }
  let { vimeoId, poster, alt, mp4 = null, mobileMp4 = null }: Props = $props();
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
  <Video
    {mp4}
    {mobileMp4}
    {vimeoId}
    mode="background"
    title={alt}
    allow="autoplay; fullscreen; picture-in-picture"
    class="absolute inset-0 h-full w-full"
  />
</section>
