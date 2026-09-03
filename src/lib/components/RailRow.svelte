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
  import { animateIn as anim } from "$lib/actions/animateIn";
  import type { Snippet } from "svelte";

  interface Props {
    label?: string | null;
    /** Element for the label. The label names the section, so it is a heading
     *  by default; pass "p" where the page outline already has one. */
    labelAs?: "h2" | "h3" | "p";
    /** Widen the content column to the logo grid's 1004px. */
    wide?: boolean;
    /** Let the content column take the whole ContentWidth beside the rail.
     *  The 760px column is the industry board's measure; the audit report is
     *  a document with tables and lists, and at 760px on a 1220px page it read
     *  as compressed. `fill` wins over `wide`. */
    fill?: boolean;
    animateIn?: boolean;
    /** Animate the rail's own parts individually and leave the content column
     *  to its children, instead of fading the whole row as one block. The
     *  house style is per-element (see SliceSection's `animate` note); a row
     *  whose content is a list wants each item to arrive on its own, which a
     *  single fade over the lot cannot express. Off by default so the rows that
     *  do read as one block keep doing so. */
    animateItems?: boolean;
    /** Colour utility for the rail label. Defaults to the board's red kicker.
     *
     *  It exists because the red was hardcoded here, and a RailRow placed on the
     *  `bg-paper-red` band therefore drew #D71920 text on a #D71920 ground — the
     *  label was invisible, with nothing in the type system able to override it.
     *  Pass `text-white` on any red band. A cascade rule on `.bg-paper-red`
     *  cannot fix this: `text-primary` is a Tailwind utility and would still win
     *  over anything declared in `@layer base` or `@layer components`. */
    labelClass?: string;
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
    fill = false,
    animateIn = false,
    animateItems = false,
    labelClass = "text-primary",
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
<ContentWidth animateIn={animateIn && !animateItems} class="relative">
  <div
    class="flex flex-col gap-4 lg:grid lg:justify-start lg:gap-5 {fill
      ? 'lg:grid-cols-[240px_minmax(0,1fr)]'
      : wide
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
        <svelte:element
          this={labelAs}
          use:anim={{ enabled: animateIn && animateItems }}
          class="type-kicker {labelClass}"
        >
          {railLabel}
        </svelte:element>
      {/if}
      {#if rail}
        <!-- `order-1` only bites below `lg`, where the `contents` wrapper has
             put this in the same flex line as the content column. The 10px
             offset from the label is the board's rail auto-layout gap. -->
        <div
          use:anim={{ enabled: animateIn && animateItems }}
          class="order-1 lg:order-none {railLabel ? 'lg:mt-2.5' : ''}"
        >
          {@render rail()}
        </div>
      {/if}
    </div>
    <div class="min-w-0">
      {@render children()}
    </div>
  </div>
</ContentWidth>
