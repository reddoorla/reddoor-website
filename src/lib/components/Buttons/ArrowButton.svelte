<script lang="ts">
    import linkArrow from "$lib/assets/icons/wireframe-link-arrow-right.svg"
    export let text: string = "";
    export let href: string = "#";


    let isLinkArrowActive = false;

</script>

<a 
on:mouseenter={()=>isLinkArrowActive=true} 
on:mouseleave={()=>isLinkArrowActive=false}
on:click= {()=>isLinkArrowActive=false}
class="flex flex-row items-center text-center no-underline justify-center transition-all duration-300 active:-translate-y-2 {$$props.class || ''}" 
{href}>
    <span class="h-5 uppercase no-underline translate-y-[3.5px]">{text}</span>
    <img src={linkArrow} alt="link arrow" class="h-5 w-5 -translate-y-px ml-[10px] transition-transform duration-300 {isLinkArrowActive ? "translate-x-2":""}">
</a>