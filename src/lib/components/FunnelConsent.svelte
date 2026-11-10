<script lang="ts">
  import { page } from "$app/state";
  import { fly } from "svelte/transition";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import {
    isFunnelPath,
    readConsent,
    saveConsent,
    trackFunnelPageView,
    type Consent,
    type PixelWindow,
  } from "$lib/consent/metaPixel";

  // The consent ask for the MedTech funnel's Meta Pixel ($lib/consent/metaPixel).
  // It renders only on a funnel page and only until answered, and it is a bar,
  // not a modal: these are conversion pages, and a gate that blocks the offer
  // until the visitor deals with cookies costs exactly the leads the pixel is
  // there to count. Nothing loads from Facebook until Accept.
  //
  // z-[25]: above the page and its nav (z-20), below the menu overlay (z-30),
  // which is an aria-modal focus trap. Above it, the bar's buttons would show
  // over the menu but be out of reach of Tab and hidden from screen readers.

  let consent = $state<Consent>(null);
  let ready = $state(false);

  // A derived, so a hash change (`#inquire` opens the modal) or a query change
  // does not count as a new page: it only notifies when the path itself moves.
  const pathname = $derived(page.url.pathname);
  const onFunnel = $derived(isFunnelPath(pathname));

  // Svelte's JS transitions ignore prefers-reduced-motion; the bar honours it.
  let reduceMotion = $state(false);

  $effect(() => {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    consent = readConsent(() => localStorage);
    ready = true;
  });

  // One PageView per funnel page shown, including SPA arrivals (the inquiry
  // hands over to /schedule with goto). Reading `pathname` makes this re-run on
  // every navigation; leaving the funnel tracks nothing.
  $effect(() => {
    if (ready && onFunnel && consent === "accepted") {
      void pathname;
      trackFunnelPageView(window as unknown as PixelWindow, document, consent);
    }
  });

  function answer(accepted: boolean) {
    saveConsent(() => localStorage, accepted);
    consent = accepted ? "accepted" : "rejected";
  }
</script>

{#if ready && onFunnel && consent === null}
  <div
    role="region"
    aria-label="Cookie consent"
    data-funnel-consent
    class="fixed inset-x-0 bottom-0 z-[25] bg-black text-white"
    transition:fly={{ y: 64, duration: reduceMotion ? 0 : 400 }}
  >
    <ContentWidth
      class="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-10"
    >
      <p class="text-sm md:text-base">
        We use cookies to measure how visitors find this page. Accept to allow them, or reject to
        keep only the ones the site needs.
      </p>
      <div class="flex shrink-0 flex-row gap-3">
        <button
          type="button"
          class="cursor-pointer rounded-[4px] border-1 border-white bg-white px-5 py-2 tracking-wider text-black transition-opacity hover:opacity-80"
          onclick={() => answer(true)}>Accept</button
        >
        <button
          type="button"
          class="cursor-pointer rounded-[4px] border-1 border-white px-5 py-2 tracking-wider text-white transition-colors hover:bg-white hover:text-black"
          onclick={() => answer(false)}>Reject</button
        >
      </div>
    </ContentWidth>
  </div>
{/if}
