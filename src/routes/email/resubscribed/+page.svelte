<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

  /**
   * Where GHL lands someone whose re-opt-in it processed. Replaces
   * go.reddoorla.com/resubscribe.
   *
   * Pure confirmation, deliberately: the opt-in this page reports was performed
   * upstream, and a page that re-performed it on load would turn a link
   * scanner opening the email into a consent record.
   */
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">You're back on the list.</h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">Thanks for coming back</h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      <p class="lede">
        Your emails are on again. You'll hear from us the next time we've got something worth
        sending — and there's an unsubscribe link at the bottom of every one, no hard feelings.
      </p>
      <p class="body">
        <a class="text-primary underline" href="/">Back to the site</a>
      </p>
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching the rest of this flow. */
  .lede {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .body {
    margin: 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
</style>
