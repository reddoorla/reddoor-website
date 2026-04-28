<script lang="ts">
  import { animateIn as animateInAction } from "$lib/actions/animateIn";
  import type { Snippet } from "svelte";

  interface Props {
    animateIn?: boolean;
    class?: string;
    children?: Snippet;
  }

  let { animateIn = false, class: className = "", children }: Props = $props();

  const innerClass = $derived(
    `max-w-[1220px] xl:max-w-[1440px] xl:mx-auto mx-[4%] w-[92%] ${
      className || "flex flex-col items-center justify-center relative"
    }`,
  );
</script>

{#if animateIn}
  <div use:animateInAction class={innerClass}>
    {@render children?.()}
  </div>
{:else}
  <div class={innerClass}>
    {@render children?.()}
  </div>
{/if}
