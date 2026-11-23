<script lang="ts">
  import TechnicalReport from "$lib/report/technical/TechnicalReport.svelte";
  import { toTechnicalView } from "$lib/report/technical/model";
  import { TECHNICAL_REPORT } from "$lib/report/fixtures/technical";
  import type { PageData } from "./$types";

  // The Technical report over a fixture: an invented current-shape row with a
  // few things broken and a few wanting attention. When `.audit-sample.json`
  // is present at the repo root (dev only, gitignored), it renders that
  // instead, exactly as the parent fixture route does. Render a RENAMED copy
  // of a stored row there, never a prospect's own.

  let { data }: { data: PageData } = $props();

  // Pinned, so the fixture's release-line wording does not drift with the clock.
  const view = $derived(
    toTechnicalView(data.sample ?? TECHNICAL_REPORT, new Date("2026-11-23T12:00:00Z")),
  );
</script>

<svelte:head>
  <title>{data.sample ? "Technical report — real sample" : "Technical report fixture"}</title>
  <meta name="robots" content="noindex, nofollow, noarchive" />
</svelte:head>

<TechnicalReport {view} reference="0a1b2c3d" />
