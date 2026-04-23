<script lang="ts">
    import placeholder from "$lib/assets/images/image_placeholder.svg"

    interface Props {
        src?: string;
        alt?: string;
        class?: string;
    }

    let { src = placeholder, alt = "placeholder", class: className = '' }: Props = $props();

    const rotationAngle = "45";
    const crossLength = "141%";
</script>

<div class="w-full my-8 {className}">
    <div class="w-full aspect-square {src===placeholder ? "border-light border-2 bg-light/25":""}  rounded-xs  flex items-center justify-center relative">
        <img {src} {alt} class="z-10 {src==placeholder ? "w-16 bg-[#F2F5F7]" : "w-full"}"/>
        <div class="absolute bg-light h-[2px] {src===placeholder ? "":"hidden"}" style="transform: rotate({rotationAngle}deg); width:{crossLength}"></div>
        <div class="absolute bg-light h-[2px] {src===placeholder ? "":"hidden"}" style="transform: rotate(-{rotationAngle}deg); width:{crossLength}"></div>
    </div>
</div>
