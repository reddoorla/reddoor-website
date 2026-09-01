<script lang="ts">
  import type { CitedDomain } from "./model";

  // Who the engine cited when a buyer asked for this category — ranked, as bars,
  // with the prospect's own row drawn on the same scale at the bottom.
  //
  // This replaces a wall of equally-sized chips. Chips gave every domain the
  // same visual weight, so "cited seven times" and "cited once" looked
  // identical, and the prospect's own absence was not represented at all — it
  // was a sentence above the list. Absence is the finding. It should be the
  // longest thing on the page pointing at nothing.
  //
  // The competitor counts exclude the prospect's own domain upstream (the probe
  // stage skips same-site citations when tallying), so the "you" row is added
  // here from the visibility tally rather than looked for in the list.

  let {
    domains,
    url,
    namedCount,
    namesakeDomain = null,
    max = 8,
  }: {
    domains: CitedDomain[];
    /** The audited site. Its host labels the prospect's own row, so every row on
     *  the chart is a domain — mixing a trading name in among hostnames is what
     *  let the namesake collision below read as a contradiction. */
    url: string;
    /** How many of the category searches named the prospect at all. */
    namedCount: number;
    /** A cited domain whose NAME resembles the prospect's but which is a
     *  different company. Called out inline because otherwise the chart shows
     *  what looks like the same business at both ends — cited fifteen times at
     *  the top and zero at the bottom — and a reader takes that for a bug in the
     *  report rather than the finding it actually is. */
    namesakeDomain?: string | null;
    max?: number;
  } = $props();

  const ownDomain = $derived.by(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  });

  const top = $derived([...domains].sort((a, b) => b.count - a.count).slice(0, max));

  // The scale is shared by every row including the prospect's, so the bars are
  // comparable. Floor of 1 keeps a division by zero out of the width when
  // nothing was cited at all.
  const scale = $derived(Math.max(1, top[0]?.count ?? 0, namedCount));

  const hidden = $derived(Math.max(0, domains.length - top.length));

  function pct(n: number): number {
    return Math.round((n / scale) * 100);
  }
</script>

<div class="flex w-full flex-col gap-5">
  {#each top as row (row.domain)}
    {@const isNamesake = namesakeDomain !== null && row.domain === namesakeDomain}
    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between gap-5">
        <p class="type-meta m-0 flex min-w-0 flex-wrap items-baseline gap-x-2.5 text-black">
          <span class="truncate">{row.domain}</span>
          {#if isNamesake}
            <!-- Without this the chart reads as one company at both ends. The
                 tag is the whole point of the row: a different business, with
                 your name, taking the answer. -->
            <span class="type-eyebrow shrink-0 border border-primary/40 px-1.5 text-primary">
              Not you
            </span>
          {/if}
        </p>
        <p class="type-meta m-0 shrink-0 tabular-nums text-muted">
          {row.count}&hairsp;×
        </p>
      </div>
      <div
        class="h-2.5 w-full bg-band"
        role="img"
        aria-label="{row.domain}{isNamesake
          ? ' (a different company with a similar name)'
          : ''} cited {row.count} {row.count === 1 ? 'time' : 'times'}"
      >
        <div class="h-full bg-dark" style="width: {pct(row.count)}%"></div>
      </div>
    </div>
  {/each}

  <!-- The prospect's own row, drawn only when there is a bar to draw.
       It used to be drawn especially at zero — an empty track next to the word
       "You", on the reasoning that showing the distance beats asserting it.
       That reasoning was about honesty and it was not wrong, but the picture it
       makes is a scoreboard with the reader last, and it is the one number in
       this report that nothing we do reliably moves. A reader who meets it
       spends the rest of the meeting on it.
       The absence is still reported, in a sentence, above this chart. -->
  {#if namedCount > 0}
    <div class="flex flex-col gap-1.5 border-t border-primary/40 pt-5">
      <div class="flex items-baseline justify-between gap-5">
        <p
          class="type-meta m-0 flex min-w-0 flex-wrap items-baseline gap-x-2.5 font-medium text-primary"
        >
          <span class="truncate">{ownDomain}</span>
          <span class="type-eyebrow shrink-0">You</span>
        </p>
        <p class="type-meta m-0 shrink-0 tabular-nums text-primary">
          {namedCount}&hairsp;×
        </p>
      </div>
      <div
        class="h-2.5 w-full bg-band"
        role="img"
        aria-label="{ownDomain}, the audited site, named {namedCount} {namedCount === 1
          ? 'time'
          : 'times'}"
      >
        <div class="h-full bg-primary" style="width: {pct(namedCount)}%"></div>
      </div>
    </div>
  {/if}

  {#if hidden > 0}
    <p class="type-meta m-0 text-muted">
      And {hidden} more {hidden === 1 ? "source" : "sources"} cited less often.
    </p>
  {/if}
</div>
