<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import Video from "$lib/components/Video.svelte";
  import { captionsUrl, mediaUrl } from "$lib/video/media";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import type { RichTextComponents } from "@prismicio/svelte";
  import { asImageSrc, isFilled, type Content } from "@prismicio/client";
  import { tick } from "svelte";
  import { parseVimeo } from "./vimeo";
  import playDisc from "$lib/assets/offer/play-disc.svg";
  import playTriangle from "$lib/assets/offer/play-triangle.svg";

  // The offer landing page's masthead (Figma "Offer Landing page", 5276:16750):
  // the headline on the red band, a 16:9 video card straddling the red-to-paper
  // break, and an email field that opens the inquiry questionnaire. Built for
  // an `industry` document, which is what mounts the InquiryModal and trims the
  // nav to the board's Portfolio / About / Get Started.

  let { slice }: { slice: Content.OfferHeroSlice } = $props();

  // The headline is the page's <h1>, kept a real h1 with the hero's pinned type
  // — the same reasoning as IndustryHero, whose `.type-hero` this shares.
  const headlineComponents: RichTextComponents = {
    heading1: { class: "type-hero m-0 max-w-242.5 text-white" },
  };

  const vimeo = $derived(parseVimeo(slice.primary.vimeo_video));
  // The self-hosted file plays first; Vimeo is the fallback when it is not set
  // or fails to load (see Video.svelte).
  const mp4 = $derived(mediaUrl(slice.primary.video_mp4));
  const mobileMp4 = $derived(mediaUrl(slice.primary.video_mp4_mobile));
  const video = $derived(Boolean(vimeo || mp4 || mobileMp4));
  const videoTitle = $derived(slice.primary.video_title?.trim() || "Video");
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
  // button) never leads a visitor off the offer. Focus goes back to the button,
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
  const posterUnnamed = $derived(!video && !slice.primary.video_poster?.alt?.trim());

  // The visitor's address, handed to the modal on the trigger itself
  // (data-inquire-email) so frame one opens already filled in.
  let email = $state("");
  // When the visitor started typing, carried with the address so the modal's
  // bot-screen clock measures the real fill rather than starting at zero.
  let startedAt = $state(0);
  const buttonLabel = $derived(slice.primary.button_label?.trim() || "Get Started");
</script>

