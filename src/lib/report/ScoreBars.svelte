<script lang="ts">
  import type { ReportView } from "./model";

  // The scorecard, as lengths rather than four numerals in a row.
  //
  // Four numbers side by side ask the reader to hold all four and compare them.
  // Four bars do that comparison for them: 91 / 82 / 80 / 0 reads as "three
  // long, one empty" before a single digit is parsed. That is the whole finding,
  // and it should not require arithmetic.
  //
  // The numeral stays — it is the thing that gets quoted in a meeting — but it
  // now sits at the end of a bar instead of carrying the comparison alone.

  let { view }: { view: ReportView } = $props();

  // A null score means the stage could not be measured. It must never render as
  // a zero — "we could not check" and "you scored nothing" are different claims
  // about the prospect, and only one of them is ours to make. A null row draws
  // no track at all, so an unmeasured stage cannot be mistaken for a short bar.
  const rows = $derived([
    {
      value: view.scores.findability,
      label: "Findability",
      note: "Whether the AI crawlers can reach your pages at all.",
      alert: false,
    },
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
    {
      value: view.scores.aiVisibility,
      label: "AI Visibility",
      note: "Whether the engines name you when a buyer asks.",
      // The one number that earns emphasis when it is bad, because it is the
      // only one measured out in the world rather than on the site.
      alert: view.scores.aiVisibility === 0,
    },
  ]);
</script>

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

        <!-- The denominator, only under the score it belongs to. A bare 0
             invites an argument; "named in 0 of 5 searches" invites a question. -->
        {#if row.label === "AI Visibility" && view.visibility}
          <p class="type-meta m-0 font-medium text-primary">
            Named in {view.visibility.named} of {view.visibility.total}
            {view.visibility.total === 1 ? "search" : "searches"}.
          </p>
        {/if}
      </div>
    </div>
  {/each}
</dl>
