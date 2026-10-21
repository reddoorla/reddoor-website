<script lang="ts">
  import NotAFitPage from "$lib/components/funnel/NotAFitPage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<NotAFitPage copy={data.copy} />
