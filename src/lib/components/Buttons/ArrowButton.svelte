<script lang="ts">
    import linkArrow from "$lib/assets/icons/wireframe-link-arrow-right.svg"

    interface Props {
        text?: string;
        href?: string;
        class?: string;
    }

    let { text = "", href = "#", class: className = '' }: Props = $props();

    let isLinkArrowActive = $state(false);
</script>

<a
onmouseenter={()=>isLinkArrowActive=true}
onmouseleave={()=>isLinkArrowActive=false}
onclick= {()=>isLinkArrowActive=false}
class="flex flex-row items-center text-center no-underline justify-center transition-all duration-300 active:-translate-y-2 {className}"
{href}>
    <span class="h-5 uppercase no-underline translate-y-[3.5px]">{text}</span>
    <img src={linkArrow} alt="link arrow" class="h-5 w-5 -translate-y-px ml-[10px] transition-transform duration-300 {isLinkArrowActive ? "translate-x-2":""}">
</a>
