<script lang="ts">
  import type { ProbeAnswer } from "./model";

  let { probes, businessName }: { probes: ProbeAnswer[]; businessName: string | null } = $props();

  const who = $derived(businessName ?? "you");

  /** Cited domains, deduplicated and in the order the engine returned them. The
   *  raw list repeats a domain once per citation, which reads as padding rather
   *  than evidence. */
  function uniqueDomains(domains: string[]): string[] {
    return [...new Set(domains)];
  }
</script>

<div class="flex flex-col border-t border-light">
  {#each probes as probe (probe.query)}
    {@const domains = uniqueDomains(probe.citedDomains)}
    {@const named = probe.domainCited || probe.brandMentioned}
    <div class="flex flex-col gap-3 border-b border-light py-6">
      <p class="type-question m-0 text-black">
        <span class="text-primary" aria-hidden="true">&ldquo;</span>{probe.query}<span
          class="text-primary"
          aria-hidden="true">&rdquo;</span
        >
      </p>

      <p class="m-0 text-sm font-medium {named ? 'text-dark' : 'text-primary'}">
        {#if named}
          {who} appeared in this answer.
        {:else if domains.length}
          {who} was not named. {domains.length}
          {domains.length === 1 ? "other site was" : "other sites were"} cited instead.
        {:else}
          {who} was not named, and the engine cited no sources at all.
        {/if}
      </p>

      {#if domains.length}
        <!-- A plain list, not a table: these are the competitors the prospect
             will recognise, and the point is that they can scan for names they
             know. -->
        <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {#each domains as domain (domain)}
            <li class="border border-light px-2 py-0.5 text-xs text-muted">{domain}</li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}
</div>
