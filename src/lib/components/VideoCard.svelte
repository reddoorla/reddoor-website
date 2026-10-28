<script lang="ts">
  import Video from "$lib/components/Video.svelte";
  import { parseVimeo } from "$lib/slices/OfferHero/vimeo";
  import { PrismicImage } from "@prismicio/svelte";
  import { asImageSrc, isFilled, type ImageField } from "@prismicio/client";
  import { tick } from "svelte";
  import playDisc from "$lib/assets/offer/play-disc.svg";
  import playTriangle from "$lib/assets/offer/play-triangle.svg";

  /**
   * A 16:9 video card: the poster and the board's play mark until pressed, then
   * the player (self-hosted first, Vimeo behind it; see Video.svelte), and the
   * poster again at the end. Built for the offer page's masthead (OfferHero)
   * and shared with the booked page, so both behave the same at the end and on
   * a failed file.
   */
  interface Props {
    /** The editor's Vimeo paste (link, id or embed snippet). */
    vimeo?: string | null;
    mp4?: string | null;
    mobileMp4?: string | null;
    captions?: string | null;
    poster?: ImageField | null;
    /** The play button's and the player's accessible name. */
    title?: string;
    /** The card's own classes: its size, margin, radius and shadow. */
    class?: string;
    /** `sizes` for the poster at this card's width. */
    sizes?: string;
  }

  let {
    vimeo: vimeoRaw = null,
    mp4 = null,
    mobileMp4 = null,
    captions = null,
    poster = null,
    title = "Video",
    class: className = "",
    sizes = "(min-width: 1120px) 1024px, 92vw",
  }: Props = $props();

  const vimeo = $derived(parseVimeo(vimeoRaw));
  const video = $derived(Boolean(vimeo || mp4 || mobileMp4));
  const hasPoster = $derived(Boolean(poster && isFilled.image(poster)));
  let playing = $state(false);
  let card = $state<HTMLElement>();

  // The play button unmounts as the player mounts, so focus would drop to
  // <body>; hand it to the player instead.
  async function play() {
    playing = true;
    await tick();
    card?.querySelector<HTMLElement>("video, iframe")?.focus();
  }

  // At the end the player comes down and the card is its poster and play
  // button again, so Vimeo's end screen (other Reddoor videos, a Follow
  // button) never leads a visitor off the page. Focus goes back to the button,
  // but only if it was in the player (or nowhere): a visitor typing their email
  // while the video runs keeps their place, and nobody is scrolled back up.
  async function ended() {
    const active = document.activeElement;
    const hadFocus = !active || active === document.body || !!card?.contains(active);
    playing = false;
    await tick();
    if (hadFocus) card?.querySelector<HTMLElement>(".offer-play")?.focus({ preventScroll: true });
  }

  // The file failed. With Vimeo behind it the player is swapped in place, and
  // focus, which was on the removed <video>, goes to the new player. With
  // nothing behind it the card goes back to its poster, rather than a blank
  // box with no way back.
  async function failed(hasFallback: boolean) {
    // As at the end: focus follows only if it was in the card (or nowhere).
    const active = document.activeElement;
    const hadFocus = !active || active === document.body || !!card?.contains(active);
    if (!hasFallback) playing = false;
    await tick();
    if (!hadFocus) return;
    if (hasFallback) card?.querySelector<HTMLElement>("iframe")?.focus({ preventScroll: true });
    else card?.querySelector<HTMLElement>(".offer-play")?.focus({ preventScroll: true });
  }

  // With no video and no alt text on the poster asset, the card's copy (which
  // is in the pixels) would have no name at all.
  const posterUnnamed = $derived(!video && !poster?.alt?.trim());
</script>

<div bind:this={card} class="relative aspect-video w-full overflow-hidden {className}">
  {#if video && playing}
    <Video
      mode="player"
      {mp4}
      {mobileMp4}
      vimeoId={vimeo?.id}
      hash={vimeo?.hash}
      {captions}
      poster={hasPoster
        ? asImageSrc(poster, {
            auto: ["format", "compress"],
            w: undefined,
            h: undefined,
            width: 1440,
          })
        : null}
      onfail={failed}
      autoplay
      onended={ended}
      {title}
      allow="autoplay; fullscreen; picture-in-picture"
      class="absolute inset-0 h-full w-full object-cover"
    />
  {:else}
    {#if poster && isFilled.image(poster)}
      <!-- The poster carries the card's copy in the image itself (it is
           the video's own title frame), so without a video its alt text,
           set on the asset in Prismic, is what a screen reader gets. With
           a video the play button carries the name and the still is
           decorative. -->
      <PrismicImage
        field={poster}
        alt={video ? "" : undefined}
        fallbackAlt=""
        class="absolute inset-0 h-full w-full object-cover"
        imgixParams={{ auto: ["format", "compress"] }}
        widths={[640, 1024, 1440, 2048]}
        {sizes}
        loading="eager"
      />
    {/if}
    {#if video}
      <button
        type="button"
        class="offer-play absolute inset-0 flex cursor-pointer items-center justify-center"
        aria-label="Play video: {title}"
        onclick={play}
      >
        <span class="offer-play-glyph relative block" aria-hidden="true">
          <img src={playDisc} alt="" class="absolute inset-0 h-full w-full" />
          <img src={playTriangle} alt="" class="offer-play-triangle absolute" />
        </span>
      </button>
    {:else}
      <!-- No video yet: the still and its play mark, as the board draws
           them, with nothing to activate. -->
      {#if posterUnnamed}
        <span class="sr-only">{title}</span>
      {/if}
      <span
        class="offer-play pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span class="offer-play-glyph relative block">
          <img src={playDisc} alt="" class="absolute inset-0 h-full w-full" />
          <img src={playTriangle} alt="" class="offer-play-triangle absolute" />
        </span>
      </span>
    {/if}
  {/if}
</div>

<style>
  /* The board's play mark: an 187px disc on a 1024px card (18.25%), the
     triangle a 116px box inside it, turned to point right. */
  .offer-play-glyph {
    width: 18.25%;
    aspect-ratio: 1;
  }
  .offer-play-triangle {
    width: 53.58%;
    height: 46.4%;
    left: 50%;
    top: 50%;
    transform: translate(-42%, -50%) rotate(90deg);
  }
  /* Two-tone, so the ring shows on a light or a dark poster. */
  .offer-play:focus-visible {
    outline: 3px solid #fff;
    outline-offset: -6px;
    box-shadow: inset 0 0 0 6px #000;
  }
</style>
