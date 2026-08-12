<script lang="ts">
  // ValueBlock → "expandable": the industry landing page's "On Your Behalf" band
  // (Figma 4803:870, layer `value 4`). A display title over a full-width rule,
  // then the shared rail grid — rail label beside a Besley lede and a longer sans
  // body kept behind a real Read More disclosure.
  //
  // It lives in its own file rather than a branch inside index.svelte so that
  // file — markup AND its scoped styles — stays untouched: Svelte derives the
  // `svelte-…` scope class from the CSS text, so adding one rule there would
  // rename the class on the default variation's rendered <h2>.
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { resolvePadding } from "$lib/utils/slicePadding";

  // index.svelte narrows on `slice.variation` before rendering this. Extract the
  // matching member of the slice union rather than using
  // `Content.ValueBlockSliceExpandable` — that is the bare *variation* type and
  // lacks `slice_type`, which SliceSection needs.
  type ExpandableSlice = Extract<Content.ValueBlockSlice, { variation: "expandable" }>;
  let { slice }: { slice: ExpandableSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

  const primary = $derived(slice.primary);

  // Booleans authored before the flag existed come back as null → animated.
  const isAnimated = $derived(primary.isAnimated ?? true);

  const hasBody = $derived(isFilled.richText(primary.body));

  // Trimmed, because a whitespace-only Text field is still truthy: untrimmed,
  // `" "` would ship an `<h2> </h2>` (axe `empty-heading`) and a rail `<p>` that
  // announces nothing. Same rule the Accordion slice applies to its label.
  const displayTitle = $derived((primary.displayTitle ?? "").trim());
  const eyebrow = $derived((primary.eyebrow ?? "").trim());

  // The expanded label is not in the design (only the collapsed state was drawn)
  // and has no field, so it is fixed here: U+2212 MINUS SIGN mirrors the literal
  // "+" the designer typed into the collapsed label.
  const READ_LESS_LABEL = "Read Less −";
  let expanded = $state(false);
  // Trimmed for the same reason plus one more: a whitespace-only label would
  // leave the toggle with no accessible name (axe `button-name`).
  const readMoreLabel = $derived((primary.readMoreLabel ?? "").trim() || "Read More +");
  const toggleLabel = $derived(expanded ? READ_LESS_LABEL : readMoreLabel);

  // SSR-stable id so aria-controls stays unique when the slice repeats on a page.
  // ($props.id() must be a bare declaration initializer — no interpolation here.)
  const uid = $props.id();
  const panelId = `value-block-more-${uid}`;
</script>

<SliceSection {slice} class="w-full {pad.padTop ? 'pt-7.5' : ''} {pad.padBottom ? 'pb-7.5' : ''}">
  {#if displayTitle}
    <!-- Same ContentWidth call RailRow makes internally, so the rule and the
         title share the rail grid's left edge and full band width. Must stay in
         sync with RailRow: adding `w-full` here silently beat ContentWidth's own
         `w-[92%]`, and since `xl:mx-auto` then has no slack to distribute the 4%
         page gutter collapsed to 0 — the title and rule ran edge to edge while
         the rail below them stayed indented. -->
    <ContentWidth animateIn={isAnimated} class="relative">
      <!-- Section heading (h2, one level under the masthead h1). `.type-display`
           is the shared role in app.css — it pins the board's Besley display
           type at every step, because the global `h2` rule sets family, size,
           weight and line-height and drops to 35px at 1024 / 27px at 768, none
           of which is wanted here. -->
      <h2 class="type-display text-primary">{displayTitle}</h2>
      <!-- The board's 1px `Line 4` rule, drawn in CSS rather than shipped as the
           exported SVG. 30px above/below, matching the board's 30.07/30.05. -->
      <hr class="mt-7.5 mb-7.5 border-primary" />
    </ContentWidth>
  {/if}

  <!-- The rail label is NOT a heading here: the display title above is already
       this section's h2, and "About Us" is a kicker naming the column, not a
       heading over content (the default variation renders its eyebrow as a <p>
       for the same reason). -->
  <RailRow label={eyebrow} labelAs="p" animateIn={isAnimated}>
    {#if isFilled.richText(primary.lede)}
      <!-- `.lede` was an inert hook: nothing anywhere defined it, so this
           rendered as the generic RichTextBody paragraph (pragmatica 18/30
           weight 200) rather than the Besley lede this file's own header
           describes. `.type-lede-block` is the shared role. -->
      <div class="type-lede-block">
        <RichTextBody field={primary.lede} />
      </div>
    {/if}

    {#if hasBody}
      <!-- The board shows the body CLAMPED to 3 lines while collapsed (74px,
           15px under the lede) with the toggle 20px below it — not hidden. An
           earlier pass hid it outright and noted the deviation; that cost the
           band 181px against the comp and, more to the point, gave the reader
           nothing to decide whether "Read More" was worth pressing.

           Because the copy is now always rendered, the panel is no longer
           `inert` and the toggle follows the text it truncates, matching both
           the board's order and the reading order. -->
      <div id={panelId} class="more-body pt-3.75 {expanded ? '' : 'more-body--clamped'}">
        <RichTextBody field={primary.body} />
      </div>
      <!-- Disclosure. The toggle FOLLOWS the copy it truncates, per the board
           (Frame 44: description 0–241, button at 261) and per reading order —
           the text is on the page either way now, so the button's job is to
           unclamp it rather than to reveal it.
           Classes mirror DefaultButton's `red` (unfilled) branch exactly,
           including its scoped `padding: 10px 15px` / `font-size: 14px` /
           `line-height: normal` (hence `leading-[normal]`, NOT Tailwind's
           `leading-normal`, which is 1.5 and would make this the only 43px-tall
           button on the page). Hand-rolled rather than reused because
           DefaultButton spreads no rest props, so it cannot forward
           aria-expanded / aria-controls. Deltas from its defaults are
           intentional: no `mb-5` (the board has no bottom margin), no
           `tracking-wider` (board letter-spacing is 0) and `font-normal` for
           the board's 400 label. -->
      <button
        type="button"
        class="pointer-events-auto mt-5 cursor-pointer rounded-[4px] border-1 border-primary px-[15px] py-2.5 text-center text-[14px] leading-[normal] font-normal text-nowrap text-primary transition-all duration-300 hover:bg-primary-dark hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:-translate-y-2 active:bg-black motion-reduce:transition-none"
        aria-expanded={expanded}
        aria-controls={panelId}
        onclick={() => (expanded = !expanded)}
      >
        {toggleLabel}
      </button>
    {/if}
  </RailRow>
</SliceSection>

<style>
  /* Collapsed body: the board's 3-line preview. `-webkit-line-clamp` is applied
     to the WRAPPER, not to each paragraph — RichTextBody emits one <p> per
     paragraph, and clamping each of them to 3 lines would show 3 lines of every
     paragraph instead of the first 3 lines of the copy.

     Unprefixed `line-clamp` is not yet universal, so the -webkit- trio stays;
     it is the only interoperable way to clamp to a line count today. */
  .more-body--clamped {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }

  /* -webkit-box makes the wrapper a flex-ish box whose children lose their own
     margins' collapsing behaviour; zero the trailing margin so the clamped
     block measures exactly 3 lines and the button sits 20px under it. */
  .more-body--clamped :global(p:last-child) {
    margin-bottom: 0;
  }
</style>
