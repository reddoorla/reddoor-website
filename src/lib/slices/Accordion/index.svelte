<script lang="ts">
  import { resolvePadding } from "$lib/utils/slicePadding";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { cascadeIn } from "$lib/actions/cascadeIn";
  import { CircleArrowDown, Plus, Minus } from "@lucide/svelte";
  import { untrack } from "svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { deriveItemTag, normalizeLabel } from "./headings";

  let { slice }: { slice: Content.AccordionSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

  // TYPEGEN NOTE: `label` (both variations) and the whole "rail" variation
  // (which also carries `isAnimated`) were just added to model.json, so the
  // committed prismicio-types.d.ts still types `slice.variation` as the literal
  // "default" and knows nothing about either field. Once types are regenerated,
  // `Content.AccordionSliceRail` exists and this block collapses to a plain
  // `slice.variation === "rail"` narrowing (drop ExtendedPrimary and both casts).
  type ExtendedPrimary = Content.AccordionSliceDefaultPrimary & {
    label?: string | null;
    isAnimated?: boolean | null;
  };
  const primary = $derived(slice.primary as ExtendedPrimary);
  const isRail = $derived((slice.variation as string) === "rail");

  // Optional section eyebrow. Every doc published before this field existed
  // reads "" here, and the label block is then omitted entirely — no empty node.
  const label = $derived(normalizeLabel(primary.label));

  // `?? true` covers both null (authored before the flag existed) and undefined
  // (the default variation, which has no such field) — repo convention.
  const isAnimated = $derived(primary.isAnimated ?? true);

  // HEADING ORDER (axe gate) — the rule and its regression lock live in
  // ./headings.ts. Short version: a filled label is the section h2 and the item
  // titles nest under it as h3; with no label (every already-published doc) the
  // item titles ARE the section headings and stay h2. Neither case skips a
  // level, and RailRow gates its own h2 on the same normalized value.
  const itemTag = $derived(deriveItemTag(label));

  // SSR-stable unique base so aria-controls / aria-labelledby ids don't collide
  // when the slice appears more than once on a page.
  const uid = $props.id();
  const panelId = (i: number) => `acc-panel-${uid}-${i}`;
  const buttonId = (i: number) => `acc-button-${uid}-${i}`;

  // Per-item open state, seeded once from the authored defaultOpen (runs on both
  // SSR and client so the initial markup matches — no hydration flash). `untrack`
  // marks the read as intentional-initial-value, not a reactive dependency.
  let open = $state(
    untrack(() => slice.primary.items.map(() => slice.primary.defaultOpen ?? false)),
  );
</script>

<!-- The rail variation sits on the landing page's paper stock (reusing the
     shipped .bg-paper tile rather than adding another texture asset) with the
     board's 96px section padding; the default variation's shell is untouched. -->
<SliceSection
  {slice}
  class={isRail
    ? `bg-paper w-full ${pad.padTop ? "pt-12 md:pt-24" : ""} ${pad.padBottom ? "pb-12 md:pb-24" : ""}`
    : "w-full py-7.5"}
