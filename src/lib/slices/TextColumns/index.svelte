<script lang="ts">
  import { resolvePadding } from "$lib/utils/slicePadding";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { cascadeIn } from "$lib/actions/cascadeIn";
  import type { Content } from "@prismicio/client";
  import { deriveTitleTag } from "./titleTag";
  import { stepNumber, numeralNudge } from "./stepNumber";

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

  // A step arrives in two beats: the arrow draws itself — the number pops, the
  // rule extends from it, the chevron lands — and only then does the copy under
  // it fill in. The arrow is what announces "step N", so the words following it
  // is the order that reads; both at once reads as one busy blur.
  //
  // Per step, not per grid: on a phone the steps are a long scroll apart, so a
  // single shared flag would fire the third step's arrow while it was still off
  // screen.
  //
  // The "not yet drawn" state is applied from JS rather than in the stylesheet
  // on purpose — authored as CSS, an arrow would sit at scale 0 and simply never
  // appear for anyone whose observer never runs. Rendering finished and then
  // rewinding is the safe order.
  // Held as state and bound to `data-draw` in the markup rather than set on the
  // node directly: Svelte prunes CSS it cannot statically see, and an attribute
  // that only ever appears at runtime gets every `[data-draw]` rule stripped
  // from the bundle — the animation would silently never run.
  let drawState = $state<Record<number, "pending" | "in">>({});
  // Second beat: the copy, revealed once this step's chevron has landed.
  let bodyIn = $state<Record<number, boolean>>({});

  function drawIn(node: HTMLElement, index: number) {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    drawState[index] = "pending";

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onArrowEnd: ((e: TransitionEvent) => void) | undefined;

    const showBody = () => {
      clearTimeout(timer);
      if (onArrowEnd) node.removeEventListener("transitionend", onArrowEnd);
      bodyIn[index] = true;
    };

    const start = () => {
      drawState[index] = "in";
      // Hand off on the chevron's own transition rather than on a second copy
      // of its delay — the arrow's timings live in the stylesheet, and a
      // duplicate here would drift the moment either is tuned. Delegated
      // because the two chevrons swap at the breakpoint and the hidden one
      // never transitions.
      onArrowEnd = (e: TransitionEvent) => {
        const target = e.target as Element | null;
        if (e.propertyName === "opacity" && target?.classList?.contains("step-arrow-head"))
          showBody();
      };
      node.addEventListener("transitionend", onArrowEnd);
      // The copy is invisible until this resolves, so it must not be able to
      // hang. Transitions can be switched off under it (the reduced-motion
      // block below does exactly that), and then no event ever arrives.
      timer = setTimeout(showBody, 2500);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect(); // one-shot: it should not rewind on scroll-up
          start();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return {
      destroy() {
        io.disconnect();
        clearTimeout(timer);
        if (onArrowEnd) node.removeEventListener("transitionend", onArrowEnd);
      },
    };
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
    <!-- `animateItems` so the label arrives on its own and each column cascades
         its own rows, rather than the whole block fading as one. -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated} animateItems>
      <!-- The board's services section leaves hasTopRule off: its rules are the
           per-row light ones below, not one red rule over the whole block. -->
      <div class={slice.primary.hasTopRule ? "border-t border-primary pt-2.5" : ""}>
        <div class="grid grid-cols-1 gap-x-6.25 gap-y-10 {columnsClass}">
          <!-- Key by index: `title` is optional + non-unique, so keying on it
               would throw each_key_duplicate on blank/repeated titles. -->
          {#each slice.primary.columns as column, i (i)}
            <!-- Each ruled row arrives on its own. Driven from the container
                 because the rows are not all markup — RichTextBody renders one
                 <p> per line, and there is nowhere to hang a per-row action.
                 cascadeIn keeps animateIn's left-to-right term, so the rows
                 cascade down a column while the columns cascade across. -->
            <div class="service-list" use:cascadeIn={{ enabled: isAnimated }}>
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
    <!-- `animateItems`: the rail label arrives on its own and the steps run
         their own two-beat sequence, rather than the whole row fading as one
         block. That is the house style (see SliceSection's `animate` note), and
         a single fade over the lot cannot express a sequence — it would also
         put the copy on screen before the arrow that introduces it. -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated} animateItems>
      <div class={slice.primary.hasTopRule ? "border-t border-primary pt-2.5" : ""}>
        <!-- An <ol>, not a div: the numbering IS the content here, and without a
             list the sequence would exist only in the styling. That also lets the
             visible 01/02/03 be decorative — see the aria-hidden below. -->
        <ol class="step-grid grid grid-cols-1 gap-x-5 gap-y-10 {columnsClass}">
          <!-- Index-keyed for the same reason as above. `--step-i` keeps the
               arrows sequential on desktop, where all three steps come into view
               together and would otherwise draw at once. -->
          <!-- `|| undefined` so the attribute is absent (not `data-draw=""`)
               before the action runs — an empty value still matches
               `[data-draw]`, which would hide the arrow during SSR and for
               anyone without JS. -->
          {#each slice.primary.columns as column, i (i)}
            <li
              use:drawIn={i}
              data-draw={drawState[i] || undefined}
              data-copy={bodyIn[i] ? "in" : undefined}
              class="step"
              style="--step-i:{i}"
            >
              <!-- Number + arrow, hidden from assistive tech: the <ol> already
                   conveys the order, so announcing "01" would double it. -->
              <div class="step-head" aria-hidden="true">
                <!-- Inner span so the numerals can be centred on their own ink
                     rather than on their metrics — see .step-num-digits. The
                     nudge is per-numeral because `01` and `02` do not need the
                     same one; `numeralNudge` explains why. -->
                <span class="step-num"
                  ><span
                    class="step-num-digits"
                    style="--digit-nudge:{numeralNudge(stepNumber(i))}px">{stepNumber(i)}</span
                  ></span
                >
                <span class="step-arrow">
                  <span class="step-arrow-line"></span>
                  <!-- The board exports this arrow as one fixed-length vector.
                       Here the line has to stretch to the column (and, on mobile,
                       to however tall the copy runs), so it is a flexed rule plus
                       a fixed chevron — same 1.5px stroke and geometry.

                       Two chevrons rather than one rotated one. `rotate()` moves
                       the glyph but not the layout box it is centred in, so the
                       rule could only be joined to the vertex by guesswork — and
                       it was: the rule was stopping 8px short. Each of these
                       instead puts its vertex on the box's leading edge, so a
                       negative margin of exactly the box's depth runs the rule
                       under the head and ends it at the point. -->
                  <svg class="step-arrow-head step-arrow-head--down" viewBox="0 0 16 9" fill="none">
                    <path
                      d="M1 1L8 8L15 1"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="square"
                    />
                  </svg>
                  <svg
                    class="step-arrow-head step-arrow-head--right"
                    viewBox="0 0 9 16"
                    fill="none"
                  >
                    <path
                      d="M1 1L8 8L1 15"
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
  }
  /* Centring a circle's label on its metrics is not the same as centring it on
     what you can see, and at 30px the difference reads. Three corrections, each
     one measured — at 4x off the rendered ink, and against the font's own
     metrics via canvas TextMetrics, which agree to within 0.05px:

     - Tracking is added after the LAST digit as well, so the box the browser
       centres runs a pixel past the numerals and they read 0.5px left.
     - Then the first glyph's left bearing against the last glyph's right
       bearing — ~0 for most numerals, a full pixel for `01`. Hence a
       per-numeral `--digit-nudge` rather than one average: the single 1.2px
       this used to carry was too much for `02`/`03` (0.7px right of centre)
       and too little for `01`. `numeralNudge` folds both terms into one number.
     - Vertically the digits sit 0.75px high, because a font's ascent and
       descent are not symmetric about the baseline. That one IS uniform — every
       numeral shares a baseline and a cap height.

     All of it rides on the transform and none of it on the box, which is not a
     style preference: cancelling the tracking with `margin-right: -1px` leaves
     the box on a half pixel, and Firefox pixel-snaps a transformed element's
     layout position — it rounds that half pixel away and then adds the
     transform, landing 0.48px right of where Chromium and WebKit put it.

     Holds 01/02/03 within 0.2px of centre in all three engines, at both
     breakpoints. */
  .step-num-digits {
    letter-spacing: 1px;
    transform: translate(var(--digit-nudge, 0px), 0.75px);
  }
  /* On the board the rule runs straight out of the circle and straight into the
     vertex, reading as one arrow — so no padding at either end, and the head
     overlaps the rule rather than following it. Any gap and the three parts read
     as separate objects, which is exactly how this first shipped. */
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
    color: inherit;
    /* The mitred vertex overshoots its own viewBox by ~1px. Let it paint. */
    overflow: visible;
  }
  .step-arrow-head--down {
    display: block;
    width: 16px;
    height: 9px;
    /* Back by the box's full depth, so the rule runs under the head and stops
       at the vertex rather than at the chevron's open ends. */
    margin-top: -9px;
  }
  .step-arrow-head--right {
    display: none;
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
    .step-arrow-head--down {
      display: none;
    }
    .step-arrow-head--right {
      display: block;
      width: 9px;
      height: 16px;
      /* Same join as the vertical rail, on the other axis. */
      margin-left: -9px;
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
     the direction each rail actually runs.

     The timings live on the `in` rules, NOT on these. A transition is chosen
     from the style being transitioned TO, so putting them here would animate
     the rewind as well: the arrow renders finished, and would then spend 860ms
     visibly un-drawing itself. Worse than ugly — a step that came into view
     during that rewind flipped to `in` while the chevron was still opaque,
     leaving no opacity change to transition, no transitionend, and the copy
     waiting on its fallback timer instead of on the arrow. */
  .step[data-draw] .step-num {
    opacity: 0;
    transform: scale(0.8);
  }
  .step[data-draw] .step-arrow-line {
    transform: scaleY(0);
    transform-origin: top;
  }
  .step[data-draw] .step-arrow-head {
    opacity: 0;
  }

  .step[data-draw="in"] .step-num {
    opacity: 1;
    transform: scale(1);
    transition:
      opacity 300ms ease calc(var(--step-i) * 140ms),
      transform 300ms var(--transition-fast-slow) calc(var(--step-i) * 140ms);
  }
  .step[data-draw="in"] .step-arrow-line {
    transform: scaleY(1);
    transition: transform 600ms var(--transition-fast-slow) calc(var(--step-i) * 140ms + 160ms);
  }
  .step[data-draw="in"] .step-arrow-head {
    opacity: 1;
    transition: opacity 240ms ease calc(var(--step-i) * 140ms + 620ms);
  }

  /* Second beat: the copy fills in once the chevron above it has landed —
     `data-copy` is set from the arrow's own transitionend, not a timer.
     Same split as the arrow: hidden instantly, revealed with the transition.
     Driven here rather than through the animateIn action because that action
     animates its hide as well, and the copy is server-rendered opaque — it
     would visibly fade OUT under the drawing arrow before fading back in. */
  .step[data-draw] .step-body {
    opacity: 0;
    transform: translateY(25%);
  }
  .step[data-copy="in"] .step-body {
    opacity: 1;
    transform: none;
    /* The fill used for the steps on the MSOT site. */
    transition:
      opacity 1000ms var(--transition-fast-slow),
      transform 1000ms var(--transition-fast-slow);
  }

  @media (min-width: 768px) {
    .step[data-draw] .step-arrow-line {
      transform: scaleX(0);
      transform-origin: left;
    }
    .step[data-draw="in"] .step-arrow-line {
      transform: scaleX(1);
    }
  }

  /* The action already bails under reduced motion, so `data-draw` is never
     applied — this is belt-and-braces for a preference set after load. */
  @media (prefers-reduced-motion: reduce) {
    .step[data-draw] .step-num,
    .step[data-draw] .step-arrow-line,
    .step[data-draw] .step-arrow-head,
    .step[data-draw] .step-body {
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
