<script lang="ts">
  // Shared slice shell: the `{#if !slice.primary.hide}` guard + the
  // <section data-slice-*> opener that every slice repeated (2026-07-16
  // brief, MED-15). RichText and ScreenWidthMedia previously lacked the
  // data-slice-* attributes — adopting this shell added them (debug/testing
  // affordance, no behavioral change).
  //
  // `animate` applies the standard animate-in to the section element itself;
  // most slices animate inner elements instead and leave it off (the action
  // is a no-op when disabled).
  import { animateIn as anim } from "$lib/actions/animateIn";
  import type { Snippet } from "svelte";

  interface Props {
    slice: {
      slice_type: string;
      variation: string;
      primary: { hide?: boolean | null };
    };
    class?: string;
    animate?: boolean;
    children?: Snippet;
  }
  let { slice, class: className = "", animate = false, children }: Props = $props();
</script>

{#if !slice.primary.hide}
  <section
    use:anim={{ enabled: animate }}
    data-slice-type={slice.slice_type}
    data-slice-variation={slice.variation}
    class={className}
  >
    {@render children?.()}
  </section>
{/if}
