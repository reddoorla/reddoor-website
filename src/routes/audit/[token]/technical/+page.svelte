<script lang="ts">
  import TechnicalReport from "$lib/report/technical/TechnicalReport.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Technical report for {data.view.host}</title>
  <!-- One of three independent guards, with robots.txt and the x-robots-tag
       loadReport sets. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<TechnicalReport view={data.view} reference={data.reference} />
