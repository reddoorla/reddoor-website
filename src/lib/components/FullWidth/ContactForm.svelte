<script lang="ts">
    import StyledSingleSelect from "./StyledSingleSelect.svelte";
    import DefaultButton from "../Buttons/DefaultButton.svelte";

    interface Props {
        PRODUCTS?: string[];
    }

    let { PRODUCTS = ["Apples", "Bananas", "Clementines"] }: Props = $props();

    let form: HTMLFormElement;
    const submit = () => form.submit();

    let selectValue = $state("");
</script>


<form class="w-full flex flex-col gap-4" name="contact" method="post" bind:this={form} netlify netlify-honeypot="bot-field">
    <input type="hidden" name="form-name" value="contact" />

        <div class="flex flex-col md:flex-row text-light items-center justify-center w-full">
            <div class="flex items-center justify-center w-full translate-x-[6px]">
                <i class="fa-regular fa-envelope h-6 mt-[7px] -mr-8 z-10"></i>
                <input class="w-full border rounded-[3px] text-dark border-light h-10 pl-10 pt-[2.5px]" name="email" placeholder="Email" type="email"/>
            </div>
        </div>
        <StyledSingleSelect placeholder="Select product" items={PRODUCTS} bind:value={selectValue}/>
        <input name="select" type="text" bind:value={selectValue} hidden />

        <textarea class="border rounded-[3px] text-dark border-light h-48 pl-4 pt-[2.5px]" placeholder="Type something..." name="message"></textarea>

        <div class="w-16">
            <DefaultButton text="submit" click={submit} class=""/>
        </div>

</form>
