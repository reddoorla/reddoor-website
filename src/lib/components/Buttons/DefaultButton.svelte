<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    text?: string;
    click?: () => void;
    filled?: boolean;
    red?: boolean;
    bold?: boolean;
    href?: string;
    class?: string;
    children?: Snippet;
  }

  let {
    text = "",
    click = () => {},
    filled = false,
    red = false,
    bold = false,
    href = "",
    class: className = "",
    children,
  }: Props = $props();
</script>

{#if !href}
  <button
    onclick={click}
    class="
            {filled && red
      ? 'bg-primary border-primary hover:bg-primary-dark active:bg-black text-white'
      : red
        ? 'border-primary hover:bg-primary-dark active:bg-black text-primary hover:text-white'
        : filled
          ? 'bg-white border-white hover:opacity-80 active:bg-black text-white'
          : ' border-white hover:bg-white active:bg-black text-white hover:text-black'}

            {bold ? 'font-bold' : 'font-extralight'}
            pointer-events-auto border-1 tracking-wider rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {className}"
  >
    {text}
    {@render children?.()}
  </button>
{:else}
  <!-- A navigational CTA is a link, not a button. Render a single <a> styled as
       the button (inline-block so padding + active:-translate-y-2 apply) rather
       than nesting <button> inside <a>, which is invalid HTML / a double tab stop. -->
  <a
    {href}
    rel="noopener noreferrer"
    class="inline-block
            {filled && red
      ? 'bg-primary border-primary hover:bg-primary-dark active:bg-black text-white'
      : red
        ? 'border-primary hover:bg-primary-dark active:bg-black text-primary hover:text-white'
        : filled
          ? 'bg-white border-white hover:opacity-80 active:bg-black text-white'
          : ' border-white hover:bg-white active:bg-black text-white hover:text-black'}
            {bold ? 'font-bold' : 'font-extralight'}
            pointer-events-auto tracking-wider border-1 rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {className}"
  >
    {text}
    {@render children?.()}
  </a>
{/if}

<style>
  /* Applies to both the <button> (no-href) and the <a> CTA (href branch) so the
     two render identically. Scoped to this component, so the `a` rule only ever
     matches this CTA anchor. */
  button,
  a {
    padding: 10px 15px;
    font-size: 14px;
    line-height: normal;
  }
</style>
