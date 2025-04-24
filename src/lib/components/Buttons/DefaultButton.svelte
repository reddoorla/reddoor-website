<script lang="ts">
    export let text = "BUTTON";
    export let click = ()=>{};
    export let filled = true;
    export let bold = false;
    export let href = '';
</script>

<style>
    button{
        padding: 4px 24px;
        font-size: 15px;
        line-height: 35px;
    }

    


</style>

{#if !href}
<button on:click={click} 
        class="{filled ?
         "bg-primary border-1 border-primary hover:bg-primary-dark active:bg-black text-white" 
         : 
         " " 
         }
         {bold ?
         "font-semibold":
         "font-light"
         } 
         tracking-wider text-center mb-5 sm:mb-0 uppercase cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {$$props.class || ''}">
        {text}
</button>
{:else}
<a href={href} rel="noopener noreferrer">
    <button 
        class="{filled ?
         "bg-primary border-1 border-primary hover:bg-primary-dark active:bg-black text-white" 
         : 
         " " 
         }
         {bold ?
         "font-semibold":
         "font-light"
         } 
         tracking-wider text-center mb-5 sm:mb-0 uppercase cursor-pointer text-nowrap transition-all duration-300 active:-translate-y-2 {$$props.class || ''}">
        {text}
    </button>
</a>
{/if}