<script lang="ts">
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { Content } from "@prismicio/client";

  let { slice }: { slice: Content.TextColumnsSlice } = $props();

  const isAnimated = $derived(slice.primary.isAnimated === null || slice.primary.isAnimated);

  // With an eyebrow, that h2 is the section heading and column titles are its h3
  // children. Without one, the column titles ARE the section headings → promote
  // them to h2 so an eyebrow-less instance never skips a level (heading-order).
  const titleTag = $derived(slice.primary.eyebrow ? "h3" : "h2");

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

{#if !slice.primary.hide}
  <section
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class="w-full py-7.5"
  >
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
  </section>
{/if}

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
</style>
