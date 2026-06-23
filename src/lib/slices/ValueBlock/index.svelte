<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import { PrismicRichText, PrismicImage } from "@prismicio/svelte";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.ValueBlockSlice } = $props();
</script>

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-screen py-12 bg-paper-red relative"
  >
    <ContentWidth>
      <div class="w-full flex flex-col xl:flex-row xl:w-full">
        <div class="w-full xl:w-1/5 h-full overflow-hidden pt-4">
          {#if slice.primary.eyebrow}
            <!-- Eyebrow/kicker, not a heading: non-heading <p> keeps it out of the
                 outline. font-bold == the old <h6> look. -->
            <p class="font-bold text-white">{slice.primary.eyebrow}</p>
          {/if}
        </div>
        <div class="w-full xl:w-2/5 text-white flex flex-col gap-2 p-4 rich-text">
          {#if slice.primary.title}
            <!-- The block title is a real section heading. It's an <h2> (one level
                 below the page <h1>, no skip); `.type-title` pins the former <h3>
                 display type so the look is unchanged, incl. font-family (the
                 global `h2 { font-family: Besley }` would otherwise leak in). -->
            <h2 class="type-title mb-4">{slice.primary.title}</h2>
          {/if}

          <PrismicRichText field={slice.primary.body} />
        </div>
      </div>
    </ContentWidth>
    <PrismicImage
      field={slice.primary.drawn_image}
      class="w-3/5 md:w-1/3 absolute right-0 top-1/2 -translate-y-1/2 mix-blend-multiply"
      imgixParams={{ auto: ["compress"] }}
      widths={[400, 640, 800]}
      sizes="(min-width: 768px) 33vw, 60vw"
      loading="lazy"
      decoding="async"
    />
  </section>
{/if}

<style>
  /* Pin the former global <h3> display type on the now-<h2> title (the global
     `h2 { font-family: Besley; font-size: 60px }` rule would otherwise change it).
     Mirrors global h3 incl. its responsive steps. */
  .type-title {
    font-family: "pragmatica", "helvetica", sans-serif;
    font-size: 80px;
    font-weight: 200;
    line-height: 90px;
  }
  @media only screen and (max-width: 1024px) {
    .type-title {
      font-size: 60px;
      line-height: 70px;
    }
  }
  @media only screen and (max-width: 480px) {
    .type-title {
      font-size: 36px;
      line-height: 48px;
    }
  }
</style>
