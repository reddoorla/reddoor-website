<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import type { PageData } from "./$types";

  import { components } from "$lib/slices";
  import ContentWidth from "$lib/components/ContentWidth/ContentWidth.svelte";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
  import { animateIn as anim } from "$lib/actions/animateIn";

  let { data }: { data: PageData } = $props();
</script>

<SliceZone slices={data.page.data.slices} {components} />

<!-- footer -->
<div class="w-screen py-40 md:h-[80vh] bg-paper-red flex flex-col items-center justify-center">
  <ContentWidth class="flex flex-col md:flex-row items-start justify-between">
    <h3 class="text-white md:w-3/5">
      Isn’t it time to arm your brand with a clear story and compelling design?
    </h3>
    <div use:anim={{ delayMax: 1600 }}>
      <a href="/contact">
        <DefaultButton
          class="mt-6 text-white border-white border-1 hover:bg-mid/10"
          text="MEET WITH US"
          filled={false}
        />
      </a>
    </div>
  </ContentWidth>
</div>
