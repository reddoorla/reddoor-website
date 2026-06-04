<script lang="ts">
  import { page } from "$app/state";
  import DefaultButton from "$lib/components/Buttons/DefaultButton.svelte";
</script>

<svelte:head>
  <title>{"Reddoor Creative | " + page.error?.message}</title>
</svelte:head>
<section class="h-screen w-screen flex items-center justify-center gap-12 flex-col">
  <h1>This is Our Private Showcase</h1>
  <DefaultButton href="/portfolio" filled red>View Our Public Portfolio</DefaultButton>
  <DefaultButton href="/contact" filled red>Contact Us With Specific Questions</DefaultButton>
</section>
