<script lang="ts">
    interface Props {
        text?: string;
        click?: () => void;
        red?: boolean;
        bold?: boolean;
        href?: string;
        class?: string;
    }

    let {
        text = "BUTTON",
        click = () => {},
        red = true,
        bold = false,
        href = '',
        class: className = ''
    }: Props = $props();
</script>

<style>
    button{
        padding: 4px 24px;
        font-size: 15px;
        line-height: 35px;
    }




</style>


{#if !href}
<button onclick={click}
        class="{red ?
         "bg-primary border-1 border-primary hover:bg-primary-dark active:bg-black text-white"
         :
         "bg-white border-1 border-white hover:bg-primary active:bg-black text-primary hover:text-white"
         }
         {bold ?
         "font-semibold":
         "font-light"
         }
         tracking-wider text-center mb-5 sm:mb-0 cursor-pointer text-nowrap rounded-full transition-all duration-300 active:-translate-y-2 {className}">
        {text}
</button>
{:else}
<a href={href} rel="noopener noreferrer">
    <button
        class="{red ?
         "bg-primary border-1 border-primary hover:bg-primary-dark active:bg-black text-white"
         :
         "bg-white border-1 border-white hover:bg-primary active:bg-black text-primary hover:text-white"
         }
         {bold ?
         "font-semibold":
         "font-light"
         }
         tracking-wider text-center mb-5 sm:mb-0 cursor-pointer text-nowrap rounded-full transition-all duration-300 active:-translate-y-2 {className}">
        {text}
    </button>
</a>
{/if}
