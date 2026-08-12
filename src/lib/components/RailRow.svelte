<script lang="ts">
  // Layout primitive for the industry landing pages. Every section of the
  // Figma board shares one asymmetric grid: a narrow left rail holding the
  // section label, and a ~760px content column whose left edge is identical
  // across sections. Stacking slices only reads as one page if they all use
  // this grid, so it lives here rather than in any single slice.
  //
  // The rail collapses above the content below `lg` — at that width a 240px
  // gutter would leave the content column unreadably narrow.
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import type { Snippet } from "svelte";

  interface Props {
    label?: string | null;
    /** Element for the label. The label names the section, so it is a heading
     *  by default; pass "p" where the page outline already has one. */
    labelAs?: "h2" | "h3" | "p";
    /** Widen the content column to the logo grid's 1004px. */
    wide?: boolean;
    animateIn?: boolean;
    class?: string;
    /** Extra rail content under the label (CaseStudy's services + before/after
     *  switch). It flows after the label rather than being positioned against
     *  it, so a label that wraps to two lines pushes it down instead of being
     *  overlapped. Below `lg` the rail cell is `display: contents`, so this
     *  renders as a sibling of the content column and `order-1` puts it after
     *  the content — matching the mobile reading order label → content → rail. */
    rail?: Snippet;
    children: Snippet;
  }

  let {
    label = "",
    labelAs = "h2",
    wide = false,
    animateIn = false,
    class: className = "",
    rail,
    children,
  }: Props = $props();

  // Trimmed here rather than at each call site: `label` is raw CMS text on most
  // of the six callers, and a whitespace-only Key Text field is truthy — it
  // would emit `<h2> </h2>`, an axe `empty-heading` violation, and (at the
  // default `labelAs="h2"`) a heading in the outline that announces nothing.
  // Only Accordion and ValueBlock/Expandable normalize before passing.
  const railLabel = $derived((label ?? "").trim());
</script>

<!-- `relative` only. ContentWidth's own class string already sets `w-[92%]`, and
     anything width-y passed here lands on the same element — a `w-full` would sit
     alongside `w-[92%]` and be resolved by stylesheet order rather than intent
     (LogoGrid absolutely-positions its rail block against this box). -->
<ContentWidth {animateIn} class="relative">
  <div
    class="flex flex-col gap-4 lg:grid lg:justify-start lg:gap-5 {wide
      ? 'lg:grid-cols-[240px_minmax(0,1004px)]'
      : 'lg:grid-cols-[240px_minmax(0,760px)]'} {className}"
  >
    <!-- `contents` below `lg` so the label and any rail extra become siblings of
         the content column in the mobile flex order; a real grid cell from `lg`. -->
    <div class="contents lg:block">
      {#if railLabel}
        <!-- `.type-kicker` (app.css) is the board's 16px bold red kicker. It
             pins font-family too, which is load bearing: this renders as an h2
             by default, and the global `h2` rule is Besley 60px whose family
             leaks in even when the size is overridden. -->
        <svelte:element this={labelAs} class="type-kicker text-primary">
          {railLabel}
        </svelte:element>
      {/if}
      {#if rail}
        <!-- `order-1` only bites below `lg`, where the `contents` wrapper has
             put this in the same flex line as the content column. The 10px
             offset from the label is the board's rail auto-layout gap. -->
        <div class="order-1 lg:order-none {railLabel ? 'lg:mt-2.5' : ''}">
          {@render rail()}
        </div>
      {/if}
    </div>
    <div class="min-w-0">
      {@render children()}
    </div>
  </div>
</ContentWidth>
