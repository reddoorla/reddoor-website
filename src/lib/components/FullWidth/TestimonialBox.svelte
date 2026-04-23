<script lang="ts">
    interface Props {
        icon?: string;
        iconAltText?: string;
        testimonialText?: string;
        attribution?: string;
        attributionLabel?: string;
        backgroundColor?: string;
        float?: string;
        class?: string;
        image?: string;
    }

    let {
        icon = "",
        iconAltText = "company logo",
        testimonialText = "",
        attribution = "",
        attributionLabel = "",
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
</script>

<div class="{className} w-full flex flex-col justify-{justify} text-{float} pb-8"
     style="background-color: {backgroundColor}"
>
    {#if icon}
        <img src={icon} alt={iconAltText} class="pl-3 mb-12 {horizontalFloatMargin}"/>
    {/if}

    {#if testimonialText}
        <p class="mb-7 max-w-full whitespace-pre-wrap">{testimonialText}</p>
    {/if}

    {#if attribution}
        <p class="text-primary large-body font-thin">{attribution}</p>
    {/if}

    {#if attributionLabel}
        <p class="text-mid font-thin">{attributionLabel}</p>
    {/if}



</div>
