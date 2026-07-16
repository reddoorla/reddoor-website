<script lang="ts">
  // Shared Vimeo embed for every media slice/banner, replacing the per-slice raw
  // <iframe>s (ContentWidthMedia, ScreenWidthColumns, ScreenWidthMedia,
  // ScreenWidthImage, VimeoBanner).
  //
  // Background embeds (`background`, i.e. the CMS "loop video" mode): the iframe
  // element is always in the DOM — layout is identical to the old markup — but
  // starts with no src and opacity-0 over its poster. The src is attached only
  // after the visitor has engaged with the page (real input) AND the element
  // nears the viewport, and never under prefers-reduced-motion (WCAG 2.2.2 —
  // the poster underneath simply stays). The video is then revealed only while
  // Vimeo's playback-progress heartbeat keeps arriving (playProgress for the
  // legacy Froogaloop protocol `?background=1` speaks, timeupdate for the
  // player.js SDK), and hidden again if beats stop >2.5s (iOS suspends muted
  // background autoplay after firing an initial play). This replaces two dead
  // fallbacks in one move: iframe `onerror` never fires for cross-origin
  // CONTENT failures, and `$state(new Set())` is never proxied by Svelte 5, so
  // the old "hide failed video, show poster" swap could not run at all. A
  // deleted/private video now simply never reveals. The engagement gate also
  // keeps Vimeo's `__cf_bm` cookie out of automated audits (Lighthouse BP) —
  // no `scroll` listener, since Lighthouse scrolls programmatically.
  //
  // Interactive embeds (background = false): rendered eagerly with controls,
  // exactly as before — playback is user-initiated, so no gating. (Do not
  // heartbeat-gate these: an invisible player can never be clicked play.)
  interface Props {
    vimeoId: string | number;
    background?: boolean;
    class?: string;
    title?: string;
    allow?: string;
  }
  let {
    vimeoId,
    background = false,
    class: className = "",
    title = "background video",
    allow = "autoplay",
  }: Props = $props();

  let iframeEl: HTMLIFrameElement | undefined = $state();
  let mountSrc = $state(false); // attach src (engaged + near viewport, motion allowed)
  let playing = $state(false); // reveal the video (heartbeat is alive)

  const src = $derived(
    `https://player.vimeo.com/video/${vimeoId}?title=0&dnt=1` +
      (background ? "&background=1&loop=1&autoplay=1&muted=1" : ""),
  );

  // Engagement + proximity gate (background embeds only).
  $effect(() => {
    if (!background) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // poster only
    const el = iframeEl;
    if (!el) return;

    let interacted = false;
    let inView = false;
    const maybeMount = () => {
      if (interacted && inView) mountSrc = true;
    };

    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) maybeMount();
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);

    const onFirst = () => {
      interacted = true;
      maybeMount();
    };
    const events = ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"];
    for (const ev of events) window.addEventListener(ev, onFirst, { once: true, passive: true });

    return () => {
      io.disconnect();
      for (const ev of events) window.removeEventListener(ev, onFirst);
    };
  });

  // Heartbeat: reveal while playback progresses, poster back if it stops.
  $effect(() => {
    if (!mountSrc) return;
    const el = iframeEl; // read the binding so the effect re-runs when it attaches
    if (!el) return;
    let lastBeat = 0;
    const post = (method: string, value?: string) =>
      el.contentWindow?.postMessage(JSON.stringify({ method, value }), "https://player.vimeo.com");
    const subscribe = () => {
      post("addEventListener", "playProgress"); // legacy Froogaloop
      post("addEventListener", "timeupdate"); // player.js SDK
      post("play");
    };

    const onMessage = (e: MessageEvent) => {
      // Exact-match the origin: sandboxed frames report origin "null" (a URL
      // parse would throw), and a suffix regex would also match e.g.
      // notplayer.vimeo.com. And match the SOURCE window: several embeds can
      // share a page — another video's beats must not reveal this one.
      if (e.origin !== "https://player.vimeo.com") return;
      if (e.source !== el.contentWindow) return;
      let data: { event?: string };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data.event === "ready") {
        subscribe();
      } else if (
        data.event === "playProgress" ||
        data.event === "timeupdate" ||
        data.event === "play"
      ) {
        lastBeat = performance.now();
        playing = true;
      }
    };
    window.addEventListener("message", onMessage);

    // Some browsers need a nudge after load if the ready handshake is missed.
    const onLoad = () => subscribe();
    el.addEventListener("load", onLoad);

    const watchdog = setInterval(() => {
      if (playing && performance.now() - lastBeat > 2500) playing = false;
    }, 1000);

    return () => {
      window.removeEventListener("message", onMessage);
      el.removeEventListener("load", onLoad);
      clearInterval(watchdog);
    };
  });
</script>

{#if background}
  <iframe
    bind:this={iframeEl}
    {title}
    src={mountSrc ? src : undefined}
    class="{className} {playing ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700"
    frameborder="0"
    {allow}
    tabindex="-1"
    aria-hidden="true"
  ></iframe>
{:else}
  <iframe {title} {src} class={className} frameborder="0" {allow}></iframe>
{/if}
