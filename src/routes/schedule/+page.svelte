<script lang="ts">
  import SchedulePage from "$lib/components/funnel/SchedulePage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<SchedulePage copy={data.copy} />
