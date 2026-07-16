<script lang="ts">
  import SliceSection from "$lib/components/SliceSection.svelte";
  import { resolvePadding } from "$lib/utils/slicePadding";
  import RichTextBody from "$lib/components/RichTextBody.svelte";
  import type { Content } from "@prismicio/client";

  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";

  let { slice }: { slice: Content.RichTextSlice } = $props();

  const backgroundColorString = $derived("bg-" + slice.primary.backgroundcolor);
  const float = $derived(slice.primary.float);
  const width = $derived(slice.primary.width);

  const pad = $derived(resolvePadding(slice.primary));
</script>

<SliceSection
  {slice}
  class="w-full {pad.padTop ? 'pt-12' : ''} {pad.padBottom ? 'pb-12' : ''} text-{slice.primary
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
      <RichTextBody field={slice.primary.content} />
    </div>
  </ContentWidth>
</SliceSection>
