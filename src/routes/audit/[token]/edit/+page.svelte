<script lang="ts">
  import { toReportView } from "$lib/report/model";
  import Report from "$lib/report/Report.svelte";
  import EditLayer from "$lib/report/EditLayer.svelte";
  import { editableTargets } from "$lib/report/editable";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // BELT AND BRACES over the server redirect.
  //
  // The load function exchanges `?k=` for a cookie and 303s to the bare path,
  // which is supposed to be what clears the key from the address bar. Measured
  // on a Netlify deploy preview 2026-09-11, the Location header still carried
  // the query — cause not isolated (the route redirects to a path with no query
  // string, and this repo defines no redirect rules, so something downstream
  // appends it). Rather than leave the design's central property depending on
  // that, scrub it here too: whatever the platform does with Location, the URL
  // a browser displays, stores in history and copies on Cmd-L is clean.
  //
  // `replaceState`, not `pushState`: a Back button that returns the operator to
  // a URL carrying the key would undo the whole point.
  $effect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("k")) return;
    url.searchParams.delete("k");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  });

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
