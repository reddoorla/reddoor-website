<script lang="ts">
  import { onMount } from "svelte";

    let isInView = false;
    let el:HTMLElement | null;
    let transitionDelay = 0;

    export let transitionDelayMax = 400;


    onMount(()=>{
        if(el){
            let rect = el.getBoundingClientRect();
            isInView = rect.bottom <= window.innerHeight + rect.height
            transitionDelay= transitionDelayMax * (rect.left/window.innerWidth)
        }

        window.addEventListener('scroll', ()=>{
            if (el) { 
                let rect = el.getBoundingClientRect();
                isInView = rect.bottom <= window.innerHeight + rect.height
            }
        
        })
    })
</script>


   

        <div bind:this={el} class="transition duration-[2000ms] ease-fast-slow {isInView ? "opacity-100 translate-y-0":"opacity-0 translate-y-[50%]"} {$$props.class || ''}" style="transition-delay:{transitionDelay}ms">
            <slot />
        </div>
