<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import { PrismicImage, PrismicRichText } from "@prismicio/svelte";
  import type { RichTextComponents } from "@prismicio/svelte";
  import { isFilled, type Content } from "@prismicio/client";
  import { animateIn as anim } from "$lib/actions/animateIn";
  import { deriveHeroButtons } from "./buttons";

  let { slice }: { slice: Content.IndustryHeroSlice } = $props();

  // Legacy docs authored before the flag arrive as null → treat as animated.
  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // Unlabelled or unresolvable links are dropped rather than drawn — see buttons.ts.
  const buttons = $derived(deriveHeroButtons(slice.primary.buttons));

  // Each column is only drawn when it has content: the columns sit in a
  // `gap-10` stack below lg, so an empty one would open a 40px hole rather than
  // collapse. Every field here is optional in Prismic.
  const hasHeadline = $derived(isFilled.richText(slice.primary.headline));
  const hasIntro = $derived(
    Boolean(slice.primary.card_label) ||
      isFilled.richText(slice.primary.card_body) ||
      buttons.length > 0,
  );

  // The headline is the page's visible <h1>. RichTextBody is deliberately NOT
  // used for it: that component re-levels every heading via aria-level starting
  // at 2 (a valid *sub*-outline for CMS bodies), which would announce this h1 as
  // a level-2 heading. PrismicRichText's shorthand serializer keeps the real
  // <h1> and hangs the pinned display type on it instead.
  //
  // `.type-hero` (app.css) pins every property the global `h1` element rule
  // sets, family included — it sits in @layer components, which outranks the
  // base rule at every width including inside that rule's own max-width media
  // queries, and without an explicit family the base sans would show through
  // where the board wants Besley.
  const HEADLINE_CLASS = "type-hero text-white";

  const headlineComponents: RichTextComponents = { heading1: { class: HEADLINE_CLASS } };

  // Ghost CTA sitting directly on the photo. DefaultButton already supplies the
  // 1px white border, 4px radius, 10px/15px padding and 14px label (from its own
  // scoped styles), so only the board's translucent fill, drop shadow and Book
  // weight are added here. `max-sm:mb-0` cancels DefaultButton's mobile `mb-5`,
  // which would otherwise stack 20px under a row that carries its own 11px gap.
  const BUTTON_CLASS =
    "bg-black/10 shadow-[1px_1px_10px_2px_rgba(16,63,32,0.1)] font-normal max-sm:mb-0";

  // NOTE: the hero deliberately does NOT touch the `isInHero` store. That store
  // suppresses the site nav entirely, and +layout.svelte already handles this
  // case for industry pages — it renders the top nav in white with a white
  // outline "Get Started" CTA precisely so it can sit over this photo. Hiding
  // the nav here would leave an industry landing page with no navigation until
  // the visitor scrolled past the hero, and would make that layout branch dead
  // code. The `pt-28` below is the room reserved for that nav.
</script>