<SliceSection {slice} class="relative w-full overflow-hidden bg-paper">
  <div class="offer-top relative">
    <!-- The red band runs from the top of the page to a quarter of the way down
         the card, where the board breaks to paper (y 626 against a card at
         477–1053). It is a layer rather than the text block's own background so
         the card can straddle it. `data-masthead` makes it what the layout
         measures to keep the overlay nav up, so the fixed nav takes over at the
         break rather than below the card. -->
    <div
      class="offer-red bg-paper-red absolute inset-x-0 top-0"
      aria-hidden="true"
      data-masthead
    ></div>

    <ContentWidth class="relative flex flex-col items-start pt-32 md:pt-40 xl:pt-47.5">
      {#if slice.primary.eyebrow}
        <p class="type-kicker m-0 text-white">{slice.primary.eyebrow}</p>
      {/if}
      {#if isFilled.richText(slice.primary.headline)}
        <div class="mt-5">
          <PrismicRichText field={slice.primary.headline} components={headlineComponents} />
        </div>
      {/if}
      {#if slice.primary.subhead}
        <p class="offer-subhead m-0 mt-3 text-white md:mt-5">{slice.primary.subhead}</p>
      {/if}

      <div
        bind:this={card}
        class="offer-card relative mt-10 aspect-video w-full overflow-hidden rounded-[9px] bg-white shadow-[0_4px_11.5px_rgba(0,0,0,0.11)] md:mt-12"
      >
        {#if video && playing}
          <Video
            mode="player"
            {mp4}
            {mobileMp4}
            vimeoId={vimeo?.id}
            hash={vimeo?.hash}
            captions={captionsUrl(slice.primary.video_captions)}
            poster={asImageSrc(slice.primary.video_poster, {
              auto: ["format", "compress"],
              width: 1440,
            })}
            onfail={failed}
            autoplay
            onended={ended}
            title={videoTitle}
            allow="autoplay; fullscreen; picture-in-picture"
            class="absolute inset-0 h-full w-full object-cover"
          />
        {:else}
          {#if isFilled.image(slice.primary.video_poster)}
            <!-- The poster carries the card's copy in the image itself (it is
                 the video's own title frame), so without a video its alt text,
                 set on the asset in Prismic, is what a screen reader gets. With
                 a video the play button carries the name and the still is
                 decorative. -->
            <PrismicImage
              field={slice.primary.video_poster}
              alt={video ? "" : undefined}
              fallbackAlt=""
              class="absolute inset-0 h-full w-full object-cover"
              imgixParams={{ auto: ["format", "compress"] }}
              widths={[640, 1024, 1440, 2048]}
              sizes="(min-width: 1120px) 1024px, 92vw"
              loading="eager"
            />
          {/if}
          {#if video}
            <button
              type="button"
              class="offer-play absolute inset-0 flex cursor-pointer items-center justify-center"
              aria-label="Play video: {videoTitle}"
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
              <span class="sr-only">{videoTitle}</span>
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
    </ContentWidth>
  </div>

  <ContentWidth class="relative pt-8 pb-24 md:pb-40 xl:pb-49">
    <div
      class="flex w-full max-w-235.5 flex-col gap-6 md:flex-row md:items-center md:gap-5 lg:ml-12.5"
    >
      <div class="flex flex-1 flex-col gap-2.25 text-black">
        {#if slice.primary.cta_heading}
          <h2 class="type-lede m-0">{slice.primary.cta_heading}</h2>
        {/if}
        {#if slice.primary.cta_body}
          <p class="m-0 text-[16px] leading-6 font-normal">{slice.primary.cta_body}</p>
        {/if}
      </div>

      <!-- Without JS this lands on /contact's own form. With JS the modal's
           delegated listener catches the submit button's click (Enter in the
           field fires the same click) before the form submits. The input has no
           `name`, so the address never rides in a URL. -->
      <form
        action="/contact#inquire"
        method="get"
        class="flex w-full flex-col gap-4 sm:flex-row sm:items-center md:w-auto md:gap-6"
      >
        <label for="offer-email-{slice.id}" class="sr-only">Email address</label>
        <input
          id="offer-email-{slice.id}"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder={slice.primary.email_placeholder || "Email Address"}
          bind:value={email}
          oninput={() => (startedAt ||= Date.now())}
          class="offer-email h-12 w-full rounded-[6px] border-0 bg-white px-3 text-[16px] text-black md:w-79.5"
        />
        <button
          type="submit"
          data-inquire
          data-inquire-email={email.trim() || undefined}
          data-inquire-started={startedAt || undefined}
          class="h-12 shrink-0 cursor-pointer rounded-[4px] border-1 border-primary bg-primary px-4.5 text-[20px] font-normal text-white transition-colors duration-300 hover:bg-primary-dark"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  </ContentWidth>
</SliceSection>

<style>
  /* The card is the content column's full width (ContentWidth's 92%) up to
     the board's 1024px, at 16:9; the red layer stops 74% of the card's height
     above this block's bottom edge (the board's break sits 149px into a 576px
     card). Container units, not vw, so a classic scrollbar can't skew it. */
  .offer-top {
    container-type: inline-size;
    --card-max: 1024px;
  }
  .offer-red {
    /* vw first, for a browser without container units (Safari < 16), where
       the cqw line is dropped and the band would otherwise collapse. */
    bottom: calc(min(92vw, var(--card-max)) * 9 / 16 * 0.74);
    bottom: calc(min(92cqw, var(--card-max)) * 9 / 16 * 0.74);
  }
  .offer-card {
    max-width: var(--card-max);
  }

  /* Pragmatica Light 21/30, the board's Body 1. */
  .offer-subhead {
    font-family: pragmatica, helvetica, sans-serif;
    font-size: 18px;
    font-weight: 300;
    line-height: 26px;
  }
  @media (min-width: 768px) {
    .offer-subhead {
      font-size: 21px;
      line-height: 30px;
    }
  }

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

  .offer-email {
    filter: drop-shadow(0 4.81px 9.5px rgba(0, 0, 0, 0.15));
  }
  .offer-email::placeholder {
    color: #767676;
  }
</style>
