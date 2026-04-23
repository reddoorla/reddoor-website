<script lang='ts'>
    import AnimateIn from "../AnimateIn.svelte";
    import type { Snippet } from 'svelte';

    interface Props {
        animateIn?: boolean;
        class?: string;
        children?: Snippet;
    }

    let { animateIn = false, class: className = '', children }: Props = $props();
</script>

{#if animateIn}
        <AnimateIn><div class="max-w-[1220px] xl:max-w-[1440px] xl:mx-auto mx-[4%] w-[92%] {className || 'flex flex-col items-center justify-center relative'}">{@render children?.()}</div></AnimateIn>
    {:else}
        <div class="max-w-[1220px] xl:max-w-[1440px] xl:mx-auto mx-[4%] w-[92%] {className || 'flex flex-col items-center justify-center relative'}">{@render children?.()}</div>
{/if}
