<script lang="ts">
  import type { ReportView } from "./model";

  let { view }: { view: ReportView } = $props();

  // A null score means the stage could not be measured. It must never render as
  // a zero — "we could not check" and "you scored nothing" are different claims
  // about the prospect, and only one of them is ours to make.
  const cells = $derived([
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

<div
  class="grid w-full grid-cols-1 gap-px border-y border-light bg-light sm:grid-cols-2 lg:grid-cols-4"
>
  {#each cells as cell (cell.label)}
    <div class="flex flex-col gap-2 bg-white p-6">
      <p class="type-display m-0 leading-none {cell.alert ? 'text-primary' : 'text-black'}">
        {cell.value ?? "—"}
      </p>
      <p class="type-eyebrow m-0 text-dark">{cell.label}</p>
      <p class="m-0 text-sm leading-snug text-muted">
        {#if cell.value === null}
          Not measured on this run.
        {:else}
          {cell.note}
        {/if}
      </p>

      <!-- The denominator, only under the score it belongs to. A bare 0 invites
           an argument; "named in 0 of 3 searches" invites a question. -->
      {#if cell.label === "AI Visibility" && view.visibility}
        <p class="m-0 text-sm font-medium text-primary">
          Named in {view.visibility.named} of {view.visibility.total}
          {view.visibility.total === 1 ? "search" : "searches"}.
        </p>
      {/if}
    </div>
  {/each}
</div>
