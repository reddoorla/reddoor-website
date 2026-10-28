<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import VideoCard from "$lib/components/VideoCard.svelte";
  import { captionsUrl, mediaUrl } from "$lib/video/media";
  import { PrismicRichText } from "@prismicio/svelte";
  import type { RichTextComponents } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";

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

  // The self-hosted file plays first; Vimeo is the fallback when it is not set
  // or fails to load (see Video.svelte and VideoCard.svelte).
  const videoTitle = $derived(slice.primary.video_title?.trim() || "Video");

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

      <VideoCard
        vimeo={slice.primary.vimeo_video}
        mp4={mediaUrl(slice.primary.video_mp4)}
        mobileMp4={mediaUrl(slice.primary.video_mp4_mobile)}
        captions={captionsUrl(slice.primary.video_captions)}
        poster={slice.primary.video_poster}
        title={videoTitle}
        class="offer-card mt-10 max-w-256 rounded-[9px] bg-white shadow-[0_4px_11.5px_rgba(0,0,0,0.11)] md:mt-12"
      />
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
     the board's 1024px (its `max-w-256`, which --card-max must match), at 16:9; the red layer stops 74% of the card's height
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

  .offer-email {
    filter: drop-shadow(0 4.81px 9.5px rgba(0, 0, 0, 0.15));
  }
  .offer-email::placeholder {
    color: #767676;
  }
</style>
