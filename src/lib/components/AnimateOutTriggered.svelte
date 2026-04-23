<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        trigger: boolean;
        style?: string;
        transitionDuration?: number;
        class?: string;
        children?: Snippet;
    }

    let {
        trigger,
        style = "",
        transitionDuration = 2000,
        class: className = '',
        children
    }: Props = $props();
</script>

<div class="transition ease-fast-slow {!trigger ? "opacity-100 translate-y-0 delay-1000":"opacity-0 translate-y-[50%]"} {className}" style="transition-duration:{transitionDuration}ms; {style}">
    {@render children?.()}
</div>
