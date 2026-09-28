<script lang="ts">
  // Layout primitive for the industry landing pages. Every section of the
  // Figma board shares one asymmetric grid: a narrow left rail holding the
  // section label, and a content column whose left edge is identical across
  // sections. Stacking slices only reads as one page if they all use this grid,
  // so it lives here rather than in any single slice.
  //
  // The grid is the board's own layout grid: FIVE stretch columns with a 20px
  // gutter ("Sales Funnel v2" in RD Sales Funnel LP — 5 × 240 + 4 × 20 = 1280
  // inside 80px margins at 1440, 5 × 336 at 1920). The label takes column 1 and
  // the content columns 2–4, or 2–5 with `wide`; column 5 is left empty beside
  // prose on purpose. The comp's old fixed numbers were this grid at one width
  // — 760 = 3 × 240 + 2 × 20, and the 1004px `wide` column was columns 2–5 —
  // so it scales with ContentWidth like the rest of the site (Tim's MarkUp pins
  // 1-3) without the content running on to the page gutter (Tim, 2026-09-23).
  //
  // The rail collapses above the content below `lg` — at that width a fifth of
  // the container would leave the content column unreadably narrow.
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import type { Snippet } from "svelte";

  interface Props {
    label?: string | null;
    /** Element for the label. The label names the section, so it is a heading
     *  by default; pass "p" where the page outline already has one. */
    labelAs?: "h2" | "h3" | "p";
    /** Keep the audit report's geometry: a 240px rail and a content column that
     *  takes everything beside it. The report is a document surface with its
     *  own review history, reviewed at these numbers, so it does not follow the
     *  landing pages' five-column grid below. */
    fill?: boolean;
    /** Content spans columns 2–5 instead of 2–4. The board runs its logo grid
     *  and FAQ list to the right margin; prose stops a column short. */
    wide?: boolean;
    animateIn?: boolean;
    /** Align the rail label's first baseline to the content column's first
     *  baseline, instead of aligning the two cells' top edges (Tim's MarkUp
     *  round on /boise, pins 4, 6 and 7 — "the baseline of this text should
     *  align to the baseline of the headline to the right").
     *
     *  Tops line up and baselines do not because the two cells carry different
     *  type: the kicker is 16px and the headline beside it is 26px/37.7px, so
     *  at a shared top edge the kicker's baseline sits ~14px above the
     *  headline's and reads as floating.
     *
     *  Opt-in, and it has to stay that way. `items-baseline` makes every cell
     *  in the row join the baseline group, and a cell whose first line box
     *  holds an image (LogoGrid, a FeaturedProject card) baselines on that
     *  image's BOTTOM edge — the label would drop the full height of the art.
     *  Only rows whose content starts with text pass it.
     *
     *  The label then sits 1px ABOVE that baseline, on purpose (Tim,
     *  2026-09-23: exactly on it is "technically perfect" but reads low). The
     *  nudge is `translate`, not a margin, so the grid still aligns on the true
     *  baseline and the offset is a pure optical correction on top of it —
     *  and `translate` composes with the `transform` animateIn writes rather
     *  than being overwritten by it. */
    labelBaseline?: boolean;
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
    /** Render the label as the first child of the content column instead of
     *  in the rail, at every width. Below `lg` this changes nothing visible —
     *  the label already stacks above the content there. From `lg` it leaves
     *  the rail cell empty, which the audit report uses to put its sticky
     *  contents list in that column. The cell itself stays, so the grid and
     *  the content column's left edge do not move. */
    labelAbove?: boolean;
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
    fill = false,
    wide = false,
    animateIn = false,
    labelBaseline = false,
    animateItems = false,
    labelClass = "text-primary",
    labelAbove = false,
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
  <!-- `data-rail-row` is the hook the geometry specs select on, so they do not
       depend on which grid-template utility this happens to be written in. -->
  <div
    data-rail-row
    class="flex flex-col gap-4 lg:grid lg:justify-start lg:gap-5 {labelBaseline
      ? 'lg:items-baseline'
      : ''} {fill ? 'lg:grid-cols-[240px_minmax(0,1fr)]' : 'lg:grid-cols-5'} {className}"
  >
    <!-- `contents` below `lg` so the label and any rail extra become siblings of
         the content column in the mobile flex order; a real grid cell from `lg`. -->
    <div class="contents lg:block">
      {#if railLabel && !labelAbove}
        <!-- `.type-kicker` (app.css) is the board's 16px bold red kicker. It
             pins font-family too, which is load bearing: this renders as an h2
             by default, and the global `h2` rule is Besley 60px whose family
             leaks in even when the size is overridden. -->
        <svelte:element
          this={labelAs}
          use:anim={{ enabled: animateIn && animateItems }}
          class="type-kicker {labelBaseline ? 'lg:-translate-y-px' : ''} {labelClass}"
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
          class="order-1 lg:order-none {railLabel && !labelAbove ? 'lg:mt-2.5' : ''}"
        >
          {@render rail()}
        </div>
      {/if}
    </div>
    <div class="min-w-0 {fill ? '' : wide ? 'lg:col-span-4' : 'lg:col-span-3'}">
      {#if railLabel && labelAbove}
        <svelte:element
          this={labelAs}
          use:anim={{ enabled: animateIn && animateItems }}
          class="type-kicker mb-4 lg:mb-6 {labelClass}"
        >
          {railLabel}
        </svelte:element>
      {/if}
      {@render children()}
    </div>
  </div>
</ContentWidth>
