<script lang="ts">
  import { page } from "$app/state";
  import ReschedulePage from "$lib/components/funnel/ReschedulePage.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<ReschedulePage copy={data.copy} eventId={page.params.eventId ?? ""} />
