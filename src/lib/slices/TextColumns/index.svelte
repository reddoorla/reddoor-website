<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { deriveTitleTag } from "./titleTag";

  let { slice }: { slice: Content.TextColumnsSlice } = $props();

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // Heading level for the column titles — see ./titleTag.ts. The default
  // variation keeps its promote-on-empty-eyebrow rule; the landing-page
  // variations are always h3 because a LeadText rail above (or this slice's own
  // rail label) is the section h2.
  const titleTag = $derived(deriveTitleTag(slice.variation, slice.primary.eyebrow));

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

<SliceSection {slice} class="w-full py-7.5">
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
    <!-- Landing-page grid: icon + two-line red label + small body per column,
         under a red rule that spans the content column only (not the rail). -->
    <RailRow label={slice.primary.eyebrow} animateIn={isAnimated}>
      <div class={slice.primary.hasTopRule ? "border-t border-primary pt-2.5" : ""}>
        <div class="grid grid-cols-1 gap-x-5 gap-y-10 {columnsClass}">
          <!-- Index-keyed for the same reason as above. -->
          {#each slice.primary.columns as column, i (i)}
            <!-- 20px between icon, label and body, per the board. -->
            <div class="flex flex-col gap-5">
              {#if isFilled.image(column.icon)}
                <!-- Decorative: the label directly below names the column, so an
                     alt would just repeat it. -->
                <PrismicImage
                  field={column.icon}
                  alt=""
                  class="h-7.5 w-7.5 object-contain"
                  imgixParams={{ auto: ["format", "compress"] }}
                  widths={[30, 60, 90]}
                  sizes="30px"
                  loading="lazy"
                  decoding="async"
                />
              {/if}
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
          {/each}
        </div>
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
              <h2 class="font-sans text-base font-bold leading-normal text-primary">
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
    padding-block: 15px;
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
     Two-line 14/24 +1px uppercase red label: bold first line (title), light
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