>
  {#if isRail}
    <!-- Landing-page grid: the label sits in the narrow left rail (as this
         section's h2) so the question list's left edge matches every other
         section of the page. RailRow wraps ContentWidth itself — no nesting.
         `wide` because the board's question list is 1027px of a 1288px content
         box (79.74%) — wider than the 760px body column the prose sections use,
         and the extra width is what keeps each question on the single line the
         comp draws. RailRow's 1004px `wide` column is the closest sanctioned
         fit; the default 760px would wrap the longer questions to two lines and
         break the 70px row rhythm. -->
    <!-- `animateItems` so the rail label arrives on its own; the rows below
         cascade one at a time rather than the list fading as one block.
         cascadeIn rather than a per-row action because the rows share a left
         edge — animateIn derives its delay from `rect.left`, so a column of
         them would all get the same delay and arrive together. -->
    <RailRow {label} wide animateIn={isAnimated} animateItems>
      <div use:cascadeIn={{ enabled: isAnimated }}>
        {#each slice.primary.items as item, i (i)}
          <!-- No body authored → no panel to reveal, so the question renders as
             plain text instead of a dead toggle that would announce "expanded"
             over nothing. The comp ships exactly this state (8 collapsed rows,
             no answers written yet); the row becomes a real disclosure the
             moment an answer is added. -->
          {@const canExpand = isFilled.richText(item.body)}
          <!-- A blank question drops the whole row (same rule TextColumns applies
             to a blank column title). The question is both the heading text and
             the button's accessible name, so a title-less row would ship an
             unnamed toggle (axe `button-name`) inside an empty heading (axe
             `empty-heading`); an answer with no question has nothing to
             disclose. Trimmed — whitespace is truthy but announces nothing. -->
          {@const title = (item.title ?? "").trim()}
          {#if title}
            <!-- 1px rule under EVERY row, last one included (board detail). -->
            <div class="border-b border-light">
              {#if canExpand}
                <svelte:element this={itemTag} class="m-0 type-question text-mid">
                  <button
                    id={buttonId(i)}
                    type="button"
                    class="group flex w-full items-center gap-5 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-expanded={open[i]}
                    aria-controls={panelId(i)}
                    onclick={() => (open[i] = !open[i])}
                  >
                    <span
                      class="min-w-0 flex-1 wrap-break-word transition-colors group-hover:text-black motion-reduce:transition-none"
                    >
                      {title}
                    </span>
                    <!-- One glyph, rotated: down = collapsed, up = expanded. The
                       bare `transition` is deliberate — v4's rotate-* sets the
                       standalone `rotate` property (not `transform`), and the
                       default property list is the only one covering both
                       `rotate` and `color`. -->
                    <span
                      class="shrink-0 text-light transition duration-300 ease-out group-hover:text-mid motion-reduce:transition-none {open[
                        i
                      ]
                        ? 'rotate-180'
                        : ''}"
                      aria-hidden="true"
                    >
                      <CircleArrowDown size={30} strokeWidth={1} />
                    </span>
                  </button>
                </svelte:element>

                <!-- Same pure-CSS reveal as the default variation: grid 0fr→1fr
                   animates height without JS, the inner wrapper clips, and
                   `inert` while collapsed pulls the panel out of the tab order
                   and the a11y tree. Reduced motion → instant. -->
                <div
                  id={panelId(i)}
                  role="region"
                  aria-labelledby={buttonId(i)}
                  class="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
                  style="grid-template-rows: {open[i] ? '1fr' : '0fr'}"
                  inert={!open[i]}
                >
                  <div class="overflow-hidden">
                    <!-- Right inset clears the 30px icon + 20px gutter so the
                       answer never runs under the toggle. -->
                    <div class="acc-body pb-5 md:pr-12.5">
                      <RichTextBody field={item.body} />
                    </div>
                  </div>
                </div>
              {:else}
                <svelte:element
                  this={itemTag}
                  class="m-0 py-5 type-question wrap-break-word text-mid"
                >
                  {title}
                </svelte:element>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </RailRow>
  {:else}
    <ContentWidth>
      <div class="w-full md:w-3/5 mx-auto flex flex-col gap-4">
        {#if label}
          <!-- Section heading (h2); the item titles below become its h3
               children. Omitted entirely when unset, so docs published before
               this field existed render byte-identical markup. -->
          <h2 class="type-kicker text-primary">
            {label}
          </h2>
        {/if}
        <!-- Key by index (matches the index-addressed `open` state): `title` is
             optional + non-unique, so keying on it would throw each_key_duplicate
             on blank/repeated titles. -->
        {#each slice.primary.items as item, i (i)}
          <div class="rounded-[10px] bg-[#f3f5f1]/50 p-5">
            <!-- Disclosure header: the button IS the toggle (aria-expanded),
                 wrapped in a heading so it takes part in the page outline. -->
            <svelte:element this={itemTag} class="m-0">
              <button
                id={buttonId(i)}
                type="button"
                class="group flex w-full items-center justify-between gap-6 text-left"
                aria-expanded={open[i]}
                aria-controls={panelId(i)}
                onclick={() => (open[i] = !open[i])}
              >
                <span class="type-kicker text-primary">
                  {item.title}
                </span>
                <span
                  class="flex size-12.5 shrink-0 items-center justify-center rounded-full border border-light text-mid transition-colors group-hover:border-mid"
                  aria-hidden="true"
                >
                  {#if open[i]}
                    <Minus size={28} strokeWidth={1} />
                  {:else}
                    <Plus size={28} strokeWidth={1} />
                  {/if}
                </span>
              </button>
            </svelte:element>

            <!-- Pure-CSS reveal: grid 0fr→1fr animates height without JS; the inner
                 wrapper clips the overflow. `inert` while collapsed removes the
                 panel from tab order + the a11y tree (and satisfies
                 aria-hidden-focus for any links inside). Reduced motion → instant. -->
            <div
              id={panelId(i)}
              role="region"
              aria-labelledby={buttonId(i)}
              class="grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none"
              style="grid-template-rows: {open[i] ? '1fr' : '0fr'}"
              inert={!open[i]}
            >
              <div class="overflow-hidden">
                <div class="acc-body pt-2.5">
                  <RichTextBody field={item.body} />
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </ContentWidth>
  {/if}
</SliceSection>

<style>
  /* Small sans body (Pragmatica Extra Light 16), matching the columns copy.
     The comp never draws an expanded row, so the rail variation reuses this
     same panel treatment. */
  .acc-body :global(p) {
    font-size: 16px;
    font-weight: 200;
    line-height: 1.5;
    color: #000;
  }
  .acc-body :global(p:not(:last-child)) {
    margin-bottom: 0.75rem;
  }
  .acc-body :global(a) {
    color: #d71920;
    text-decoration: underline;
    transition: color 400ms;
  }
  .acc-body :global(a:hover) {
    color: #aa1419;
  }

  @media (prefers-reduced-motion: reduce) {
    .acc-body :global(a) {
      transition: none;
    }
  }
</style>
