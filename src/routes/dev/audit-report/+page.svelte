<script lang="ts">
  import Report from "$lib/report/Report.svelte";
  import { toReportView } from "$lib/report/model";
  import { ALL_PASS_REPORT } from "$lib/report/fixtures/all-pass";

  // The "check, check, check" page: the report rendered over a fixture in
  // which every stage ran and nothing failed. It is the shape we want our own
  // site to reach, and a page that can only ever show findings has no way to
  // say so. Fictional business, reserved TLD — see the fixture.

  const view = toReportView(ALL_PASS_REPORT);
</script>

<svelte:head>
  <title>Audit report fixture — a site that passes everything</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<Report {view} />
