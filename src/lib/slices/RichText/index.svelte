<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import type { Content } from "@prismicio/client";

  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

  let { slice }: { slice: Content.RichTextSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.backgroundcolor);
  const float = $derived(slice.primary.float);
  const width = $derived(slice.primary.width);
</script>

{#if !slice.primary.hide}
  <section
    class="w-full {slice.primary.hasPadding ? 'py-12' : ''} text-{slice.primary
      .textColor} {backgroundColorString}"
  >
    <ContentWidth
      class="flex flex-col
		{float === 'right' ? 'items-end' : ''}
		{float === 'center' ? 'items-center' : ''}
		{float === 'left' ? 'items-start' : ''}
		"
      animateIn={slice.primary.isAnimated === null || slice.primary.isAnimated}
    >
      <div
        class="
		{width === '4/5' ? 'w-full md:w-4/5' : ''}
		{width === '3/5' ? 'w-full md:w-3/5' : ''}
		pr-6
		rich-text
		"
      >
        <PrismicRichText field={slice.primary.content} />
      </div>
    </ContentWidth>
  </section>
{/if}
