<script>
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";

  let { slices = [], bandRhythm = null, context = undefined } = $props();
</script>

<div class="contents" data-band-rhythm={bandRhythm}>
  <SliceZone {slices} {components} {context} />
</div>
