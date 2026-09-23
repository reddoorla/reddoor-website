<script lang="ts">
  import { MAX_IMAGE_W } from "$lib/images";
  import { resolvePadding } from "$lib/utils/slicePadding";
  import SliceSection from "$lib/components/SliceSection.svelte";
  import RailRow from "$lib/components/RailRow.svelte";
  import { PrismicImage } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { resolveAvatarAlt } from "./avatarAlt";

  let { slice }: { slice: Content.TestimonialSlice } = $props();

  // Author-controlled band spacing (MED-16). Defaults true, so an existing
  // document that predates the field keeps the padding it shipped with.
  const pad = $derived(resolvePadding(slice.primary));

  // null = authored before the flag existed → treat as animated (repo convention).
  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  const avatar = $derived(slice.primary.avatar);
  // PrismicImage takes its alt off the field, so the name fallback is written
  // back onto the field rather than passed as a prop (see ./avatarAlt.ts).
  const avatarAlt = $derived(resolveAvatarAlt(avatar?.alt, slice.primary.name));
  const hasCredit = $derived(
    Boolean(slice.primary.name || slice.primary.role || isFilled.image(avatar)),
  );
</script>

<SliceSection
  {slice}
  class="bg-paper w-full {pad.padTop ? 'pt-12 md:pt-16' : ''} {pad.padBottom
    ? 'pb-10 md:pb-12'
    : ''}"
>
  <!-- RailRow puts the (optional) label in the left rail and the content in the
       shared 760px column, so this quote's left edge lines up with every other
       section of the landing page. -->
  <RailRow label={slice.primary.label} animateIn={isAnimated} labelBaseline>
    {#if slice.primary.quote || hasCredit}
      <!-- figure/blockquote/figcaption is the semantic pattern for an attributed
           quote. Deliberately no heading anywhere: the name is not a section
           title, and marking it up as one would both break the page outline and
           drag in the global heading scale (h2 = Besley 60px). -->
      <figure>
        {#if slice.primary.quote}
          <blockquote>
            <!-- Pinned LP body type (Pragmatica Light 21/30). The global `p`
                 rule is 18/30 weight 200, so size/weight/leading all need
                 pinning; `font-sans` guards against a serif leak. -->
            <p class="quote type-quote measure text-black">
              {slice.primary.quote}
            </p>
          </blockquote>
        {/if}

        {#if hasCredit}
          <figcaption class="{slice.primary.quote ? 'mt-4' : ''} flex items-center gap-4 md:gap-5">
            {#if isFilled.image(avatar)}
              <PrismicImage
                field={{ ...avatar, alt: avatarAlt }}
                fallbackAlt=""
                imgixParams={{ auto: ["format", "compress"], fit: "max", w: MAX_IMAGE_W }}
                widths={[100, 200, 300, 400]}
                sizes="(min-width: 768px) 100px, 72px"
                loading="lazy"
                decoding="async"
                class="h-[72px] w-[72px] shrink-0 rounded-full object-cover md:h-[100px] md:w-[100px]"
              />
            {/if}
            <div class="min-w-0">
              {#if slice.primary.name}
                <p class="type-name text-primary">
                  {slice.primary.name}
                </p>
              {/if}
              {#if slice.primary.role}
                <p class="type-meta text-muted">
                  {slice.primary.role}
                </p>
              {/if}
            </div>
          </figcaption>
        {/if}
      </figure>
    {/if}
  </RailRow>
</SliceSection>

<style>
  /* The curly marks are chrome, not content: the CMS stores the quote bare so
     every testimonial gets identical punctuation. The second `content`
     declaration adds the alternative-text form (`"…" / ""`), which marks the
     generated glyph decorative for screen readers; browsers that don't parse
     it keep the first declaration and still draw the mark. */

  /* Tim, Discord 2026-03 and again 2026-09-17: "they should be hanging
     punctuation" — the opening mark belongs in the margin so the first line of
     the quote starts on the same vertical as every line under it, and as the
     rest of the page's 760px column.

     Measured before this change (Chromium, /medtech): the column's left edge is
     311.19px at 1280 wide, the quote's second line starts there, and its FIRST
     line started at 319.36 — the inline `“` pushing it 8.17px in. At 390 wide
     the same indent was 7.74px. Both read as a dent in an otherwise straight
     left edge.

     The mark is taken out of flow and hung off the left edge rather than paid
     for with a negative `text-indent`, because `right: 100%` is the mark's
     width by construction: no number here has to be kept in step with the
     glyph's advance at whatever weight or fallback face the visitor resolves.
     `hanging-punctuation: first` would say this in one line but is Safari-only
     (no Chromium, no Firefox — checked 2026-09-17), so it would leave the
     dent in place for most of the traffic.

     The paragraph's own box does not move, so the 760px column is untouched;
     only the glyph sits outside it, in the page gutter the grid already
     leaves (15.6px at 390 wide against an ~8px mark). */
  .quote {
    position: relative;
  }
  .quote::before {
    content: "\201C";
    content: "\201C" / "";
    position: absolute;
    right: 100%;
    top: 0;
  }
  .quote::after {
    content: "\201D";
    content: "\201D" / "";
  }
</style>
