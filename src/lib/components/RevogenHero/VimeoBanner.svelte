<script lang="ts">
  // Full-bleed background-video banner (used for the Rubrik Zero Labs full-bleed).
  // A static poster sits underneath; the muted/looping Vimeo iframe is layered on
  // top and only revealed while playback is actually progressing. iOS/iPadOS
  // suspends muted background autoplay after firing an initial play, so we gate
  // the reveal on a continuous `timeupdate` heartbeat (not a one-shot) and fall
  // back to the poster if the beat stops. The iframe is created only when the
  // banner nears the viewport, and never under prefers-reduced-motion.
  import Img from "$lib/components/Img.svelte";

  interface Props {
    vimeoId: string;
    poster: unknown; // ?as=run import
    alt: string;
  }
  let { vimeoId, poster, alt }: Props = $props();

  let sectionEl: HTMLElement | undefined = $state();
  let iframeEl: HTMLIFrameElement | undefined = $state();
  let mount = $state(false); // create the iframe (near viewport, motion allowed)
  let playing = $state(false); // reveal the video (heartbeat is alive)

  const src = $derived(
    `https://player.vimeo.com/video/${vimeoId}?background=1&muted=1&loop=1&autoplay=1&dnt=1`,
  );

  $effect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // poster only
    const el = sectionEl;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mount = true;
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  // Heartbeat: subscribe to Vimeo `timeupdate` via postMessage; reveal while beats
  // keep arriving, hide (show poster) if they stop for >2.5s (iOS suspension).
  $effect(() => {
    if (!mount) return;
    let lastBeat = 0;
    const post = (method: string, value?: string) =>
      iframeEl?.contentWindow?.postMessage(
        JSON.stringify({ method, value }),
        "https://player.vimeo.com",
      );

    const onMessage = (e: MessageEvent) => {
      if (!/player\.vimeo\.com$/.test(new URL(e.origin).host)) return;
      let data: { event?: string };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data.event === "ready") {
        post("addEventListener", "timeupdate");
        post("play");
      } else if (data.event === "timeupdate") {
        lastBeat = performance.now();
        playing = true;
      }
    };
    window.addEventListener("message", onMessage);

    // Some browsers need a nudge after load if the ready handshake is missed.
    const onLoad = () => {
      post("addEventListener", "timeupdate");
      post("play");
    };
    iframeEl?.addEventListener("load", onLoad);

    const watchdog = setInterval(() => {
      if (playing && performance.now() - lastBeat > 2500) playing = false;
    }, 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      iframeEl?.removeEventListener("load", onLoad);
      clearInterval(watchdog);
    };
  });
</script>

<section
  bind:this={sectionEl}
  class="w-screen aspect-3/2 md:aspect-video relative overflow-hidden bg-black"
>
  <!-- Poster (fallback: pre-play, reduced-motion, iOS suspension) -->
  <Img
    src={poster}
    {alt}
    class="absolute inset-0 h-full w-full object-cover"
    loading="eager"
    fetchpriority="high"
  />

  {#if mount}
    <!-- 16:9 iframe scaled to cover the frame (crops sides on the taller mobile ratio) -->
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-video h-full w-auto min-w-full md:w-full md:h-full md:min-w-0 transition-opacity duration-700 {playing
        ? 'opacity-100'
        : 'opacity-0'}"
    >
      <iframe
        bind:this={iframeEl}
        title={alt}
        {src}
        class="w-full h-full"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        tabindex="-1"
        aria-hidden="true"
      ></iframe>
    </div>
  {/if}
</section>
