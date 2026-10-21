<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { richHTML, type FunnelCopy } from "$lib/funnel-copy/copy";

  /**
   * Where a "No" at the budget gate lands (see +page.ts). The copy thanks them
   * for the straight answer and leaves the door open — no calendar, no pitch.
   * Tucker’s larger ideas for this page (DIY resources, a process library) are
   * floated in Discord 2026-08-24 and not yet approved; until they are, this
   * stays short and gracious rather than half-building them.
   *
   * The words come from Prismic's `funnel_copy` document, with the shipped
   * wording as the fallback.
   */
  let { copy }: { copy: FunnelCopy } = $props();
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">{copy.not_a_fit_heading}</h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">{copy.not_a_fit_kicker}</h2>

    <div class="funnel-body w-full md:w-4/5 max-w-2xl">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html richHTML(copy.not_a_fit_body, "lede")}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html richHTML(copy.not_a_fit_footnote, "muted")}
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching /schedule and the modal — this page is one of
     the frames after that one. #6e6f72 muted is 4.6:1 on white. */
  .funnel-body :global(.lede) {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .funnel-body :global(.muted) {
    margin: 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #6e6f72;
  }
</style>
