<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import SchedulePage from "$lib/components/funnel/SchedulePage.svelte";
  import NotAFitPage from "$lib/components/funnel/NotAFitPage.svelte";
  import CancelPage from "$lib/components/funnel/CancelPage.svelte";
  import ReschedulePage from "$lib/components/funnel/ReschedulePage.svelte";
  import type { PageProps } from "./$types";

  /**
   * Each section is the real page component, put straight into one state with
   * sample data. Every component given a `preview` turns its network calls
   * off, so nothing on this page can book, cancel or move a call; the smoke
   * test counts the requests to prove it.
   */
  let { data }: PageProps = $props();
  const v = $derived(data.visitor);

  const sections = [
    { id: "schedule", label: "Booking page — arriving cold (/schedule)" },
    { id: "schedule-applied", label: "Booking page — after the questionnaire" },
    { id: "schedule-booked", label: "Booking page — once booked (the confirmation)" },
    { id: "schedule-no-times", label: "Booking page — no open times" },
    { id: "not-a-fit", label: "Not a fit (/not-a-fit)" },
    { id: "cancel", label: "Cancel — the link in the confirmation email" },
    { id: "cancel-done", label: "Cancel — once cancelled" },
    { id: "cancel-gone", label: "Cancel — already cancelled or passed" },
    { id: "cancel-missing", label: "Cancel — booking not found" },
    { id: "reschedule", label: "Reschedule — the link in the confirmation email" },
    { id: "reschedule-done", label: "Reschedule — once moved" },
    { id: "reschedule-gone", label: "Reschedule — already cancelled or passed" },
    { id: "reschedule-missing", label: "Reschedule — booking not found" },
  ] as const;
</script>

<div class="w-screen bg-paper pt-40 pb-12">
  <ContentWidth>
    <p class="type-kicker text-primary">Preview</p>
    <p class="intro">
      Every state of the booking pages, with a sample visitor ({v.email}) and sample times. Nothing
      on this page books, cancels or moves a call.
    </p>
    <ul class="toc">
      {#each sections as s (s.id)}
        <li><a class="text-primary underline" href="#{s.id}">{s.label}</a></li>
      {/each}
    </ul>
  </ContentWidth>
</div>

{#snippet band(id: string)}
  <div class="band" {id}>
    <ContentWidth>
      <p class="band-label">{sections.find((s) => s.id === id)?.label}</p>
    </ContentWidth>
  </div>
{/snippet}

{@render band("schedule")}
<SchedulePage copy={data.copy} preview={{ ...v, state: "default" }} />
{@render band("schedule-applied")}
<SchedulePage copy={data.copy} preview={{ ...v, state: "applied" }} />
{@render band("schedule-booked")}
<SchedulePage copy={data.copy} preview={{ ...v, state: "booked" }} />
{@render band("schedule-no-times")}
<SchedulePage copy={data.copy} preview={{ ...v, slots: [], state: "default" }} />
{@render band("not-a-fit")}
<NotAFitPage copy={data.copy} />
{@render band("cancel")}
<CancelPage copy={data.copy} eventId="preview" preview={{ ...v, state: "ready" }} />
{@render band("cancel-done")}
<CancelPage copy={data.copy} eventId="preview" preview={{ ...v, state: "cancelled" }} />
{@render band("cancel-gone")}
<CancelPage copy={data.copy} eventId="preview" preview={{ ...v, state: "gone" }} />
{@render band("cancel-missing")}
<CancelPage copy={data.copy} eventId="preview" preview={{ ...v, state: "missing" }} />
{@render band("reschedule")}
<ReschedulePage copy={data.copy} eventId="preview" preview={{ ...v, state: "ready" }} />
{@render band("reschedule-done")}
<ReschedulePage copy={data.copy} eventId="preview" preview={{ ...v, state: "moved" }} />
{@render band("reschedule-gone")}
<ReschedulePage copy={data.copy} eventId="preview" preview={{ ...v, state: "gone" }} />
{@render band("reschedule-missing")}
<ReschedulePage copy={data.copy} eventId="preview" preview={{ ...v, state: "missing" }} />

<style>
  .intro {
    margin: 12px 0 20px;
    max-width: 42rem;
    font-size: 18px;
    font-weight: 200;
    line-height: 1.6;
    color: #000;
  }
  .toc {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 15px;
    line-height: 1.9;
  }
  .band {
    padding: 10px 0;
    background: #000;
    color: #fff;
  }
  .band-label {
    margin: 0;
    font-size: 13px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
</style>
