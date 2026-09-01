<script lang="ts">
  // The buyer-question tally as one segmented rule instead of three numerals in
  // three boxes.
  //
  // Three separate cells asked the reader to add them up to learn the only thing
  // that matters here — what proportion of what buyers ask this site actually
  // answers. One bar states that proportion directly, and the counts sit under
  // it as the supporting detail rather than as the headline.

  let {
    yes,
    partial,
    no,
  }: {
    yes: number;
    partial: number;
    no: number;
  } = $props();

  const total = $derived(yes + partial + no);

  // Guarded because a report whose question stage returned nothing would
  // otherwise divide by zero and draw three NaN-width segments.
  function pct(n: number): number {
    return total === 0 ? 0 : (n / total) * 100;
  }

  // The swatch always carries the category's colour — it is the legend key for
  // the bar above. The NUMERAL only turns red when the count is actually bad:
  // "Not answered at all: 0" is the best possible result on that row, and
  // printing that zero in alarm red told the reader the opposite of the truth.
  const segments = $derived([
    { n: yes, label: "Answered clearly", fill: "bg-dark", alert: false },
    { n: partial, label: "Partly answered", fill: "bg-gray", alert: false },
    { n: no, label: "Not answered at all", fill: "bg-primary", alert: no > 0 },
  ]);
</script>

{#if total > 0}
  <div class="flex w-full flex-col gap-5">
    <!-- One track, three segments. Described as a single image because the
         proportion is the datum; the per-segment counts are announced by the
         legend below, so labelling each segment too would read the same numbers
         twice. -->
    <div
      class="flex h-5 w-full overflow-hidden bg-band"
      role="img"
      aria-label="Of {total} questions buyers ask, {yes} are answered clearly, {partial} partly, and {no} not at all."
    >
      {#each segments as seg (seg.label)}
        {#if seg.n > 0}
          <div class="h-full {seg.fill}" style="width: {pct(seg.n)}%"></div>
        {/if}
      {/each}
    </div>

    <dl class="m-0 grid grid-cols-1 gap-5 sm:grid-cols-3">
      {#each segments as seg (seg.label)}
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2.5">
            <span class="h-2.5 w-2.5 shrink-0 {seg.fill}" aria-hidden="true"></span>
            <dd
              class="type-display m-0 leading-none tabular-nums {seg.alert
                ? 'text-primary'
                : 'text-black'}"
            >
              {seg.n}
            </dd>
          </div>
          <dt class="type-meta m-0 text-muted">{seg.label}</dt>
        </div>
      {/each}
    </dl>
  </div>
{/if}
