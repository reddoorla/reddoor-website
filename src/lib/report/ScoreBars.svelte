<script lang="ts">
  import type { ReportView } from "./model";

  // The scorecard, as lengths rather than numerals in a row.
  //
  // Numbers side by side ask the reader to hold all of them and compare. Bars
  // do that comparison for them: 91 / 82 / 80 reads as a shape before a single
  // digit is parsed. The numeral stays — it is the thing that gets quoted in a
  // meeting — but it sits at the end of a bar instead of carrying the
  // comparison alone.
  //
  // AI Visibility used to be the fourth bar here and has been removed, which is
  // the point of this component rather than an omission from it. Findability
  // has now gone the same way, for the opposite reason: not that it promised
  // too much, but that it never said anything. Across the 29 sites audited to
  // date, 26 score 88 or above — because 40 of its 100 points are crawler
  // access and almost every site allows every crawler. A bar that is always
  // long is a picture of our formula, not of their site, and standing beside
  // two bars that DO vary it lent them its own false steadiness.
  //
  // What it actually established is a yes/no, and that is now stated as one
  // above the bars: can the crawlers get in. Kept, because when the answer is
  // no it is the most important line in the report — just not scored.
  //
  // These two measure the site: whether crawlers can read it, whether it
  // answers what buyers ask. Both of them move
  // because we edit the site, with a before and an after. AI visibility is
  // measured out in the world and does not move that way — the published
  // evidence puts its strongest predictors off the site entirely, in off-site
  // brand mentions and existing search rank. Printing it as a fourth bar on
  // this same track says the four are the same kind of claim and that this one
  // is ours to move. Neither is true, so it now has its own section, with the
  // evidence attached and no promise on it.
  //
  // See `Standing.svelte`.

  let { view }: { view: ReportView } = $props();

  // A null score means the stage could not be measured. It must never render as
  // a zero — "we could not check" and "you scored nothing" are different claims
  // about the prospect, and only one of them is ours to make. A null row draws
  // no track at all, so an unmeasured stage cannot be mistaken for a short bar.
  const reach = $derived(view.crawlerReach);

  const rows = $derived([
    {
      value: view.scores.readability,
      label: "Readability",
      note: "Whether they can read what is there once they arrive.",
      alert: false,
    },
    {
      value: view.scores.answers,
      label: "Answers",
      note: "Whether your own copy answers what buyers ask before hiring.",
      alert: false,
    },
  ]);
</script>

<!-- The demoted Findability score: a fact, stated once, above the two numbers
     that actually move. -->
{#if reach}
  <div class="flex flex-col gap-1.5 pb-8">
    <p
      class="type-eyebrow m-0 {reach.measured && reach.blocked.length > 0
        ? 'text-primary'
        : 'text-dark'}"
    >
      Can the AI crawlers reach you
    </p>
    <p
      class="type-lede m-0 max-w-[52ch] {reach.measured && reach.blocked.length > 0
        ? 'text-primary'
        : 'text-black'}"
    >
      {#if !reach.measured}
        We could not check.
      {:else if reach.blocked.length > 0}
        No — your robots.txt turns away {reach.blocked.join(", ")}.
      {:else}
        Yes — all {reach.checked} of the crawlers we checked are allowed in.
      {/if}
    </p>
    <p class="type-meta m-0 max-w-[62ch] text-muted">
      {#if !reach.measured}
        The robots.txt fetch itself failed, so we do not know who you allow in. That is a gap in our
        measurement, not a finding about your site — and it is not counted against you anywhere.
      {:else if reach.blocked.length > 0}
        Nothing else in this report can help while this is true: an engine that cannot fetch a page
        cannot quote it. This is the first thing to fix.
      {:else}
        This is a pass/fail, not a score. Almost every site passes it, so a number here would only
        have made the two below look like the same kind of measurement.
      {/if}
    </p>
  </div>
{/if}

<dl class="m-0 flex w-full flex-col">
  {#each rows as row (row.label)}
    <!-- Numeral and bar share a row so the two halves of one measurement read as
         one object. An earlier pass put the numeral at the far right of the
         content column with the bar beneath the label on the left; the eye had
         to cross the column to pair them, and four rows of that is four
         crossings for information that should cost none. -->
    <div
      class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-5 border-t border-light py-6 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-7.5"
    >
      <!-- Tabular figures so the four numerals share a right edge; a
           proportional "1" is narrow enough to break the column visibly. -->
      <dd
        class="type-display m-0 text-right leading-none tabular-nums {row.alert
          ? 'text-primary'
          : 'text-black'}"
      >
        {row.value ?? "—"}
      </dd>

      <div class="flex min-w-0 flex-col gap-2.5">
        <dt class="type-eyebrow m-0 {row.alert ? 'text-primary' : 'text-dark'}">{row.label}</dt>

        {#if row.value !== null}
          <!-- The track is the measurement, so it is described to assistive tech
               as one: a bare styled div would announce nothing at all, and the
               numeral is already in the <dd>. `aria-hidden` here would hide a
               duplicate, not information. -->
          <div class="h-2 w-full bg-band" role="img" aria-label="{row.value} out of 100">
            <!-- Width is the datum, so it is inline: a Tailwind class cannot
                 carry a runtime number, and rounding it to the nearest step
                 would draw a bar that disagrees with the numeral beside it. -->
            <div
              class="h-full {row.alert ? 'bg-primary' : 'bg-dark'}"
              style="width: {Math.max(0, Math.min(100, row.value))}%"
            ></div>
          </div>
        {/if}

        <p class="type-meta m-0 max-w-[46ch] text-muted">
          {#if row.value === null}
            Not measured on this run.
          {:else}
            {row.note}
          {/if}
        </p>
      </div>
    </div>
  {/each}
</dl>
