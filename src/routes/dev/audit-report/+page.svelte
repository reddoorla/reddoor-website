<script lang="ts">
  import Report from "$lib/report/Report.svelte";
  import { toReportView } from "$lib/report/model";
  import { ALL_PASS_REPORT } from "$lib/report/fixtures/all-pass";
  import type { PageData } from "./$types";

  // Two jobs, and the second one is why this page exists at all.
  //
  // By default: the report rendered over a fixture in which every stage ran and
  // nothing failed. That is the shape we want our own site to reach, and a page
  // that can only ever show findings has no way to say so. Fictional business,
  // reserved TLD — see the fixture.
  //
  // But a fixture where everything passes exercises none of the hard cases: a
  // truncated evidence line, fourteen findings jostling for order, a stage that
  // came back unmeasured. So when `.audit-sample.json` is present at the repo
  // root, this page renders THAT instead — a real audit of a real site, dumped
  // by reddoor-maintenance:
  //
  //   OUT=../reddoor-website/.audit-sample.json \
  //     pnpm tsx scripts/validate-checks.mts "https://example.com|Example"
  //
  // The file is gitignored and dev-only. Absent, nothing changes.

  let { data }: { data: PageData } = $props();

  const view = $derived(toReportView(data.sample ?? ALL_PASS_REPORT));
</script>

<svelte:head>
  <title>
    {data.sample
      ? "Audit report — real sample"
      : "Audit report fixture — a site that passes everything"}
  </title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<Report {view} />
