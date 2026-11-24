<script lang="ts">
  import { brandedExcerpt, type ProbeAnswer } from "./model";

  // What the assistant said when asked about the business by name. Every
  // excerpt goes through `brandedExcerpt`, which withholds a rating, a review
  // score or a withheld topic, so this is the one place the reader sees them
  // (R4 fix 9). Report.svelte mounts it inside its disclosure.

  // `business` is the report's business name: a verb after its own name is not a person (R7 fix 3).
  let { probes, business = "" }: { probes: ProbeAnswer[]; business?: string } = $props();

  /**
   * The domains one answer cited, most-cited first, each named once. The raw
   * list repeats a source once per citation; counted, repetition becomes a
   * number, which is the useful form of the same fact.
   */
  const sourceList = (domains: string[]): string => {
    const counts: Record<string, number> = {};
    for (const d of domains) counts[d] = (counts[d] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([domain, n]) => (n > 1 ? `${domain} (${n})` : domain))
      .join(" · ");
  };
</script>

<div class="flex flex-col gap-5 pt-1">
  {#each probes as probe (probe.query)}
    <div class="flex flex-col gap-2">
      <p class="m-0 font-medium text-black">&ldquo;{probe.query}&rdquo;</p>
      <p class="type-meta m-0 text-muted">
        {brandedExcerpt(probe, business)}
      </p>
      {#if probe.citedDomains.length}
        <p class="type-meta m-0 text-muted">
          Sources: {sourceList(probe.citedDomains)}
        </p>
      {/if}
    </div>
  {/each}
  <p class="type-meta m-0 text-muted">
    A branded search cannot tell you whether someone who has never heard of you would find you. It
    answers a different question, and for most businesses a more useful one: when the assistant
    describes you, is it accurate, and is it reading your site or somebody else’s page about you.
  </p>
</div>
