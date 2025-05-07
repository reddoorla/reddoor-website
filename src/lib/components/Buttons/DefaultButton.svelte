<script lang="ts">


    export let text = "";
    export let click = ()=>{};
    export let filled = false;
    export let red = false;
    export let bold = false;
    export let href = '';
</script>

<style>
    button{
        padding: 10px 15px;
        font-size: 14px;
        line-height: normal;
    }

    


</style>

    {#if !href}
    <button on:click={click} 
            class="
            {filled && red ?
                "bg-primary border-primary hover:bg-primary-dark active:bg-black text-white" 
            : red ?
            'border-primary hover:bg-primary-dark active:bg-black text-primary hover:text-white' 
            : filled ?
                "bg-white border-white hover:opacity-80 active:bg-black text-white"
            :
                " border-white hover:bg-white active:bg-black text-white hover:text-black"
            }
            
            {bold ?
            "font-semibold":
            "font-extralight"
            } 
            pointer-events-auto border-1 tracking-wider rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {$$props.class || ''}">
            {text} <slot/>
    </button>
    {:else}
    <a href={href} rel="noopener noreferrer">
        <button 
            class="
            {filled && red ?
                "bg-primary border-primary hover:bg-primary-dark active:bg-black text-white" 
            : red ?
            'border-primary hover:bg-primary-dark active:bg-black text-primary hover:text-white' 
            : filled ?
                "bg-white border-white hover:opacity-80 active:bg-black text-white"
            :
                " border-white hover:bg-white active:bg-black text-white hover:text-black"
            }
            {bold ?
            "font-semibold":
            "font-extralight"
            } 
            pointer-events-auto tracking-wider border-1 rounded-[4px] text-center mb-5 sm:mb-0 cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {$$props.class || ''}">
            {text} <slot/>
        </button>
    </a>
    {/if}
