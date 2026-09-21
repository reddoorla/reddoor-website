<script lang="ts">
  import { sourceCheckHasStatements, type ReportView } from "./model";

  // The one paragraph above SourceCheck — its own component so that the
  // conditional it sits inside can be RENDERED in a test.
  //
  // Inline in Report.svelte it could only ever be asserted on as source text,
  // and a source-text assertion is blind to exactly the thing that keeps going
  // wrong here: which way round the condition is. Every assertion guarding this
  // paragraph passed just as happily with the condition inverted. Report.svelte
  // cannot be rendered in isolation — it imports fourteen other components and
  // the unit-test config deliberately loads no Svelte plugin — so the only way
  // to put the conditional under a renderer is to give it a boundary of its
  // own. This is that boundary; it is not here to be reused.
  //
  // What it promises is specific: statements were taken apart, and each one
  // sorted by where it came from. That is only true when there IS a statement,
  // so it asks `sourceCheckHasStatements` and not the weaker "an answer was
  // read" — with which it printed directly above SourceCheck's own "could not
  // pull a checkable statement out of them".

  let { view }: { view: ReportView } = $props();

  const who = $derived(view.businessName ?? "your business");
</script>

{#if sourceCheckHasStatements(view)}
  <p class="type-lede m-0 text-black">
    We asked an AI assistant about {who} and took its answer apart statement by statement. Each one is
    sorted by where it came from — not by whether it is true. We cannot know that; you can.
  </p>
{/if}
