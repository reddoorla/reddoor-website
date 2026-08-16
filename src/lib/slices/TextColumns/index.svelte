<script lang="ts">
  import { resolvePadding } from "$lib/utils/slicePadding";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { Content } from "@prismicio/client";
  import { deriveTitleTag } from "./titleTag";
  import { stepNumber } from "./stepNumber";

  let { slice }: { slice: Content.TextColumnsSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // Heading level for the column titles — see ./titleTag.ts. The default
  // variation keeps its promote-on-empty-eyebrow rule; the landing-page
  // variations are always h3 because a LeadText rail above (or this slice's own
  // rail label) is the section h2.
  const titleTag = $derived(deriveTitleTag(slice.variation, slice.primary.eyebrow));

  // Draws the step arrows in as the rail reaches the viewport: the rule extends
  // from the number outward and the chevron lands once it arrives, staggered a
  // step at a time.
  //
  // The "not yet drawn" state is applied from JS rather than in the stylesheet
  // on purpose — authored as CSS, an arrow would sit at scale 0 and simply never
  // appear for anyone whose observer never runs. Rendering finished and then
  // rewinding is the safe order.
  // Held as state and bound to `data-draw` in the markup rather than set on the
  // node directly: Svelte prunes CSS it cannot statically see, and an attribute
  // that only ever appears at runtime gets every `[data-draw]` rule stripped
  // from the bundle — the animation would silently never run.
  let drawState = $state<"" | "pending" | "in">("");

  function drawIn(node: HTMLElement) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    drawState = "pending";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          drawState = "in";
          io.disconnect(); // one-shot: it should not rewind on scroll-up
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  // Full class strings (not interpolated) so Tailwind's content scanner keeps them.
  const columnsClass = $derived(
    (
      {
        "2": "md:grid-cols-2",
        "3": "md:grid-cols-3",
        "4": "md:grid-cols-4",
      } as Record<string, string>
    )[slice.primary.desktopColumns ?? "3"] ?? "md:grid-cols-3",
  );
</script>

<SliceSection {slice} class="w-full {pad.padTop ? 'pt-7.5' : ''} {pad.padBottom ? 'pb-7.5' : ''}">
  <!-- Narrowing on `slice.variation` (not a $derived boolean) is what types
       `slice.primary` per variation inside each branch — the iconColumns
       columns only carry `icon` / `subtitle` under this check. -->
  {#if slice.variation === "serviceList"}
    <!-- Landing-page grid: the ruled category lists share the page's content
         column left edge. The eyebrow is usually blank here (the LeadText above
         owns the section h2) — RailRow then renders an empty rail, which is what
         keeps the columns aligned with every other section. RailRow wraps
         ContentWidth itself, so there is no ContentWidth here. -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated}>
      <!-- The board's services section leaves hasTopRule off: its rules are the
           per-row light ones below, not one red rule over the whole block. -->
      <div class={slice.primary.hasTopRule ? "border-t border-primary pt-2.5" : ""}>
        <div class="grid grid-cols-1 gap-x-6.25 gap-y-10 {columnsClass}">
          <!-- Key by index: `title` is optional + non-unique, so keying on it
               would throw each_key_duplicate on blank/repeated titles. -->
          {#each slice.primary.columns as column, i (i)}
            <div class="service-list">
              {#if column.title}
                <svelte:element this={titleTag} class="service-row service-row--category">
                  {column.title}
                </svelte:element>
              {/if}
              <!-- One ruled row per paragraph: RichTextBody emits a <p> per
                   paragraph node and `.service-list p` below IS the row. -->
              <RichTextBody field={column.body} />
            </div>
          {/each}
        </div>
      </div>
    </RailRow>
  {:else if slice.variation === "iconColumns"}
    <!-- Landing-page process rail: numbered step + arrow, two-line red label and
         small body per column, under a red rule that spans the content column
         only (not the rail). The `icon` field is still in the model but is no
         longer rendered — the board replaced the per-step icons with the numbers
         below, which are derived from position rather than authored. -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated}>
      <div class={slice.primary.hasTopRule ? "border-t border-primary pt-2.5" : ""}>
        <!-- An <ol>, not a div: the numbering IS the content here, and without a
             list the sequence would exist only in the styling. That also lets the
             visible 01/02/03 be decorative — see the aria-hidden below. -->
        <!-- `|| undefined` so the attribute is absent (not `data-draw=""`) before
             the action runs — an empty value still matches `[data-draw]`, which
             would hide every arrow during SSR and for anyone without JS. -->
        <ol
          use:drawIn
          data-draw={drawState || undefined}
          class="step-grid grid grid-cols-1 gap-x-5 gap-y-10 {columnsClass}"
        >
          <!-- Index-keyed for the same reason as above. `--step-i` drives the
               per-step delay so the arrows draw in sequence rather than together. -->
          {#each slice.primary.columns as column, i (i)}
            <li class="step" style="--step-i:{i}">
              <!-- Number + arrow, hidden from assistive tech: the <ol> already
                   conveys the order, so announcing "01" would double it. -->
              <div class="step-head" aria-hidden="true">
                <span class="step-num">{stepNumber(i)}</span>
                <span class="step-arrow">
                  <span class="step-arrow-line"></span>
                  <!-- The board exports this arrow as one fixed-length vector.
                       Here the line has to stretch to the column (and, on mobile,
                       to however tall the copy runs), so it is a flexed rule plus
                       this fixed chevron — same 1.5px stroke and geometry. -->
                  <svg class="step-arrow-head" viewBox="0 0 16 9" fill="none">
                    <path
                      d="M1 1L8 8L15 1"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="square"
                    />
                  </svg>
                </span>
              </div>
              <!-- 20px between label and body, per the board. -->
              <div class="step-body">
                {#if column.title || column.subtitle}
                  <svelte:element this={titleTag} class="icon-label">
                    {#if column.title}<span class="icon-label-lead">{column.title}</span>{/if}
                    {#if column.subtitle}<span class="icon-label-sub">{column.subtitle}</span>{/if}
                  </svelte:element>
                {/if}
                <div class="col-body">
                  <RichTextBody field={column.body} />
                </div>
              </div>
            </li>
          {/each}
        </ol>
      </div>
    </RailRow>
  {:else}
    <ContentWidth animateIn={isAnimated}>
      <div class="w-full md:w-3/5 mx-auto">
        {#if slice.primary.eyebrow || slice.primary.hasTopRule}
          <div class="mb-6 {slice.primary.hasTopRule ? 'border-b border-primary pb-2.5' : ''}">
            {#if slice.primary.eyebrow}
              <!-- Section heading (h2). Column titles below are its h3 children,
                   so the outline is masthead h1 → h2 → h3 with no skips. -->
              <h2 class="type-kicker text-primary">
                {slice.primary.eyebrow}
              </h2>
            {/if}
          </div>
        {/if}

        <div class="grid grid-cols-1 gap-10 {columnsClass}">
          <!-- Key by index: `title` is optional + non-unique, so keying on it
               would throw each_key_duplicate on blank/repeated titles. -->
          {#each slice.primary.columns as column, i (i)}
            <div>
              {#if column.title}
                <svelte:element
                  this={titleTag}
                  class="mb-2.5 font-sans text-[26px] font-light leading-tight text-primary"
                >
                  {column.title}
                </svelte:element>
              {/if}
              <div class="col-body">
                <RichTextBody field={column.body} />
              </div>
            </div>
          {/each}
        </div>
      </div>
    </ContentWidth>
  {/if}
</SliceSection>

<style>
  /* Small sans body (Pragmatica Extra Light 16). Scoped :global reaches the
     PrismicRichText <p> nodes (which carry no class). */
  .col-body :global(p) {
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }
  .col-body :global(p:not(:last-child)) {
    margin-bottom: 0.75rem;
  }
  .col-body :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .col-body :global(a:hover) {
    color: #aa1419;
  }

  /* ---- serviceList variation -------------------------------------------
     Every row (the red category heading and each body paragraph) is the same
     14/24 +1px uppercase label with a 1px top rule and 15px of padding — TOP
     borders only, so the last row has no closing rule. These rules are
     unlayered and therefore beat Tailwind utilities: pin the look here, not
     with classes in the markup. Every property the base `h3`/`p` rules set is
     pinned, family included (global `h3` is 80/90 weight 200). */
  .service-row,
  .service-list :global(p) {
    margin: 0;
    border-top: 1px solid #bbbdbf; /* token: light */
    /* 7.5 + 24 line-height + 7.5 + 1px rule = the board's 40px row pitch. Its
       service lists are 5 rows of 40 = 200 tall; at the 15px this used to carry
       the rows were 55 and the block ran 75px long. */
    padding-block: 7.5px;
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 14px;
    font-weight: 300;
    line-height: 24px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .service-row--category {
    color: #d71920; /* token: primary */
  }
  .service-list :global(p) {
    /* token: muted. The board's #8B8C8D is 3.36:1 on white at 14px — below WCAG
       AA — so the token is the nearest passing value. Kept literally in sync
       with `muted` in tailwind.config.js, which explains the derivation. */
    color: #6e6f72;
  }
  /* Preflight's `font-weight: bolder` against a 300 base computes to a
     barely-visible 400 — pin the real bold. */
  .service-list :global(strong) {
    font-weight: 700;
  }
  .service-list :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .service-list :global(a:hover) {
    color: #aa1419;
  }

  /* ---- iconColumns variation -------------------------------------------
     The numbered process rail. Mobile stacks the number + arrow into a vertical
     rail down the left with the copy beside it; from md the head turns and sits
     above the copy as a row, which is the board's desktop frame. Both share one
     chevron that just rotates.

     Colour lives on `.step-head` and everything under it draws with
     `currentColor`, so the rule, the ring and the chevron can never drift apart. */
  .step-grid {
    /* The <ol> is a grid, so the markers would sit outside the tracks. */
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .step {
    display: grid;
    grid-template-columns: 30px 1fr;
    column-gap: 15px;
  }
  .step-head {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #d71920; /* token: primary — the board's #E31937 maps to this */
  }
  .step-num {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    /* Board: Pragmatica Book 14/24 +1px. Pinned rather than left to inherit —
       this sits inside a slice whose other labels are 300 and whose global `li`
       rules would otherwise supply the family. */
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 14px;
    font-weight: 400;
    line-height: 24px;
    letter-spacing: 1px;
    /* The +1px tracking is trailing, which visually pushes the digits left of
       centre inside a circle. Give the space back. */
    text-indent: 1px;
  }
  /* No padding at either end: on the board the rule runs straight out of the
     circle and straight into the head, reading as one arrow. Any gap here makes
     the three parts look like separate objects. */
  .step-arrow {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: center;
    /* Keeps the rail readable on a step whose copy is only a line or two. */
    min-height: 40px;
  }
  .step-arrow-line {
    flex: 1 1 auto;
    width: 1.5px;
    background: currentColor;
  }
  .step-arrow-head {
    flex: none;
    width: 16px;
    height: 9px;
    /* Pull the head back onto the line so the strokes meet — the path is inset
       1px inside its own viewBox, which would otherwise read as a gap. */
    margin-top: -2px;
    /* Authored pointing down for the mobile rail; the desktop rule turns it. */
    color: inherit;
  }
  @media (min-width: 768px) {
    .step {
      display: flex;
      flex-direction: column;
      /* 20px between the head, the label and the body, per the board. */
      gap: 20px;
    }
    .step-head {
      flex-direction: row;
      align-items: center;
    }
    .step-arrow {
      flex-direction: row;
      min-height: 0;
    }
    .step-arrow-line {
      width: auto;
      height: 1.5px;
    }
    .step-arrow-head {
      /* Same overlap as the vertical rail, turned with it. */
      margin-top: 0;
      margin-left: -2px;
      transform: rotate(-90deg);
    }
  }
  .step-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ---- arrow draw-in ---------------------------------------------------
     Only ever active while `data-draw` is present, which `drawIn` adds from
     JS — so the finished state above is what renders when the action never
     runs, and this is purely additive. The number pops first, the rule
     extends from it, and the chevron lands as it arrives; `--step-i` walks
     the whole thing one step at a time.

     Mobile draws downward (scaleY), desktop rightward (scaleX) — matching
     the direction each rail actually runs. */
  .step-grid[data-draw] .step-num {
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity 300ms ease calc(var(--step-i) * 140ms),
      transform 300ms var(--transition-fast-slow) calc(var(--step-i) * 140ms);
  }
  .step-grid[data-draw] .step-arrow-line {
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 600ms var(--transition-fast-slow) calc(var(--step-i) * 140ms + 160ms);
  }
  .step-grid[data-draw] .step-arrow-head {
    opacity: 0;
    transition: opacity 240ms ease calc(var(--step-i) * 140ms + 620ms);
  }

  .step-grid[data-draw="in"] .step-num {
    opacity: 1;
    transform: scale(1);
  }
  .step-grid[data-draw="in"] .step-arrow-line {
    transform: scaleY(1);
  }
  .step-grid[data-draw="in"] .step-arrow-head {
    opacity: 1;
  }

  @media (min-width: 768px) {
    .step-grid[data-draw] .step-arrow-line {
      transform: scaleX(0);
      transform-origin: left;
    }
    .step-grid[data-draw="in"] .step-arrow-line {
      transform: scaleX(1);
    }
  }

  /* The action already bails under reduced motion, so `data-draw` is never
     applied — this is belt-and-braces for a preference set after load. */
  @media (prefers-reduced-motion: reduce) {
    .step-grid[data-draw] .step-num,
    .step-grid[data-draw] .step-arrow-line,
    .step-grid[data-draw] .step-arrow-head {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  /* Two-line 14/24 +1px uppercase red label: bold first line (title), light
     second line (subtitle). One heading element so the outline stays clean;
     the lines are stacked blocks rather than a <br>. */
  .icon-label {
    display: flex;
    flex-direction: column;
    margin: 0;
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 14px;
    /* Pinned even though both lines set their own weight: unset, the global
       `h3` rule's 200 would win for anything added to this label later. */
    font-weight: 300;
    line-height: 24px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #d71920; /* token: primary */
  }
  .icon-label-lead {
    font-weight: 700;
  }
  .icon-label-sub {
    font-weight: 300;
  }

  @media (prefers-reduced-motion: reduce) {
    /* `.col-body` is shared with the default variation but is also what
       iconColumns renders its body through, so its hover fade needs the same
       guard the serviceList links get — otherwise this slice ships a
       transition that ignores the preference. */
    .col-body :global(a),
    .service-list :global(a) {
      transition: none;
    }
  }
</style>
