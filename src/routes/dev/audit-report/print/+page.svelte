<script lang="ts">
  import PrintSheet from "../../../audit/[token]/print/+page.svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<PrintSheet {data} />
