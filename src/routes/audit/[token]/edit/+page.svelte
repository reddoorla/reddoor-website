<script lang="ts">
  import { toReportView } from "$lib/report/model";
  import Report from "$lib/report/Report.svelte";
  import EditLayer from "$lib/report/EditLayer.svelte";
  import { editableTargets } from "$lib/report/editable";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // THE ONLY THING THAT CLEARS THE KEY FROM THE URL. Not a belt-and-braces
  // addition to the server redirect — a replacement for what that redirect
  // cannot do here.
  //
  // The load function exchanges `?k=` for a cookie and 303s to the bare path,
  // and on most hosts that is what strips the key. NETLIFY PRESERVES THE QUERY
  // STRING ACROSS REDIRECTS, so it does not. Measured 2026-09-11 on the deploy
  // preview, with a control: our 303 to `/audit/{token}/edit` came back with
  // `?k=<key>&zzzmarker=1` — the whole original query, including a marker param
  // added to test exactly this — and Netlify's OWN trailing-slash 308, which
  // this repo does not author, preserved it too. Two redirects, one ours and
  // one the platform's, both appending. It is the platform, and no server-side
  // Location can defeat it.
  //
  // Which makes this the mechanism the separate-path design actually rests on:
  // the URL a browser displays, stores in history, and copies on Cmd-L.
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
