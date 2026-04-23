<script lang='ts'>
    import placeholder from "../../assets/images/background_placeholder.svg";
    import type { Snippet } from 'svelte';

    interface Props {
        image?: string;
        altText?: string;
        children?: Snippet;
    }

    let { image = placeholder, altText = "background image", children }: Props = $props();
</script>

        <div  class="max-w-(--breakpoint-xl) mx-auto relative w-full aspect-9/16 sm:aspect-square lg:aspect-video">
            <img src={image} alt={altText} class="absolute bottom-0 h-full w-full object-cover -z-10"/>
            <div class='w-full h-full p-[4%] xl:p-0'>
                {@render children?.()}
            </div>
        </div>
