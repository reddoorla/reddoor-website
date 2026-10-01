<script lang="ts">
  import { SliceSimulator, SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
</script>

<SliceSimulator let:slices>
  <SliceZone {slices} {components} />
</SliceSimulator>
