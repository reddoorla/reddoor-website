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

            {bold ? 'font-semibold' : 'font-extralight'}
            pointer-events-auto border-1 tracking-wider rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {className}"
  >
    {text}
    {@render children?.()}
  </button>
{:else}
  <a {href} rel="noopener noreferrer">
    <button
      class="
            {filled && red
        ? 'bg-primary border-primary hover:bg-primary-dark active:bg-black text-white'
        : red
          ? 'border-primary hover:bg-primary-dark active:bg-black text-primary hover:text-white'
          : filled
            ? 'bg-white border-white hover:opacity-80 active:bg-black text-white'
            : ' border-white hover:bg-white active:bg-black text-white hover:text-black'}
            {bold ? 'font-semibold' : 'font-extralight'}
            pointer-events-auto tracking-wider border-1 rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {className}"
    >
      {text}
      {@render children?.()}
    </button>
  </a>
{/if}

<style>
  button {
    padding: 10px 15px;
    font-size: 14px;
    line-height: normal;
  }
</style>
