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
      <div class="lede">
        <RichTextBody field={primary.lede} />
      </div>
    {/if}

    {#if hasBody}
      <!-- Disclosure. The toggle precedes the panel it controls (as in the
           Accordion slice), so the revealed copy follows the button in reading
           order. NOTE the deliberate deviation from the comp: the board clips
           the body to 3 lines + an ellipsis while collapsed, this hides it
           outright. See the note in the review handoff — an undesigned call.
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

      <!-- Pure-CSS reveal: grid 0fr→1fr animates the height without JS and the
           inner wrapper clips the overflow. `inert` while collapsed takes the
           panel out of the tab order and the a11y tree, so the copy is genuinely
           hidden rather than just clipped. Reduced motion → instant.
           No role="region": unlike the Accordion (whose labelling button carries
           a real item title) this one is labelled "Read More +", so a region
           would add a landmark with a meaningless name. -->
      <div
        id={panelId}
        class="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
        style="grid-template-rows: {expanded ? '1fr' : '0fr'}"
        inert={!expanded}
      >
        <div class="overflow-hidden">
          <div class="more-body pt-5">
            <RichTextBody field={primary.body} />
          </div>
        </div>
      </div>
    {/if}
  </RailRow>
</SliceSection>
