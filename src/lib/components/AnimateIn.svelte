<script lang="ts">
  import { onDestroy, onMount } from "svelte";

    let isInView = false;
    let el:HTMLElement | null;
    let transitionDelay = 0;
    export let style ="";
    export let href="";

    export let transitionDelayMax = 200;
    export let transitionDuration = 2400;
    export let isOff = false;

    const checkViewport = () => {
        if(window&&el){
                let rect = el.getBoundingClientRect();
                isInView = rect.top - rect.height/2 <= window.innerHeight
                transitionDelay= transitionDelayMax * (rect.left/window.innerWidth)
            }
    }
    let checking:NodeJS.Timeout;

    onMount(()=>{
        if(!isOff){
        checkViewport()

        checking = setTimeout(()=>{
            checkViewport()
        },500)
       
       
        window.addEventListener('scroll', checkViewport);
        }
    })

    onDestroy(()=>{
        if(!isOff){
        if(typeof window !== 'undefined'){
        window.removeEventListener('scroll', checkViewport)
       
        if(checking)
            clearInterval(checking);
        }}
    }
    )
</script>


{#if isOff}
    <div class={$$props.class || ''}>
        <slot />
    </div>
{:else}
    {#if href}
        <a {href} bind:this={el} class="transition ease-fast-slow {isInView ? "opacity-100 translate-y-0":"opacity-0 translate-y-[25%]"} {$$props.class || ''}" style="transition-delay:{transitionDelay}ms; transition-duration:{transitionDuration}ms; {style}">
            <slot />
        </a>
    {:else}
        <div bind:this={el} class="transition ease-fast-slow {isInView ? "opacity-100 translate-y-0":"opacity-0 translate-y-[25%]"} {$$props.class || ''}" style="transition-delay:{transitionDelay}ms; transition-duration:{transitionDuration}ms; {style}">
            <slot />
        </div>
    {/if}
{/if}