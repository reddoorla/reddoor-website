<script lang="ts">
  import Report from "$lib/report/Report.svelte";
  import { toReportView } from "$lib/report/model";
  import type { PageData } from "./$types";

  // The body lives in Report.svelte so the fixture route renders exactly what
  // a prospect sees. This file owns only what is specific to a real report:
  // the token-loaded data and the noindex guard.

  let { data }: { data: PageData } = $props();

  const view = $derived(toReportView(data.report));
  const who = $derived(view.businessName ?? "your business");
</script>

<svelte:head>
  <title>When AI answers for {who}</title>
  <!-- The third of three independent guards, with robots.txt and the
       x-robots-tag set in +page.server.ts. Letting a prospect's report reach a
       search index is the one mistake here that cannot be walked back. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<Report {view} />
