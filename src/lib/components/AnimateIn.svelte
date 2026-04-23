<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        style?: string;
        href?: string;
        transitionDelayMax?: number;
        transitionDuration?: number;
        isOff?: boolean;
        class?: string;
        children?: Snippet;
    }

    let {
        style = "",
        href = "",
        transitionDelayMax = 200,
        transitionDuration = 2400,
        isOff = false,
        class: className = '',
        children
    }: Props = $props();

    let isInView = $state(false);
    let el: HTMLElement | null = $state(null);
    let transitionDelay = $state(0);

    const checkViewport = () => {
        if (window && el) {
            const rect = el.getBoundingClientRect();
            isInView = rect.top - rect.height / 2 <= window.innerHeight;
            transitionDelay = transitionDelayMax * (rect.left / window.innerWidth);
        }
    };

    $effect(() => {
        if (isOff) return;
        checkViewport();
        const checking = setTimeout(checkViewport, 500);
        window.addEventListener('scroll', checkViewport);
        return () => {
            window.removeEventListener('scroll', checkViewport);
            clearTimeout(checking);
        };
    });
</script>


{#if isOff}
    <div class={className}>
        {@render children?.()}
    </div>
{:else}
    {#if href}
        <a {href} bind:this={el} class="transition ease-fast-slow {isInView ? "opacity-100 translate-y-0":"opacity-0 translate-y-[25%]"} {className}" style="transition-delay:{transitionDelay}ms; transition-duration:{transitionDuration}ms; {style}">
            {@render children?.()}
        </a>
    {:else}
        <div bind:this={el} class="transition ease-fast-slow {isInView ? "opacity-100 translate-y-0":"opacity-0 translate-y-[25%]"} {className}" style="transition-delay:{transitionDelay}ms; transition-duration:{transitionDuration}ms; {style}">
            {@render children?.()}
        </div>
    {/if}
{/if}
