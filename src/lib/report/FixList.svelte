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
  // One list, not two. A first pass split it under "What we measured" and "Our
  // recommendations", and in this context the split made no sense: the reader
  // has just read the measurements as findings, and what they want here is the
  // order of work. Provenance survives as a chip on the rows that came straight
  // from a measurement, and the honesty line under the heading covers the rest.

  let { fixes }: { fixes: Fix[] } = $props();

  // Measured first, then judgement, each in the audit's own order.
  const ordered = $derived([
    ...fixes.filter((f) => f.origin === "measured"),
    ...fixes.filter((f) => f.origin !== "measured"),
  ]);

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

<p class="type-eyebrow m-0 pb-1 text-dark">Our recommendations</p>
<p class="type-meta m-0 pb-4 text-muted">
  What we would do next, in order. The rows marked measured come straight from a check above; the
  rest are judgement. None of them is a promise about what an engine will do.
</p>
<ol class="m-0 flex list-none flex-col border-t border-light p-0">
  {#each ordered as fix, i (fix.title)}
    <li>
      <ReportDisclosure title="Fix {i + 1}: {fix.title}">
        {#snippet label()}
          <span class="grid grid-cols-[2.5rem_1fr] gap-x-4">
            <span class="type-question leading-snug text-primary tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span class="flex min-w-0 flex-col gap-2.5">
              <span class="type-question text-black">{fix.title}</span>
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
                {#if fix.origin === "measured"}
                  <span
                    class="type-eyebrow border border-light px-2 py-0.5 leading-tight text-dark"
                  >
                    Measured
                  </span>
                {/if}
              </span>
            </span>
          </span>
        {/snippet}

        <!-- Indented to the title's column so the reasoning reads as belonging
             to the headline above it rather than to the list. -->
        <p class="m-0 pl-0 text-muted sm:pl-14">{fix.why}</p>
      </ReportDisclosure>
    </li>
  {/each}
</ol>
