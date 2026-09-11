<script lang="ts">
  import { toReportView } from "$lib/report/model";
  import Report from "$lib/report/Report.svelte";
  import EditLayer from "$lib/report/EditLayer.svelte";
  import { editableTargets } from "$lib/report/editable";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const view = $derived(toReportView(data.report, data.overrides));
  const targets = $derived(editableTargets(view, data.report));
  const who = $derived(view.businessName ?? "your business");
</script>

<svelte:head>
  <title>Editing: when AI answers for {who}</title>
  <!-- Same guard the read route carries. An edit address is no less a copy of
       a prospect's report than the address it was made from. -->
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<!-- The report renders exactly as a prospect sees it. Everything about editing
     lives in the layer on top, so nothing in the components can behave one way
     for an operator and another way for a reader — which is what makes "is edit
     mode inert for a prospect" answerable by looking at one file. -->
<Report {view} />
<EditLayer {targets} token={data.token} overrides={data.overrides} />
