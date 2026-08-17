<script lang="ts">
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
  <RailRow label={slice.primary.label} animateIn={isAnimated}>
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
            <p class="quote type-quote text-black">
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
                imgixParams={{ auto: ["format", "compress"] }}
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
  .quote::before {
    content: "\201C";
    content: "\201C" / "";
  }
  .quote::after {
    content: "\201D";
    content: "\201D" / "";
  }
</style>
