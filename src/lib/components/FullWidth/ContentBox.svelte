<script lang='ts'>
    import placeholderIcon from "../../assets/icons/logos/logo.svg"
    import DefaultButton from "../Buttons/DefaultButton.svelte";
    import ArrowButton from "../Buttons/ArrowButton.svelte";

    interface Props {
        icon?: string;
        iconAltText?: string;
        labelText?: string;
        titleText?: string;
        titleTag?: string;
        subtitleText?: string;
        paragraphText?: string;
        buttonText?: string;
        linkText?: string;
        linkHref?: string;
        backgroundColor?: string;
        float?: string;
        class?: string;
    }

    let {
        icon = "",
        iconAltText = "logo",
        labelText = "",
        titleText = "",
        titleTag = "h3",
        subtitleText = "",
        paragraphText = "",
        buttonText = "",
        linkText = "",
        linkHref = "",
        backgroundColor = "transparent",
        float = "center",
        class: className = ''
    }: Props = $props();

    const justify = $derived(float === "left" ? "start" : float === "right" ? "end" : float);
    const horizontalFloatMargin = $derived(
        float === "left" ? "ml-0 mr-auto"
        : float === "right" ? "ml-auto mr-0"
        : "mx-auto"
    );
    const resolvedIcon = $derived(icon === "placeholder" ? placeholderIcon : icon);
</script>

<div class="w-full flex flex-col  p-2 sm:p-8 justify-{justify} text-{float} {className}"
     style="background-color: {backgroundColor}"
>
    {#if resolvedIcon}
        <img src={resolvedIcon} alt={iconAltText} class="w-[70px] h-[70px] mb-7 {horizontalFloatMargin}"/>
    {/if}
    {#if labelText}
        <h6 class="mb-7">{labelText}</h6>
    {/if}
    {#if titleText}
        {#if titleTag==="h1"}
            <h1 class="mb-7">{titleText}</h1>
        {/if}
        {#if titleTag==="h2"}
            <h2 class="mb-7">{titleText}</h2>
        {/if}
        {#if titleTag==="h3"}
            <h3 class="mb-7">{titleText}</h3>
        {/if}
        {#if titleTag==="h4"}
            <h4 class="mb-7">{titleText}</h4>
        {/if}
        {#if titleTag==="h5"}
            <h5 class="mb-7">{titleText}</h5>
        {/if}
        {#if titleTag==="h6"}
            <h6 class="mb-7">{titleText}</h6>
        {/if}


    {/if}
    {#if subtitleText}
        <h6 class="mb-7">{subtitleText}</h6>
    {/if}
    {#if paragraphText}
        <p class="mb-7 max-w-full">{paragraphText}</p>
    {/if}
    <div class="flex flex-nowrap text-nowrap flex-col sm:flex-row align-middle justify-center sm:justify-{justify}">
        {#if buttonText}
            <DefaultButton text={buttonText} class="mr-5"/>
        {/if}
        {#if linkText}
            <ArrowButton text={linkText} href={linkHref} class="translate-y-1 md:translate-y-0"/>
        {/if}
    </div>


</div>
