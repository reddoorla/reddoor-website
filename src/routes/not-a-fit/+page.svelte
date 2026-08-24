<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

  /**
   * Where a "No" at the budget gate lands (see +page.ts). The copy thanks them
   * for the straight answer and leaves the door open — no calendar, no pitch.
   * Tucker's larger ideas for this page (DIY resources, a process library) are
   * floated in Discord 2026-08-24 and not yet approved; until they are, this
   * stays short and gracious rather than half-building them.
   */
</script>

<div class="w-screen h-[50vh] max-h-96 relative bg-paper">
  <ContentWidth class="h-full flex flex-col justify-evenly items-start">
    <div class="h-32"></div>
    <h1 class="type-hero text-primary z-10 md:ml-[20%]">Thanks for being straight with us.</h1>
  </ContentWidth>
</div>

<div class="w-screen bg-white py-16">
  <ContentWidth class="flex flex-col md:flex-row gap-8 mb-32">
    <h2 class="type-kicker md:w-1/5 text-primary shrink-0">Where this leaves us</h2>

    <div class="w-full md:w-4/5 max-w-2xl">
      <p class="lede">
        Rebuilding a brand properly — diagnosing what's broken, then designing and rolling out the
        fix — is a real investment, and it isn't the right spend for every business at every moment.
        If that's beyond the budget right now, the honest answer is that we're not the right fit
        today, and we'd rather tell you that here than thirty minutes into a call.
      </p>
      <p class="lede">
        That can change. Budgets grow, projects sharpen, and our door stays open — if the picture
        shifts, start the application again and we'll pick it up from there.
      </p>
      <p class="muted">
        In the meantime, you're welcome to
        <a class="text-primary underline" href="/portfolio">look through our work</a> — and if you'd
        like to ask us something anyway,
        <a class="text-primary underline" href="mailto:info@reddoorla.com">info@reddoorla.com</a>
        reaches a human.
      </p>
    </div>
  </ContentWidth>
</div>

<style>
  /* Values, not tokens, matching /schedule and the modal — this page is one of
     the frames after that one. #6e6f72 muted is 4.6:1 on white. */
  .lede {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .muted {
    margin: 0;
    font-size: 16px;
    font-weight: 200;
    line-height: 1.6;
    color: #6e6f72;
  }
</style>
