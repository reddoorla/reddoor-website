<script lang="ts">
    import placeholder from "$lib/assets/images/image_placeholder.svg"

    interface Props {
        src?: string;
        alt?: string;
        label?: string;
        class?: string;
    }

    let { src = placeholder, alt = "placeholder", label = "", class: className = '' }: Props = $props();

    const rotationAngle = "36.8";
    const crossLength = "125%";
</script>

<div class="w-full my-8 relative {className}">
    <div class="w-full aspect-4/3 {src===placeholder ? "border-light border-2 bg-light/25":""}  rounded-xs  flex items-center justify-center relative">
        <img {src} {alt} class="z-10 {src==placeholder ? "w-16 bg-[#F2F5F7]" : "w-full"}"/>
        <div class="absolute bg-light h-[2px] {src===placeholder ? "":"hidden"}" style="transform: rotate({rotationAngle}deg); width:{crossLength}"></div>
        <div class="absolute bg-light h-[2px] {src===placeholder ? "":"hidden"}" style="transform: rotate(-{rotationAngle}deg); width:{crossLength}"></div>
        <h6 class="absolute bottom-4 z-20">{label}</h6>
    </div>
</div>
