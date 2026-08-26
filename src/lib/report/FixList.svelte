<script lang="ts">
  import type { Fix } from "./model";

  let { fixes }: { fixes: Fix[] } = $props();

  // The audit grades effort as low/medium/high. A prospect reads that as a
  // judgement of them; a rough duration reads as a plan. Same information,
  // different posture.
  const EFFORT_LABEL: Record<Fix["effort"], string> = {
    low: "About an hour",
    medium: "A few days",
    high: "A larger piece of work",
  };

  const IMPACT_LABEL: Record<Fix["impact"], string> = {
    high: "High impact",
    medium: "Medium impact",
    low: "Low impact",
  };
</script>

<ol class="m-0 flex list-none flex-col border-t border-light p-0">
  {#each fixes as fix, i (fix.title)}
    <li class="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-light py-7">
      <!-- Numbered because the order is the recommendation: these are ranked by
           what to do first, not merely listed. -->
      <span class="type-question m-0 leading-snug text-primary" aria-hidden="true">
        {String(i + 1).padStart(2, "0")}
      </span>

      <div class="flex min-w-0 flex-col gap-3">
        <h3 class="type-question m-0 max-w-[34ch] text-black">
          <span class="sr-only">Fix {i + 1}:</span>{fix.title}
        </h3>

        <div class="flex flex-wrap gap-2">
          <span
            class="border border-light px-2 py-0.5 text-xs tracking-widest uppercase {fix.impact ===
            'high'
              ? 'text-primary'
              : 'text-muted'}"
          >
            {IMPACT_LABEL[fix.impact]}
          </span>
          <span
            class="border border-light px-2 py-0.5 text-xs tracking-widest text-muted uppercase"
          >
            {EFFORT_LABEL[fix.effort]}
          </span>
        </div>

        <p class="m-0 max-w-[66ch] text-muted">{fix.why}</p>
      </div>
    </li>
  {/each}
</ol>
