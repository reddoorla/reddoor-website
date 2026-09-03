<script lang="ts">
  import ReportDisclosure from "./ReportDisclosure.svelte";
  import { passes, passCount } from "./narrative";
  import type { ReportView } from "./model";

  // Everything that passed, in one openable section and nowhere else.
  //
  // The rest of the page prints findings. A reader who wants to know what was
  // checked and came back clean opens this — and a reader who does not is
  // spared three screens of the AI being right about them, which on the first
  // real run was most of the page and killed any urgency the findings had.
  //
  // One line per pass, grouped the way the page is, terse on purpose: these are
  // receipts for breadth, not findings.

  let { view, headingTag = "h2" }: { view: ReportView; headingTag?: "h2" | "h3" } = $props();

  const groups = $derived(passes(view));
  const count = $derived(passCount(view));
</script>

<div id="passes" class="flex flex-col border-t border-light">
  {#if groups.length}
    <ReportDisclosure
      {headingTag}
      title="What passes: {count} {count === 1 ? 'check' : 'checks'} came back clean"
    >
      <div class="flex flex-col gap-8 pt-1">
        {#each groups as group (group.title)}
          <div class="flex flex-col gap-2">
            <p class="type-eyebrow m-0 text-dark">{group.title}</p>
            <ul class="m-0 grid list-none grid-cols-1 gap-x-10 p-0 sm:grid-cols-2">
              {#each group.items as item, i (group.title + i)}
                <li class="type-meta border-b border-light/60 py-1.5 text-muted">{item}</li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </ReportDisclosure>
  {:else}
    <p class="type-meta m-0 py-5 text-muted">
      Nothing here passed outright: every check that ran raised something, or did not run. The
      second case is a gap in our measurement, not a finding about your site.
    </p>
  {/if}
</div>