<SliceSection {slice} class="relative w-full overflow-hidden bg-black">
  <!-- Media layer. `isolate` confines the multiply blend to this wrapper so it
       darkens the photo and nothing else, and the scrim is a direct sibling of
       the <img>: any ancestor carrying transform/opacity/filter (an entrance
       animation, say) collapses mix-blend-multiply into an opaque box. Nothing
       in here is ever animated for that reason — the reveal is on the type. -->
  <div class="pointer-events-none absolute inset-0 isolate">
    {#if isFilled.image(slice.primary.image)}
      <!-- `fallbackAlt=""`: PrismicImage takes its alt from the field, and an
           asset uploaded without alt text would otherwise render an <img> with
           no alt attribute at all — an axe `image-alt` failure. The background
           photo is decorative, so empty alt is the correct degrade. -->
      <PrismicImage
        field={slice.primary.image}
        fallbackAlt=""
        class="h-full w-full object-cover"
        imgixParams={{ auto: ["format", "compress"] }}
        widths={[640, 828, 1080, 1280, 1920, 2560]}
        sizes="100vw"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      />
    {/if}
    <div class="hero-scrim absolute inset-0 mix-blend-multiply"></div>
    <!-- The board's wash is transparent through the top 48%, but the site nav
         renders in white over exactly that strip on an industry page. A bright
         photo would drop the nav links below contrast, so this short top scrim
         guarantees a dark ground for them. Normal alpha compositing, not
         multiply — it sits over the blend rather than joining it. -->
    <div class="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/45 to-transparent"></div>
  </div>

  <!-- Content frame. The board is a fixed 1440x860; here that is a min-height
       that steps down with the viewport, with the two columns bottom-anchored
       (`justify-end` + the 86px board margin) so the layout survives a taller
       headline or a third button instead of clipping. -->
  <div
    class="relative flex min-h-130 flex-col justify-end pt-28 pb-14 sm:min-h-150 md:min-h-170 lg:min-h-195 xl:min-h-215 xl:pb-21.5"
  >
    <!-- `relative` only: ContentWidth's own `w-[92%] mx-[4%]` supplies the page
         gutter, and passing a width utility here would fight it. -->
    <ContentWidth class="relative">
      <!-- Below lg the 231px sidebar would leave the headline column
           unreadably narrow (the same reason RailRow collapses its rail at lg),
           so the intro column stacks under the headline. From lg the two
           columns share one row and `items-end` puts them on the board's shared
           bottom edge. -->
      <div
        class="flex flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,890px)_231px] lg:items-end lg:justify-between lg:gap-x-16 xl:gap-x-38.5"
      >
        {#if hasHeadline}
          <div class="max-w-222.5" use:anim={{ enabled: isAnimated }}>
            <PrismicRichText field={slice.primary.headline} components={headlineComponents} />
          </div>
        {/if}

        {#if hasIntro}
          <div
            class="flex max-w-120 flex-col gap-3.75 lg:max-w-none"
            use:anim={{ enabled: isAnimated }}
          >
            {#if slice.primary.card_label}
              <!-- A kicker for the intro column, not a section heading: the hero's
                 <h1> is the page heading and this labels a two-line blurb, so it
                 stays out of the outline as a <p> (same call ValueBlock makes for
                 its eyebrow). Pragmatica Bold 16/1.5, pinned over the base `p`. -->
              <p class="type-kicker text-white">
                {slice.primary.card_label}
              </p>
            {/if}

            {#if isFilled.richText(slice.primary.card_body)}
              <div class="hero-body">
                <RichTextBody field={slice.primary.card_body} />
              </div>
            {/if}

            {#if buttons.length}
              <div class="flex flex-wrap items-start gap-2.75">
                <!-- Keyed by index: links repeat and carry no stable id. -->
                {#each buttons as button, i (i)}
                  <DefaultButton
                    href={button.href}
                    text={button.text}
                    filled={false}
                    class={BUTTON_CLASS}
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </ContentWidth>
  </div>
</SliceSection>

<style>
  /* Navy multiply wash from the board: fully transparent through the top 48% of
     the photo, deepening to #12366D at 72% by the bottom so the white type has a
     dark ground. Slice-local colours — the site palette has no navy. */
  .hero-scrim {
    background-image: linear-gradient(
      to bottom,
      rgba(77, 130, 199, 0) 48%,
      rgba(18, 54, 109, 0.72) 100%
    );
  }

  /* Pragmatica Light 16/1.5 in white. Every property the base `p` rule sets
     (18/30, weight 200, body gray) is re-stated, family included. Scoped
     :global reaches the <p> nodes RichTextBody emits — they carry no class. */
  .hero-body :global(p) {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 16px;
    font-weight: 300;
    line-height: 1.5;
    color: #fff;
  }
  .hero-body :global(p:not(:last-child)) {
    margin-bottom: 0.75rem;
  }
  /* Preflight gives <strong> `font-weight: bolder`, which against a 300 base
     computes to a barely-visible 400 — pin the real bold. */
  .hero-body :global(strong) {
    font-weight: 700;
  }
  /* On the photo, the site red would be unreadable — links stay white and lean
     on the underline. */
  .hero-body :global(a) {
    color: #fff;
    text-decoration: underline;
    transition: opacity 400ms;
  }
  .hero-body :global(a:hover) {
    opacity: 0.75;
  }
  @media (prefers-reduced-motion: reduce) {
    .hero-body :global(a) {
      transition: none;
    }
  }
</style>
