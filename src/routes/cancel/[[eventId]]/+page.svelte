<script lang="ts">
  import { page } from "$app/state";
  import CancelPage from "$lib/components/funnel/CancelPage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<CancelPage copy={data.copy} eventId={page.params.eventId ?? ""} />
