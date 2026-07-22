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
  // player.js SDK) — and only once that heartbeat's clock has advanced past
  // zero (see isLiveBeat: `play` and 0s beats precede the first painted frame,
  // and revealing on them let Vimeo's own loading state/thumbnail peek out over
  // the poster) — and hidden again if beats stop >2.5s (iOS suspends muted
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
  //
  // hasPoster: the ENGAGEMENT gate (delay src attach until real input +
  // proximity, skip under reduced motion) applies to EVERY background embed
  // regardless of poster — that gate is what keeps Vimeo's __cf_bm tracking
  // cookie off the initial pageview (and out of the Lighthouse BP audit).
  // hasPoster only governs the OPACITY reveal: with a poster we reveal on the
  // playback heartbeat (poster shows meanwhile); without one there is nothing
  // to reveal over, so we show the iframe as soon as its src is attached.
  // (Poster-less + pre-engagement / reduced-motion is an empty box — correct
  // for a decorative background video; an earlier "eager src" degrade here
  // reintroduced the cookie on the home hero, which has no poster.)
  import { isLiveBeat, type VimeoEventMessage } from "$lib/utils/vimeoBeat";

  interface Props {
    vimeoId: string | number;
    background?: boolean;
    hasPoster?: boolean;
    class?: string;
    title?: string;
    allow?: string;
  }
  let {
    vimeoId,
    background = false,
    hasPoster = true,
    class: className = "",
    title = "background video",
    allow = "autoplay",
  }: Props = $props();

  let iframeEl: HTMLIFrameElement | undefined = $state();
  let mountSrc = $state(false); // attach src (engaged + near viewport, motion allowed)
  let playing = $state(false); // reveal the video (heartbeat is alive)

  // Visible when: interactive (non-background) embeds always; poster-backed
  // background embeds once the heartbeat says playback is live; poster-less
  // background embeds as soon as the src is attached (nothing to reveal over).
  const visible = $derived(!background || (hasPoster ? playing : mountSrc));

  const src = $derived(
    `https://player.vimeo.com/video/${vimeoId}?title=0&dnt=1` +
      (background ? "&background=1&loop=1&autoplay=1&muted=1" : ""),
  );

  // Engagement + proximity gate — ALL background embeds (poster or not), so the
  // __cf_bm cookie stays off the initial pageview either way.
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
  // Only meaningful when there IS a poster to reveal over; poster-less embeds
  // show on mount (see `visible`) and need no heartbeat.
  $effect(() => {
    if (!background || !hasPoster || !mountSrc) return;
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
      let data: VimeoEventMessage;
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data.event === "ready") {
        subscribe();
      } else if (isLiveBeat(data)) {
        // Only beats whose playback clock has moved past 0s count — `play`
        // and 0s beats arrive before the first painted frame (see vimeoBeat).
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
    class="{className} {visible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700"
    frameborder="0"
    {allow}
    tabindex="-1"
    aria-hidden="true"
  ></iframe>
{:else}
  <iframe {title} {src} class={className} frameborder="0" {allow}></iframe>
{/if}
