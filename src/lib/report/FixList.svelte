<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import type { Fix } from "./model";

  // The ranked fix list, collapsed.
  //
  // Every fix used to render fully expanded, which put roughly two thousand
  // words of remediation detail between the scorecard and everything after it —
  // on a page whose reader is deciding whether any of this is worth half an
  // hour. The rank, the headline and the two costs are what that decision needs;
  // the reasoning is what they need once one of them has caught their eye.
  //
  // The order is the recommendation, so the number is content rather than
  // decoration — these are ranked by what to do first.

  let { fixes }: { fixes: Fix[] } = $props();

  // Findings first, judgement second, and the line between them is the
  // honesty: a measured fix names its count; a recommendation is what we
  // would do next and promises nothing about what an engine will do.
  const measured = $derived(fixes.filter((f) => f.origin === "measured"));
  const recommended = $derived(fixes.filter((f) => f.origin !== "measured"));

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

{#snippet fixRow(fix: Fix, n: number)}
  <li>
    <ReportDisclosure title="Fix {n}: {fix.title}">
      {#snippet label()}
        <span class="grid grid-cols-[2.5rem_1fr] gap-x-4">
          <span class="type-question leading-snug text-primary tabular-nums">
            {String(n).padStart(2, "0")}
          </span>
          <span class="flex min-w-0 flex-col gap-2.5">
            <span class="type-question max-w-[46ch] text-black">{fix.title}</span>
            <span class="flex flex-wrap gap-2">
              <!-- High impact is the only chip that takes colour. Colouring
                     every chip would make the list uniformly loud and leave the
                     reader no way to triage it at a glance — which is the one
                     job the collapsed state has. -->
              <span
                class="type-eyebrow border px-2 py-0.5 leading-tight {fix.impact === 'high'
                  ? 'border-primary/40 text-primary'
                  : 'border-light text-muted'}"
              >
                {IMPACT_LABEL[fix.impact]}
              </span>
              <span class="type-eyebrow border border-light px-2 py-0.5 leading-tight text-muted">
                {EFFORT_LABEL[fix.effort]}
              </span>
            </span>
          </span>
        </span>
      {/snippet}

      <!-- Indented to the title's column so the reasoning reads as belonging
             to the headline above it rather than to the list. -->
      <p class="m-0 max-w-[66ch] pl-0 text-muted sm:pl-14">{fix.why}</p>
    </ReportDisclosure>
  </li>
{/snippet}

{#if measured.length}
  <p class="type-eyebrow m-0 pb-3 text-dark">What we measured</p>
  <ol class="m-0 flex list-none flex-col border-t border-light p-0">
    {#each measured as fix, i (fix.title)}
      {@render fixRow(fix, i + 1)}
    {/each}
  </ol>
{/if}
{#if recommended.length}
  <p class="type-eyebrow m-0 pt-8 pb-1 text-dark">Our recommendations</p>
  <p class="type-meta m-0 max-w-[62ch] pb-3 text-muted">
    These are judgement, not measurement: what we would do next, in order. None of them is a promise
    about what an engine will do.
  </p>
  <ol class="m-0 flex list-none flex-col border-t border-light p-0">
    {#each recommended as fix, i (fix.title)}
      {@render fixRow(fix, measured.length + i + 1)}
    {/each}
  </ol>
{/if}
