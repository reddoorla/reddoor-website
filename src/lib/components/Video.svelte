<script lang="ts">
  // The one video component for the site (P1-74). Every clip plays a
  // self-hosted file from Prismic's media library when one is set, and Vimeo
  // otherwise — both when no file is set and when the file fails to load.
  //
  // Self-hosted first: a 1080p H.264 mp4 plus an optional 720p phone mp4
  // behind `<source media="(max-width: 767px)">`, the pattern Williamson's
  // BgVideo set (reddoor-maintenance decision 63). A phone file with no 1080p
  // file plays at every width. A player can carry a WebVTT captions file,
  // shown by default, as Vimeo shows its own.
  //
  // Two modes:
  //
  //   - `player`: native controls, the caller's poster, no autoplay unless
  //     the caller mounted it on the visitor's own click (`autoplay`). The end
  //     is reported through `onended`, so a caller can go back to its poster.
  //   - `background`: muted, looping, inline. It plays while near the
  //     viewport and pauses off screen; a visitor's pause (the round button)
  //     sticks until they press play again. Under prefers-reduced-motion it
  //     never starts. With a poster it fades in only once frames are flowing.
  //
  // The fallback: when no file is set, or the video or its last <source>
  // fires `error` (every source failed), or play() says the format is not
  // supported, the Vimeo embed renders in the same place with the same class.
  // `preload="none"` (background, and the player until it nears the viewport)
  // means the file is not fetched before it is needed, and the embed is only mounted
  // after the file has failed, so a normal load downloads one of the two,
  // never both. A caller with its own Vimeo markup passes it as `fallback`.
  import { onMount, type Snippet } from "svelte";
  import VimeoEmbed from "$lib/components/VimeoEmbed.svelte";

  interface Props {
    mode?: "player" | "background";
    /** The 1080p (or smaller master's) mp4 URL from a link-to-media field. */
    mp4?: string | null;
    /** The 720p phone mp4, used at 767px and below. */
    mobileMp4?: string | null;
    /** The Vimeo id (and unlisted hash) to fall back to. */
    vimeoId?: string | number | null;
    hash?: string;
    /** A poster image URL for the player's own `poster` attribute. */
    poster?: string | null;
    /** Whether the caller renders a poster underneath (background mode):
     *  with one the video fades in over it once playing, without one it shows
     *  at once. Passed through to the Vimeo fallback as well. */
    hasPoster?: boolean;
    /** The player's accessible name, and the Vimeo fallback's title. */
    title?: string;
    /** A player's WebVTT captions file (English). */
    captions?: string | null;
    class?: string;
    allow?: string;
    autoplay?: boolean;
    onended?: () => void;
    /** Called once when the self-hosted file fails, before Vimeo takes over
     *  (or nothing does, with no Vimeo id). */
    onfail?: (hasFallback: boolean) => void;
    /** Background mode: show the pause/play button. */
    pauseControl?: boolean;
    controlClass?: string;
    /** Background mode, bindable: true once frames are flowing. */
    playing?: boolean;
    /** Replaces the default VimeoEmbed as the fallback. */
    fallback?: Snippet;
  }

  let {
    mode = "background",
    mp4 = null,
    mobileMp4 = null,
    vimeoId = null,
    hash = "",
    poster = null,
    hasPoster = true,
    title,
    captions = null,
    class: className = "",
    allow = "autoplay",
    autoplay = false,
    onended,
    onfail,
    pauseControl = true,
    controlClass = "bottom-4 right-4",
    playing = $bindable(false),
    fallback,
  }: Props = $props();

  const background = $derived(mode === "background");
  const hasFile = $derived(Boolean(mp4 || mobileMp4));
  let failed = $state(false);
  const selfHosted = $derived(hasFile && !failed);
  const hasVimeo = $derived(vimeoId !== null && vimeoId !== undefined && String(vimeoId) !== "");

  let video = $state<HTMLVideoElement>();
  let mounted = $state(false);
  let motionOk = $state(true);
  let paused = $state(true);
  let userPaused = false;
  let inView = false;
  // The player fetches its metadata only after hydration, near the viewport.
  let preload = $state<"none" | "metadata">("none");
  // What the component decided, for the smoke tests (and devtools): a
  // background clip `waiting` to come near, `reduced` (never starts), or
  // `playing` / `paused`.
  let motionState = $state<"waiting" | "reduced" | "playing" | "paused">("waiting");
  // The phone file is media-gated only when a 1080p file exists to fall to.
  const phoneMedia = $derived(mp4 ? "(max-width: 767px)" : undefined);
  const playerName = $derived(title || "Video");

  function fail() {
    if (failed) return;
    failed = true;
    playing = false;
    onfail?.(Boolean(fallback) || hasVimeo);
  }

  function play() {
    const el = video;
    if (!el) return;
    try {
      el.play()?.catch?.((err: unknown) => {
        // A format no source can play is a failed file; anything else
        // (autoplay refused, a pause racing the play) is not.
        if ((err as { name?: string })?.name === "NotSupportedError") fail();
      });
    } catch {
      return;
    }
  }

  onMount(() => {
    mounted = true;
    // Svelte does not replay a media element's or a <source>'s `error` that
    // fired before hydration (its replay list has neither), so nothing may
    // fetch before then: the server renders preload="none", and a background
    // clip fetches only through play(). A media element's own error state is
    // still worth a look. (Not networkState: NETWORK_NO_SOURCE is also the
    // state it waits in while its <source> children are being inserted.)
    if (video?.error) fail();
  });

  // A player fetches its metadata once it nears the viewport, with the error
  // listeners in place, so a dead file falls back before anyone presses play
  // and a page of players below the fold fetches nothing at load. A player
  // mounted on a click with `autoplay` is already loading.
  $effect(() => {
    if (background || !selfHosted || autoplay) return;
    const el = video;
    if (!el) return;
    const start = () => {
      preload = "metadata";
      el.load();
    };
    if (typeof IntersectionObserver === "undefined") return start();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  // Background: near the viewport, play; off it, pause. Reduced motion never
  // starts it, and turning reduced motion on mid-play stops it.
  $effect(() => {
    if (!background || !selfHosted) return;
    const el = video;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    motionOk = !reduce?.matches;
    if (!motionOk) motionState = "reduced";
    const onChange = (event: MediaQueryListEvent) => {
      motionOk = !event.matches;
      motionState = event.matches ? "reduced" : "waiting";
      if (event.matches) el.pause();
      else if (inView && !userPaused) play();
    };
    reduce?.addEventListener?.("change", onChange);

    if (typeof IntersectionObserver === "undefined") {
      inView = true;
      if (motionOk) play();
      return () => reduce?.removeEventListener?.("change", onChange);
    }
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((e) => e.isIntersecting);
        if (inView) {
          if (motionOk && !userPaused) play();
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      reduce?.removeEventListener?.("change", onChange);
    };
  });

  function toggle(event: MouseEvent) {
    // Inside a linked card the button must not also follow the link.
    event.preventDefault();
    event.stopPropagation();
    if (paused) {
      userPaused = false;
      play();
    } else {
      userPaused = true;
      video?.pause();
    }
  }

  const revealed = $derived(!hasPoster || playing);
</script>

{#if selfHosted && background}
  <video
    bind:this={video}
    class="{className} {revealed ? 'opacity-100' : 'opacity-0'} {motionOk
      ? 'transition-opacity duration-700'
      : ''}"
    muted
    loop
    playsinline
    preload="none"
    aria-hidden="true"
    tabindex="-1"
    data-video="self-hosted"
    data-state={motionState}
    onplay={() => (paused = false)}
    onplaying={() => {
      playing = true;
      motionState = "playing";
    }}
    onpause={() => {
      paused = true;
      if (motionState === "playing") motionState = "paused";
    }}
    onerror={fail}
  >
    {#if mobileMp4}<source
        src={mobileMp4}
        type="video/mp4"
        media={phoneMedia}
        onerror={mp4 ? undefined : fail}
      />{/if}
    {#if mp4}<source src={mp4} type="video/mp4" onerror={fail} />{/if}
  </video>
  <!-- z-10, not z-20: the fixed site nav is z-20 and comes first in the
       DOM, so a z-20 button would paint over it. Later in the DOM than the
       z-10 video, the button still sits above it. -->
  {#if pauseControl && mounted && motionOk}
    <button
      type="button"
      class="absolute z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white focus-visible:ring-4 focus-visible:ring-black {controlClass}"
      aria-label="{paused ? 'Play' : 'Pause'} background video{title ? `: ${title}` : ''}"
      onclick={toggle}
    >
      {#if paused}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"
          ><path d="M4 2.5v11l9-5.5z" /></svg
        >
      {:else}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"
          ><path d="M3.5 2h3v12h-3zM9.5 2h3v12h-3z" /></svg
        >
      {/if}
    </button>
  {/if}
{:else if selfHosted}
  <video
    bind:this={video}
    class={className}
    controls
    playsinline
    crossorigin="anonymous"
    tabindex="0"
    {preload}
    {autoplay}
    poster={poster || undefined}
    aria-label={playerName}
    data-video="self-hosted"
    onended={() => onended?.()}
    onerror={fail}
  >
    {#if mobileMp4}<source
        src={mobileMp4}
        type="video/mp4"
        media={phoneMedia}
        onerror={mp4 ? undefined : fail}
      />{/if}
    {#if mp4}<source src={mp4} type="video/mp4" onerror={fail} />{/if}
    {#if captions}<track kind="captions" srclang="en" label="English" src={captions} default />{/if}
  </video>
{:else if fallback}
  {@render fallback()}
{:else if hasVimeo}
  <VimeoEmbed
    vimeoId={vimeoId as string | number}
    {hash}
    {background}
    {hasPoster}
    {...title ? { title } : {}}
    {allow}
    {autoplay}
    {onended}
    class={className}
  />
{/if}
